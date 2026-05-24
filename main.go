package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/google/gopacket"
	"github.com/google/gopacket/layers"
	"github.com/google/gopacket/pcap"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	dnsQueriesTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "dns_queries_total",
			Help: "Total number of DNS queries captured.",
		},
		[]string{"domain", "rcode"},
	)

	dnsQueryDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "dns_query_duration_seconds",
			Help:    "DNS query resolution latency in seconds.",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"domain", "status"},
	)

	// Keep track of request timestamps to calculate latency
	queryTimes = make(map[uint16]time.Time)
)

func getEnv(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}


func init() {
	prometheus.MustRegister(dnsQueriesTotal)
	prometheus.MustRegister(dnsQueryDuration)
}

type IngestPayload struct {
	Timestamp string `json:"ts"`
	Namespace string `json:"namespace"`
	Pod       string `json:"pod"`
	Domain    string `json:"domain"`
	Type      string `json:"type"`
	Latency   int    `json:"latency"`
	Rcode     string `json:"rcode"`
	Status    string `json:"status"`
}

func sendToBackend(backendURL, token string, payload IngestPayload) {
	b, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", backendURL+"/api/telemetry/ingest", bytes.NewBuffer(b))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{Timeout: 2 * time.Second}
	_, err := client.Do(req)
	if err != nil {
		// Just log quietly so we don't spam
		// log.Printf("Failed to push telemetry: %v", err)
	}
}

func mockTrafficGenerator(backendURL, token string) {
	domains := []string{"api.stripe.com", "slack.com", "github.com", "broken-api.internal", "aws.amazon.com"}
	namespaces := []string{"production", "default", "kube-system"}
	pods := []string{"payment-service-6f8", "frontend-app-7f5", "auth-manager-3b2", "coredns-5f82"}
	types := []string{"A", "AAAA", "TXT"}

	log.Println("Starting mock traffic generator...")

	for {
		time.Sleep(time.Duration(rand.Intn(1000)+500) * time.Millisecond)

		domain := domains[rand.Intn(len(domains))]
		ns := namespaces[rand.Intn(len(namespaces))]
		pod := pods[rand.Intn(len(pods))]
		t := types[rand.Intn(len(types))]

		isError := rand.Float32() < 0.1
		status := "OK"
		rcode := "NOERROR"
		latency := rand.Intn(20) + 5

		if isError {
			status = "ERROR"
			if domain == "broken-api.internal" {
				rcode = "SERVFAIL"
				latency += rand.Intn(3000)
			} else {
				rcode = "NXDOMAIN"
			}
		}

		payload := IngestPayload{
			Timestamp: time.Now().Format(time.RFC3339),
			Namespace: ns,
			Pod:       pod,
			Domain:    domain,
			Type:      t,
			Latency:   latency,
			Rcode:     rcode,
			Status:    status,
		}

		fmt.Printf("MOCK: DNS Response: %s | Latency: %dms | Status: %s\n", domain, latency, status)
		go sendToBackend(backendURL, token, payload)
	}
}

func main() {
	mockFlag := flag.Bool("mock", false, "Run in mock mode (no pcap, generates fake traffic)")
	backendURL := flag.String("backend", "http://localhost:3001", "Backend URL to push telemetry")
	agentToken := flag.String("token", "", "Cluster Agent Token for authentication")
	flag.Parse()

	fmt.Println("Starting DNS Sidecar Monitor...")

	// Start Prometheus metrics endpoint
	go func() {
		
		port := getEnv("PROMETHEUS_PORT", "2112")

		http.Handle("/metrics", promhttp.Handler())
		
		log.Println("Prometheus metrics server listening on :",port)
		
		if err := http.ListenAndServe(":"+port, nil); err != nil {
			log.Fatalf("Error starting Prometheus metrics server: %v", err)
		}
	}()
	iface := getEnv("NETWORK_INTERFACE", "eth0")

	// Open the shared network interface
	if *mockFlag {
		if *agentToken == "" {
			log.Println("WARNING: No --token provided. Traffic will likely be rejected by backend.")
		}
		mockTrafficGenerator(*backendURL, *agentToken)
		return
	}

	// Real PCAP Mode
	handle, err := pcap.OpenLive(iface, 1600, true, pcap.BlockForever)
	if err != nil {
		log.Fatalf("Error opening device eth0: %v. Try running with sudo or use --mock", err)
	}
	defer handle.Close()

	// Filter only DNS traffic
	dnsPort := getEnv("DNS_PORT", "53")

	err = handle.SetBPFFilter(fmt.Sprintf("udp and port %s", dnsPort))
	if err != nil {
		log.Fatal(err)
	}

	packetSource := gopacket.NewPacketSource(handle, handle.LinkType())
	for packet := range packetSource.Packets() {
		dnsLayer := packet.Layer(layers.LayerTypeDNS)
		if dnsLayer != nil {
			dns, _ := dnsLayer.(*layers.DNS)

			if !dns.QR {
				t := packet.Metadata().Timestamp
				if t.IsZero() {
					t = time.Now()
				}
				queryTimes[dns.ID] = t

				if len(queryTimes) > 5000 {
					queryTimes = make(map[uint16]time.Time)
				}
			} else {
				var latency time.Duration
				hasLatency := false
				if t, ok := queryTimes[dns.ID]; ok {
					latency = time.Since(t)
					delete(queryTimes, dns.ID)
					hasLatency = true
				}

				for _, q := range dns.Questions {
					domain := string(q.Name)

					if strings.Contains(domain, ".svc.cluster.local") || strings.Contains(domain, ".cluster.local") {
						continue
					}

					status := "OK"
					isError := false
					rcode := dns.ResponseCode.String()
					if dns.ResponseCode != layers.DNSResponseCodeNoErr {
						status = "ERROR"
						isError = true
					}

					dnsQueriesTotal.WithLabelValues(domain, rcode).Inc()
					if hasLatency {
						dnsQueryDuration.WithLabelValues(domain, status).Observe(latency.Seconds())
					}

					latencyStr := "N/A"
					latMs := 0
					if hasLatency {
						latMs = int(latency.Milliseconds())
						latencyStr = fmt.Sprintf("%dms", latMs)
					}

					qType := q.Type.String()

					payload := IngestPayload{
						Timestamp: time.Now().Format(time.RFC3339),
						Namespace: "production", // Would be extracted from IP mapping in reality
						Pod:       "unknown",    // Would be extracted from IP mapping in reality
						Domain:    domain,
						Type:      qType,
						Latency:   latMs,
						Rcode:     rcode,
						Status:    status,
					}

					if *agentToken != "" {
						go sendToBackend(*backendURL, *agentToken, payload)
					}

					if isError {
						fmt.Printf("🚨 DNS FAILURE: %s | Status: %s | Latency: %s\n", domain, rcode, latencyStr)
					} else {
						fmt.Printf("DNS Response: %s | Latency: %s | Status: %s\n", domain, latencyStr, status)
					}
				}
			}
		}
	}
}

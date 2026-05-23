package main

import (
	"fmt"
	"log"
	"net/http"
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

func init() {
	prometheus.MustRegister(dnsQueriesTotal)
	prometheus.MustRegister(dnsQueryDuration)
}

func main() {
	fmt.Println("Starting DNS Sidecar Monitor...")

	// Start Prometheus metrics endpoint in a goroutine
	go func() {
		http.Handle("/metrics", promhttp.Handler())
		log.Println("Prometheus metrics server listening on :2112")
		if err := http.ListenAndServe(":2112", nil); err != nil {
			log.Fatalf("Error starting Prometheus metrics server: %v", err)
		}
	}()

	// Open the shared network interface
	handle, err := pcap.OpenLive("eth0", 1600, true, pcap.BlockForever)
	if err != nil {
		log.Fatal(err)
	}
	defer handle.Close()

	// Filter only DNS traffic (port 53)
	err = handle.SetBPFFilter("udp and port 53")
	if err != nil {
		log.Fatal(err)
	}

	// Read packets
	packetSource := gopacket.NewPacketSource(handle, handle.LinkType())
	for packet := range packetSource.Packets() {
		// Check if it has a DNS layer
		dnsLayer := packet.Layer(layers.LayerTypeDNS)
		if dnsLayer != nil {
			dns, _ := dnsLayer.(*layers.DNS)

			if !dns.QR {
				// 1. Capture DNS Query - Record starting timestamp
				t := packet.Metadata().Timestamp
				if t.IsZero() {
					t = time.Now()
				}
				queryTimes[dns.ID] = t

				// Prevent slow memory leaks from unmatched queries
				if len(queryTimes) > 5000 {
					queryTimes = make(map[uint16]time.Time)
				}
			} else {
				// 2. Capture DNS Response - Match transaction ID and calculate latency
				var latency time.Duration
				hasLatency := false
				if t, ok := queryTimes[dns.ID]; ok {
					latency = time.Since(t)
					delete(queryTimes, dns.ID)
					hasLatency = true
				}

				for _, q := range dns.Questions {
					domain := string(q.Name)

					// Ignore local Kubernetes cluster lookup routing search path
					if strings.Contains(domain, ".svc.cluster.local") || strings.Contains(domain, ".cluster.local") {
						continue
					}

					// Format the metrics status and label details
					status := "OK"
					isError := false
					if dns.ResponseCode != layers.DNSResponseCodeNoErr {
						status = strings.ToUpper(dns.ResponseCode.String())
						isError = (dns.ResponseCode == layers.DNSResponseCodeNXDomain || dns.ResponseCode == layers.DNSResponseCodeServFail)
					}

					// Increment Prometheus counters
					dnsQueriesTotal.WithLabelValues(domain, dns.ResponseCode.String()).Inc()
					if hasLatency {
						dnsQueryDuration.WithLabelValues(domain, status).Observe(latency.Seconds())
					}

					// Format and log standard outputs with latency
					latencyStr := "N/A"
					if hasLatency {
						latencyStr = fmt.Sprintf("%dms", latency.Milliseconds())
					}

					if isError {
						fmt.Printf("🚨 DNS FAILURE: %s | Status: %s | Latency: %s\n", domain, status, latencyStr)
					} else {
						fmt.Printf("DNS Response: %s | Latency: %s | Status: %s\n", domain, latencyStr, status)
					}
				}
			}
		}
	}
}

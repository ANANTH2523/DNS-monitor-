package ws

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/dns-sentinel/backend/database"
	"github.com/dns-sentinel/backend/models"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // allow all for hackathon
	},
}

type Client struct {
	Hub       *Hub
	Conn      *websocket.Conn
	Send      chan []byte
	ClusterID string
}

type Hub struct {
	// clusterID -> clients
	Clients    map[string]map[*Client]bool
	Broadcast  chan Message
	Register   chan *Client
	Unregister chan *Client
	mu         sync.RWMutex
}

type Message struct {
	ClusterID string      `json:"-"`
	Type      string      `json:"type"`
	Payload   interface{} `json:"payload"`
}

var DefaultHub = &Hub{
	Broadcast:  make(chan Message),
	Register:   make(chan *Client),
	Unregister: make(chan *Client),
	Clients:    make(map[string]map[*Client]bool),
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.mu.Lock()
			if _, ok := h.Clients[client.ClusterID]; !ok {
				h.Clients[client.ClusterID] = make(map[*Client]bool)
			}
			h.Clients[client.ClusterID][client] = true
			h.mu.Unlock()

			// Send initial snapshot
			go sendSnapshot(client)

		case client := <-h.Unregister:
			h.mu.Lock()
			if clients, ok := h.Clients[client.ClusterID]; ok {
				if _, ok := clients[client]; ok {
					delete(clients, client)
					close(client.Send)
				}
			}
			h.mu.Unlock()

		case msg := <-h.Broadcast:
			h.mu.RLock()
			clients := h.Clients[msg.ClusterID]
			b, _ := json.Marshal(msg)
			for client := range clients {
				select {
				case client.Send <- b:
				default:
					close(client.Send)
					delete(h.Clients[msg.ClusterID], client)
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (c *Client) WritePump() {
	ticker := time.NewTicker(50 * time.Second)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()
	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)
			if err := w.Close(); err != nil {
				return
			}
		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func ServeWS(c *gin.Context) {
	clusterID := c.Query("cluster")
	// Note: Authentication should be checked before upgrading
	if clusterID == "" {
		c.AbortWithStatus(400)
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Println(err)
		return
	}

	client := &Client{Hub: DefaultHub, Conn: conn, Send: make(chan []byte, 256), ClusterID: clusterID}
	client.Hub.Register <- client

	go client.WritePump()
}

func sendSnapshot(client *Client) {
	db := database.GetDB()

	// Get latest events
	var events []models.DnsEvent
	db.Where("cluster_id = ?", client.ClusterID).Order("timestamp desc").Limit(100).Find(&events)

	// Get active incidents
	var incidents []models.Incident
	db.Where("cluster_id = ?", client.ClusterID).Order("timestamp desc").Limit(50).Find(&incidents)

	// In a real system, we would calculate metrics here or fetch from a materialized view
	metrics := models.ClusterMetrics{
		TotalQueries: uint(len(events)), // simplified
		Failures:     0,
		HealthScore:  99.9,
		P50Latency:   8.0,
		P95Latency:   15.0,
		P99Latency:   22.0,
		Throughput:   2.5,
		CacheHitRate: 85.0,
		ThreatScore:  5.0,
		FailureRate:  0.5,
	}

	for _, e := range events {
		if e.Status == "ERROR" {
			metrics.Failures++
		}
	}
	if len(events) > 0 {
		metrics.FailureRate = float64(metrics.Failures) / float64(len(events)) * 100
	}

	payload := map[string]interface{}{
		"events":    events,
		"incidents": incidents,
		"metrics":   metrics,
	}

	b, _ := json.Marshal(Message{
		Type:    "snapshot",
		Payload: payload,
	})

	client.Send <- b
}

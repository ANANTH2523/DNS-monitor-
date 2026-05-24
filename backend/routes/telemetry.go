package routes

import (
	"log"
	"net/http"
	"time"

	"github.com/dns-sentinel/backend/database"
	"github.com/dns-sentinel/backend/models"
	"github.com/dns-sentinel/backend/ws"
	"github.com/gin-gonic/gin"
)

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

func TelemetryIngest(c *gin.Context) {
	// Simple token check. In production, this would be a secure token issued to the sidecar.
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Missing agent token"})
		return
	}
	// authHeader format expected: "Bearer <cluster_token>"
	token := ""
	if len(authHeader) > 7 {
		token = authHeader[7:]
	}

	db := database.GetDB()
	var cluster models.Cluster
	if token == "" {
		// Fallback for mock sidecar: grab the first cluster
		if err := db.First(&cluster).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "No clusters exist to ingest to"})
			return
		}
	} else {
		if err := db.Where("token = ?", token).First(&cluster).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid agent token"})
			return
		}
	}

	var payload IngestPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ts, err := time.Parse(time.RFC3339, payload.Timestamp)
	if err != nil {
		ts = time.Now()
	}

	event := models.DnsEvent{
		ClusterID: cluster.ID,
		Timestamp: ts,
		Namespace: payload.Namespace,
		Pod:       payload.Pod,
		Domain:    payload.Domain,
		Type:      payload.Type,
		Latency:   payload.Latency,
		Rcode:     payload.Rcode,
		Status:    payload.Status,
	}

	if err := db.Create(&event).Error; err != nil {
		log.Printf("Error inserting event: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	// Broadcast via WebSocket
	ws.DefaultHub.Broadcast <- ws.Message{
		ClusterID: cluster.ID,
		Type:      "dns_query",
		Payload: gin.H{
			"id":        event.ID,
			"ts":        event.Timestamp.Format("15:04:05"),
			"namespace": event.Namespace,
			"pod":       event.Pod,
			"domain":    event.Domain,
			"type":      event.Type,
			"latency":   event.Latency,
			"rcode":     event.Rcode,
			"status":    event.Status,
			"spike":     event.Latency > 50,
		},
	}

	// Simplistic anomaly detection for demo purposes
	if event.Status == "ERROR" {
		if event.Rcode == "NXDOMAIN" {
			// Trigger an incident
			incident := models.Incident{
				ID:        time.Now().Format("20060102150405"),
				ClusterID: cluster.ID,
				Timestamp: time.Now(),
				Title:     "NXDOMAIN Anomaly",
				Level:     "warning",
				Desc:      "Failed resolution for " + event.Domain,
				Service:   event.Pod,
			}
			db.Create(&incident)
			ws.DefaultHub.Broadcast <- ws.Message{
				ClusterID: cluster.ID,
				Type:      "incident",
				Payload: gin.H{
					"id":      incident.ID,
					"ts":      incident.Timestamp.Format("15:04:05"),
					"title":   incident.Title,
					"level":   incident.Level,
					"desc":    incident.Desc,
					"service": incident.Service,
				},
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

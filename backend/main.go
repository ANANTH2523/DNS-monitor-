package main

import (
	"log"

	"github.com/dns-sentinel/backend/database"
	"github.com/dns-sentinel/backend/routes"
	"github.com/dns-sentinel/backend/ws"
	"github.com/gin-gonic/gin"
)

func main() {
	// Initialize SQLite Database
	database.InitDB()

	// Start WebSocket Hub
	go ws.DefaultHub.Run()

	r := gin.Default()

	// Apply permissive CORS for development
	r.Use(routes.CORSMiddleware())

	// Health Check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	// REST APIs
	api := r.Group("/api")
	{
		api.POST("/auth/register", routes.Register)
		api.POST("/auth/login", routes.Login)
		api.GET("/auth/me", routes.Me)

		api.POST("/clusters", routes.CreateCluster)
		
		// Telemetry Ingestion from Sidecar Agent
		api.POST("/telemetry/ingest", routes.TelemetryIngest)
	}

	// WebSocket Endpoint
	r.GET("/ws", ws.ServeWS)

	log.Println("Starting Go Telemetry Backend on :3001")
	r.Run(":3001")
}

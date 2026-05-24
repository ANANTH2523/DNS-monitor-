package database

import (
	"log"

	"github.com/dns-sentinel/backend/models"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func InitDB() {
	var err error
	DB, err = gorm.Open(sqlite.Open("dns_sentinel.db"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		log.Fatalf("Failed to connect to SQLite: %v", err)
	}

	err = models.AutoMigrate(DB)
	if err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	// Pre-seed default org/cluster if DB is empty
	var count int64
	DB.Model(&models.Organization{}).Count(&count)
	if count == 0 {
		org := models.Organization{ID: "org-default", Name: "Default Organization"}
		DB.Create(&org)
		user := models.User{ID: "user-default", OrgID: "org-default", Email: "admin@dns-sentinel.local", Password: "hashed"}
		DB.Create(&user)
		cluster := models.Cluster{ID: "cluster-default", OrgID: "org-default", Name: "Local KIND Cluster", Profile: "development", Token: "ag_mock_token"}
		DB.Create(&cluster)
	}

	log.Println("Database initialized successfully.")
}

func GetDB() *gorm.DB {
	return DB
}

func CleanupDB() {
	// Clean up old events (e.g. keep last 100,000 or last 24h) if needed
	// This runs in a background goroutine
}

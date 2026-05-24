package models

import (
	"time"

	"gorm.io/gorm"
)

type Organization struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`

	Users    []User    `json:"users" gorm:"foreignKey:OrgID"`
	Clusters []Cluster `json:"clusters" gorm:"foreignKey:OrgID"`
}

type User struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	OrgID     string    `json:"orgId" gorm:"index"`
	Email     string    `json:"email" gorm:"uniqueIndex"`
	Password  string    `json:"-"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type Cluster struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	OrgID     string    `json:"orgId" gorm:"index"`
	Name      string    `json:"name"`
	Profile   string    `json:"profile"` // "production", "staging", "development"
	Token     string    `json:"token" gorm:"uniqueIndex"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`

	Events    []DnsEvent `json:"-" gorm:"foreignKey:ClusterID"`
	Incidents []Incident `json:"-" gorm:"foreignKey:ClusterID"`
}

type DnsEvent struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	ClusterID string    `json:"clusterId" gorm:"index"`
	Timestamp time.Time `json:"ts"`
	Namespace string    `json:"namespace"`
	Pod       string    `json:"pod"`
	Domain    string    `json:"domain"`
	Type      string    `json:"type"`
	Latency   int       `json:"latency"` // in milliseconds
	Rcode     string    `json:"rcode"`
	Status    string    `json:"status"` // "OK" or "ERROR"
	CreatedAt time.Time `json:"createdAt" gorm:"index"`
}

type Incident struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	ClusterID string    `json:"clusterId" gorm:"index"`
	Timestamp time.Time `json:"ts"`
	Title     string    `json:"title"`
	Level     string    `json:"level"` // "warning", "critical", "info"
	Desc      string    `json:"desc"`
	Service   string    `json:"service"`
	Resolved  bool      `json:"resolved"`
	CreatedAt time.Time `json:"createdAt"`
}

type ClusterMetrics struct {
	TotalQueries uint    `json:"totalQueries"`
	Failures     uint    `json:"failures"`
	HealthScore  float64 `json:"healthScore"`
	P50Latency   float64 `json:"p50"`
	P95Latency   float64 `json:"p95"`
	P99Latency   float64 `json:"p99"`
	Throughput   float64 `json:"throughput"`
	CacheHitRate float64 `json:"cacheHitRate"`
	ThreatScore  float64 `json:"threatScore"`
	FailureRate  float64 `json:"failureRate"`
}

func AutoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&Organization{},
		&User{},
		&Cluster{},
		&DnsEvent{},
		&Incident{},
	)
}

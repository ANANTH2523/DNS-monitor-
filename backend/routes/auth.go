package routes

import (
	"net/http"
	"time"

	"github.com/dns-sentinel/backend/database"
	"github.com/dns-sentinel/backend/models"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

var JwtSecret = []byte("hackathon_super_secret_dns_sentinel")

type RegisterPayload struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
	OrgName  string `json:"orgName" binding:"required"`
}

func Register(c *gin.Context) {
	var payload RegisterPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	db := database.GetDB()

	// Hash password
	hashed, err := bcrypt.GenerateFromPassword([]byte(payload.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	// Create Org
	org := models.Organization{
		ID:   uuid.New().String(),
		Name: payload.OrgName,
	}
	if err := db.Create(&org).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create organization"})
		return
	}

	// Create default Cluster
	cluster := models.Cluster{
		ID:      uuid.New().String(),
		OrgID:   org.ID,
		Name:    "production-cluster",
		Profile: "production",
		Token:   "ag_" + uuid.New().String(),
	}
	db.Create(&cluster)

	// Create User
	user := models.User{
		ID:       uuid.New().String(),
		OrgID:    org.ID,
		Email:    payload.Email,
		Password: string(hashed),
	}
	if err := db.Create(&user).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email already exists"})
		return
	}

	// Generate JWT
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"userId": user.ID,
		"orgId":  org.ID,
		"exp":    time.Now().Add(24 * 7 * time.Hour).Unix(),
	})
	tokenString, _ := token.SignedString(JwtSecret)

	c.JSON(http.StatusOK, gin.H{
		"token": tokenString,
		"user": gin.H{
			"id":    user.ID,
			"email": user.Email,
		},
		"org": gin.H{
			"id":   org.ID,
			"name": org.Name,
		},
		"cluster": gin.H{
			"id":      cluster.ID,
			"name":    cluster.Name,
			"profile": cluster.Profile,
			"token":   cluster.Token,
			"status":  "simulated", // frontend expects this property
		},
	})
}

type LoginPayload struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

func Login(c *gin.Context) {
	var payload LoginPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	db := database.GetDB()
	var user models.User
	if err := db.Where("email = ?", payload.Email).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(payload.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	var org models.Organization
	db.Where("id = ?", user.OrgID).First(&org)

	var clusters []models.Cluster
	db.Where("org_id = ?", org.ID).Find(&clusters)

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"userId": user.ID,
		"orgId":  org.ID,
		"exp":    time.Now().Add(24 * 7 * time.Hour).Unix(),
	})
	tokenString, _ := token.SignedString(JwtSecret)

	// Format clusters for frontend
	formattedClusters := make([]map[string]interface{}, len(clusters))
	for i, cls := range clusters {
		formattedClusters[i] = map[string]interface{}{
			"id":      cls.ID,
			"name":    cls.Name,
			"profile": cls.Profile,
			"token":   cls.Token,
			"status":  "simulated",
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"token": tokenString,
		"user": gin.H{
			"id":    user.ID,
			"email": user.Email,
		},
		"org": gin.H{
			"id":   org.ID,
			"name": org.Name,
		},
		"clusters": formattedClusters,
	})
}

func Me(c *gin.Context) {
	// Dummy implementation for /api/auth/me based on a valid token.
	// In production, parse the token and extract userId.
	// To save time, returning mock for hackathon or skipping actual validation here.
	// We'll implement a simple validator.
	authHeader := c.GetHeader("Authorization")
	if len(authHeader) < 8 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	tokenString := authHeader[7:]
	
	token, err := jwt.Parse(tokenString, func(t *jwt.Token) (interface{}, error) {
		return JwtSecret, nil
	})
	
	if err != nil || !token.Valid {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	
	claims, _ := token.Claims.(jwt.MapClaims)
	userId := claims["userId"].(string)
	orgId := claims["orgId"].(string)
	
	db := database.GetDB()
	var user models.User
	var org models.Organization
	var clusters []models.Cluster
	
	db.Where("id = ?", userId).First(&user)
	db.Where("id = ?", orgId).First(&org)
	db.Where("org_id = ?", orgId).Find(&clusters)

	formattedClusters := make([]map[string]interface{}, len(clusters))
	for i, cls := range clusters {
		formattedClusters[i] = map[string]interface{}{
			"id":      cls.ID,
			"name":    cls.Name,
			"profile": cls.Profile,
			"token":   cls.Token,
			"status":  "simulated",
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"user": gin.H{"id": user.ID, "email": user.Email},
		"org":  gin.H{"id": org.ID, "name": org.Name},
		"clusters": formattedClusters,
	})
}

// CORSMiddleware adds permissive CORS headers
func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

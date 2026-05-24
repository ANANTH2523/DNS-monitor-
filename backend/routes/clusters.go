package routes

import (
	"net/http"

	"github.com/dns-sentinel/backend/database"
	"github.com/dns-sentinel/backend/models"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type CreateClusterPayload struct {
	Name string `json:"name" binding:"required"`
}

func CreateCluster(c *gin.Context) {
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
	orgId := claims["orgId"].(string)

	var payload CreateClusterPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	cluster := models.Cluster{
		ID:      uuid.New().String(),
		OrgID:   orgId,
		Name:    payload.Name,
		Profile: "development",
		Token:   "ag_" + uuid.New().String(),
	}

	db := database.GetDB()
	if err := db.Create(&cluster).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create cluster"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"cluster": gin.H{
			"id":      cluster.ID,
			"name":    cluster.Name,
			"profile": cluster.Profile,
			"token":   cluster.Token,
			"status":  "simulated",
		},
	})
}

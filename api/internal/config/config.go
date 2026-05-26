package config

import (
	"fmt"
	"os"
)

type Config struct {
	Port               string
	DatabaseURL        string
	JWTSecret          string
	BGGAPIBaseURL      string
	BGGAPIToken        string
	BGGUsername        string
	BGGPassword        string
	AppEnv             string
	AllowedOrigin      string
	GoogleClientID     string
	GoogleClientSecret string
	GoogleRedirectURL  string
	FrontendURL        string
}

func Load() (*Config, error) {
	cfg := &Config{
		Port:               getEnv("PORT", "8080"),
		DatabaseURL:        os.Getenv("DATABASE_URL"),
		JWTSecret:          os.Getenv("JWT_SECRET"),
		BGGAPIBaseURL:      getEnv("BGG_API_BASE_URL", "https://boardgamegeek.com/xmlapi2"),
		BGGAPIToken:        os.Getenv("BGG_API_TOKEN"),
		BGGUsername:        os.Getenv("BGG_USERNAME"),
		BGGPassword:        os.Getenv("BGG_PASSWORD"),
		AppEnv:             getEnv("APP_ENV", "development"),
		AllowedOrigin:      os.Getenv("ALLOWED_ORIGIN"),
		GoogleClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
		GoogleClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
		GoogleRedirectURL:  os.Getenv("GOOGLE_REDIRECT_URL"),
		FrontendURL:        getEnv("FRONTEND_URL", "http://localhost:5173"),
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}
	if cfg.JWTSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET is required")
	}

	return cfg, nil
}

func (c *Config) IsProd() bool {
	return c.AppEnv == "production"
}

// AllowedOrigins returns the list of origins permitted for CORS.
// In dev, all origins are allowed. In prod, uses ALLOWED_ORIGIN if set,
// otherwise falls back to FRONTEND_URL (same value already required for OAuth).
func (c *Config) AllowedOrigins() []string {
	if !c.IsProd() {
		return []string{"*"}
	}
	if c.AllowedOrigin != "" {
		return []string{c.AllowedOrigin}
	}
	return []string{c.FrontendURL}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

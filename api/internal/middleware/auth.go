package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/yourusername/table-night/internal/auth"
	"github.com/yourusername/table-night/internal/respond"
)

type contextKey string

const UserClaimsKey contextKey = "user_claims"

// Authenticate validates the Bearer token and injects claims into the request context.
func Authenticate(authSvc *auth.Service) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			if !strings.HasPrefix(header, "Bearer ") {
				respond.Error(w, http.StatusUnauthorized, "missing or invalid authorization header")
				return
			}

			tokenStr := strings.TrimPrefix(header, "Bearer ")
			claims, err := authSvc.ValidateToken(tokenStr)
			if err != nil {
				respond.Error(w, http.StatusUnauthorized, "invalid or expired token")
				return
			}

			ctx := context.WithValue(r.Context(), UserClaimsKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// ClaimsFromContext retrieves the JWT claims injected by Authenticate.
func ClaimsFromContext(ctx context.Context) *auth.Claims {
	claims, _ := ctx.Value(UserClaimsKey).(*auth.Claims)
	return claims
}

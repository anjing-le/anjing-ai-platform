package session

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/anjing-le/anjing-ai-platform/internal/platform/access"
)

const (
	EnvSecret     = "ANJING_SESSION_SECRET"
	defaultSecret = "anjing-ai-platform-dev-session-secret"
	tokenPrefix   = "sess_"
)

type Manager struct {
	secret  []byte
	ttl     time.Duration
	now     func() time.Time
	mu      sync.RWMutex
	revoked map[string]time.Time
}

type Session struct {
	Token     string           `json:"token"`
	Principal access.Principal `json:"principal"`
	ExpiresAt string           `json:"expiresAt"`
}

type tokenPayload struct {
	Subject string      `json:"sub"`
	Role    access.Role `json:"role"`
	Method  string      `json:"method,omitempty"`
	Issued  int64       `json:"iat"`
	Expires int64       `json:"exp"`
	ID      string      `json:"jti"`
}

func NewManagerFromEnv(ttl time.Duration) *Manager {
	return NewManager(os.Getenv(EnvSecret), ttl)
}

func NewManager(secret string, ttl time.Duration) *Manager {
	if strings.TrimSpace(secret) == "" {
		secret = defaultSecret
	}
	if ttl <= 0 {
		ttl = 12 * time.Hour
	}

	return &Manager{
		secret:  []byte(secret),
		ttl:     ttl,
		now:     time.Now,
		revoked: make(map[string]time.Time),
	}
}

func (manager *Manager) Create(subject string, role access.Role) (Session, error) {
	return manager.CreateWithMethod(subject, role, "session")
}

func (manager *Manager) CreateWithMethod(subject string, role access.Role, method string) (Session, error) {
	subject = strings.TrimSpace(subject)
	if subject == "" {
		return Session{}, fmt.Errorf("subject is required")
	}
	if !validRole(role) {
		return Session{}, fmt.Errorf("role is invalid")
	}
	method = strings.TrimSpace(method)
	if method == "" {
		method = "session"
	}

	now := manager.now().UTC()
	payload := tokenPayload{
		Subject: subject,
		Role:    role,
		Method:  method,
		Issued:  now.Unix(),
		Expires: now.Add(manager.ttl).Unix(),
		ID:      nonce(),
	}
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return Session{}, fmt.Errorf("marshal session payload: %w", err)
	}

	payloadPart := base64.RawURLEncoding.EncodeToString(payloadBytes)
	signaturePart := manager.sign(payloadPart)
	token := tokenPrefix + payloadPart + "." + signaturePart

	return manager.sessionFromPayload(token, payload), nil
}

func (manager *Manager) Principal(token string) (access.Principal, bool) {
	session, ok := manager.Session(token)
	return session.Principal, ok
}

func (manager *Manager) Session(token string) (Session, bool) {
	payload, ok := manager.parse(token)
	if !ok {
		return Session{}, false
	}

	return manager.sessionFromPayload(token, payload), true
}

func (manager *Manager) Revoke(token string) bool {
	payload, ok := manager.parse(token)
	if !ok {
		return false
	}

	manager.mu.Lock()
	defer manager.mu.Unlock()
	manager.cleanupLocked(manager.now().UTC())
	manager.revoked[payload.ID] = time.Unix(payload.Expires, 0).UTC()
	return true
}

func (manager *Manager) parse(token string) (tokenPayload, bool) {
	token = strings.TrimSpace(token)
	if !strings.HasPrefix(token, tokenPrefix) {
		return tokenPayload{}, false
	}

	parts := strings.SplitN(strings.TrimPrefix(token, tokenPrefix), ".", 2)
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return tokenPayload{}, false
	}

	expected := manager.sign(parts[0])
	if !hmac.Equal([]byte(expected), []byte(parts[1])) {
		return tokenPayload{}, false
	}

	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return tokenPayload{}, false
	}

	var payload tokenPayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return tokenPayload{}, false
	}
	if payload.Subject == "" || payload.ID == "" || !validRole(payload.Role) {
		return tokenPayload{}, false
	}

	now := manager.now().UTC()
	if payload.Expires <= now.Unix() {
		return tokenPayload{}, false
	}

	manager.mu.RLock()
	revokedUntil, revoked := manager.revoked[payload.ID]
	manager.mu.RUnlock()
	if revoked && revokedUntil.After(now) {
		return tokenPayload{}, false
	}

	return payload, true
}

func (manager *Manager) sessionFromPayload(token string, payload tokenPayload) Session {
	method := strings.TrimSpace(payload.Method)
	if method == "" {
		method = "session"
	}

	return Session{
		Token: token,
		Principal: access.Principal{
			Subject: payload.Subject,
			Role:    payload.Role,
			Method:  method,
		},
		ExpiresAt: time.Unix(payload.Expires, 0).UTC().Format(time.RFC3339),
	}
}

func (manager *Manager) sign(payloadPart string) string {
	mac := hmac.New(sha256.New, manager.secret)
	_, _ = mac.Write([]byte(payloadPart))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func (manager *Manager) cleanupLocked(now time.Time) {
	for id, expiresAt := range manager.revoked {
		if !expiresAt.After(now) {
			delete(manager.revoked, id)
		}
	}
}

func validRole(role access.Role) bool {
	switch role {
	case access.RoleAdministrator, access.RoleUser, access.RoleDeveloper, access.RoleOperator:
		return true
	default:
		return false
	}
}

func nonce() string {
	var value [16]byte
	if _, err := rand.Read(value[:]); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(value[:])
}

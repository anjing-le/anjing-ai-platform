package control

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/anjing-le/anjing-ai-platform/internal/platform/access"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/httpjson"
	"github.com/anjing-le/anjing-ai-platform/internal/platform/session"
)

const defaultOAuthStateTTL = 10 * time.Minute

type OAuthProvider struct {
	Name             string      `json:"name"`
	AuthorizationURL string      `json:"authorizationUrl"`
	ClientID         string      `json:"clientId"`
	RedirectURI      string      `json:"redirectUri"`
	Scopes           []string    `json:"scopes"`
	DefaultRole      access.Role `json:"defaultRole"`
	Enabled          bool        `json:"enabled"`
}

type OAuthProviderSummary struct {
	Name        string      `json:"name"`
	Scopes      []string    `json:"scopes"`
	DefaultRole access.Role `json:"defaultRole"`
	Enabled     bool        `json:"enabled"`
}

type OAuthStateStore struct {
	mu     sync.Mutex
	now    func() time.Time
	states map[string]oauthState
}

type oauthState struct {
	Provider   string
	RedirectTo string
	ExpiresAt  time.Time
}

func NewOAuthStateStore() *OAuthStateStore {
	return &OAuthStateStore{
		now:    time.Now,
		states: make(map[string]oauthState),
	}
}

func OAuthProvidersFromEnv() map[string]OAuthProvider {
	name := strings.TrimSpace(os.Getenv("ANJING_OAUTH_PROVIDER"))
	if name == "" {
		name = strings.TrimSpace(os.Getenv("ANJING_OAUTH_NAME"))
	}
	if name == "" {
		return map[string]OAuthProvider{}
	}

	role, ok := parseAccessRole(os.Getenv("ANJING_OAUTH_DEFAULT_ROLE"))
	if !ok {
		role = access.RoleUser
	}

	return normalizeOAuthProviders(map[string]OAuthProvider{
		name: {
			Name:             name,
			AuthorizationURL: os.Getenv("ANJING_OAUTH_AUTHORIZATION_URL"),
			ClientID:         os.Getenv("ANJING_OAUTH_CLIENT_ID"),
			RedirectURI:      os.Getenv("ANJING_OAUTH_REDIRECT_URI"),
			Scopes:           splitOAuthScopes(os.Getenv("ANJING_OAUTH_SCOPES")),
			DefaultRole:      role,
			Enabled:          true,
		},
	})
}

func (store *OAuthStateStore) Create(provider, redirectTo string, ttl time.Duration) (string, time.Time) {
	if ttl <= 0 {
		ttl = defaultOAuthStateTTL
	}

	store.mu.Lock()
	defer store.mu.Unlock()

	now := store.now().UTC()
	store.cleanupLocked(now)

	state := randomOAuthState()
	expiresAt := now.Add(ttl)
	store.states[state] = oauthState{
		Provider:   provider,
		RedirectTo: strings.TrimSpace(redirectTo),
		ExpiresAt:  expiresAt,
	}

	return state, expiresAt
}

func (store *OAuthStateStore) Consume(state string) (oauthState, bool) {
	state = strings.TrimSpace(state)
	if state == "" {
		return oauthState{}, false
	}

	store.mu.Lock()
	defer store.mu.Unlock()

	now := store.now().UTC()
	store.cleanupLocked(now)

	item, ok := store.states[state]
	if !ok || !item.ExpiresAt.After(now) {
		delete(store.states, state)
		return oauthState{}, false
	}

	delete(store.states, state)
	return item, true
}

func authOAuthProvidersHandler(providers map[string]OAuthProvider) http.HandlerFunc {
	summaries := oauthProviderSummaries(providers)

	return func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodGet) {
			return
		}

		httpjson.OK(w, summaries)
	}
}

func authOAuthStartHandler(providers map[string]OAuthProvider, states *OAuthStateStore) http.HandlerFunc {
	type startRequest struct {
		Provider   string `json:"provider"`
		RedirectTo string `json:"redirectTo,omitempty"`
	}

	type startResponse struct {
		Provider         string `json:"provider"`
		AuthorizationURL string `json:"authorizationUrl"`
		State            string `json:"state"`
		ExpiresAt        string `json:"expiresAt"`
	}

	return func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodPost) {
			return
		}

		var req startRequest
		if err := httpjson.Decode(r, &req); err != nil {
			httpjson.BadRequest(w, err.Error())
			return
		}

		provider, ok := resolveOAuthProvider(providers, req.Provider)
		if !ok || !provider.available() {
			httpjson.NotFound(w, "oauth provider is not configured")
			return
		}

		state, expiresAt := states.Create(provider.Name, req.RedirectTo, defaultOAuthStateTTL)
		authorizationURL, err := provider.authorizationURL(state)
		if err != nil {
			httpjson.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
			return
		}

		httpjson.OK(w, startResponse{
			Provider:         provider.Name,
			AuthorizationURL: authorizationURL,
			State:            state,
			ExpiresAt:        expiresAt.Format(time.RFC3339),
		})
	}
}

func authOAuthCallbackHandler(users UserRepository, sessions *session.Manager, providers map[string]OAuthProvider, states *OAuthStateStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !httpjson.RequireMethod(w, r, http.MethodGet) {
			return
		}

		query := r.URL.Query()
		code := strings.TrimSpace(query.Get("code"))
		if code == "" {
			httpjson.BadRequest(w, "code is required")
			return
		}

		state, ok := states.Consume(query.Get("state"))
		if !ok {
			httpjson.Fail(w, http.StatusUnauthorized, "unauthorized", "oauth state is invalid or expired")
			return
		}

		if requestedProvider := strings.TrimSpace(query.Get("provider")); requestedProvider != "" && !strings.EqualFold(requestedProvider, state.Provider) {
			httpjson.BadRequest(w, "oauth provider does not match state")
			return
		}

		provider, ok := resolveOAuthProvider(providers, state.Provider)
		if !ok || !provider.available() {
			httpjson.NotFound(w, "oauth provider is not configured")
			return
		}

		email := strings.TrimSpace(query.Get("email"))
		if email == "" {
			httpjson.BadRequest(w, "email is required until provider userinfo exchange is configured")
			return
		}

		role := strings.TrimSpace(query.Get("role"))
		if role == "" {
			role = string(provider.DefaultRole)
		}

		principal, err := loginPrincipal(r.Context(), users, email, role)
		if err != nil {
			httpjson.Fail(w, http.StatusUnauthorized, "unauthorized", err.Error())
			return
		}

		created, err := sessions.CreateWithMethod(principal.Subject, principal.Role, "oauth")
		if err != nil {
			httpjson.Fail(w, http.StatusInternalServerError, "internal_error", err.Error())
			return
		}

		httpjson.OK(w, created)
	}
}

func normalizeOAuthProviders(providers map[string]OAuthProvider) map[string]OAuthProvider {
	normalized := make(map[string]OAuthProvider, len(providers))
	for key, provider := range providers {
		name := strings.TrimSpace(provider.Name)
		if name == "" {
			name = strings.TrimSpace(key)
		}
		if name == "" {
			continue
		}

		provider.Name = name
		provider.AuthorizationURL = strings.TrimSpace(provider.AuthorizationURL)
		provider.ClientID = strings.TrimSpace(provider.ClientID)
		provider.RedirectURI = strings.TrimSpace(provider.RedirectURI)
		provider.Scopes = normalizeOAuthScopes(provider.Scopes)
		if _, ok := parseAccessRole(string(provider.DefaultRole)); !ok {
			provider.DefaultRole = access.RoleUser
		}

		normalized[strings.ToLower(name)] = provider
	}

	return normalized
}

func resolveOAuthProvider(providers map[string]OAuthProvider, name string) (OAuthProvider, bool) {
	name = strings.TrimSpace(name)
	if name == "" && len(providers) == 1 {
		for _, provider := range providers {
			return provider, true
		}
	}

	provider, ok := providers[strings.ToLower(name)]
	return provider, ok
}

func oauthProviderSummaries(providers map[string]OAuthProvider) []OAuthProviderSummary {
	keys := make([]string, 0, len(providers))
	for key := range providers {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	summaries := make([]OAuthProviderSummary, 0, len(keys))
	for _, key := range keys {
		provider := providers[key]
		summaries = append(summaries, OAuthProviderSummary{
			Name:        provider.Name,
			Scopes:      append([]string(nil), provider.Scopes...),
			DefaultRole: provider.DefaultRole,
			Enabled:     provider.available(),
		})
	}

	return summaries
}

func (provider OAuthProvider) available() bool {
	return provider.Enabled &&
		strings.TrimSpace(provider.AuthorizationURL) != "" &&
		strings.TrimSpace(provider.ClientID) != "" &&
		strings.TrimSpace(provider.RedirectURI) != ""
}

func (provider OAuthProvider) authorizationURL(state string) (string, error) {
	parsed, err := url.Parse(provider.AuthorizationURL)
	if err != nil {
		return "", fmt.Errorf("parse oauth authorization url: %w", err)
	}

	query := parsed.Query()
	query.Set("response_type", "code")
	query.Set("client_id", provider.ClientID)
	query.Set("redirect_uri", provider.RedirectURI)
	query.Set("state", state)
	if len(provider.Scopes) > 0 {
		query.Set("scope", strings.Join(provider.Scopes, " "))
	}
	parsed.RawQuery = query.Encode()

	return parsed.String(), nil
}

func (store *OAuthStateStore) cleanupLocked(now time.Time) {
	for state, item := range store.states {
		if !item.ExpiresAt.After(now) {
			delete(store.states, state)
		}
	}
}

func normalizeOAuthScopes(scopes []string) []string {
	seen := map[string]struct{}{}
	normalized := make([]string, 0, len(scopes))
	for _, scope := range scopes {
		scope = strings.TrimSpace(scope)
		if scope == "" {
			continue
		}
		if _, ok := seen[scope]; ok {
			continue
		}
		seen[scope] = struct{}{}
		normalized = append(normalized, scope)
	}
	return normalized
}

func splitOAuthScopes(raw string) []string {
	fields := strings.FieldsFunc(raw, func(r rune) bool {
		return r == ',' || r == ' ' || r == '\n' || r == '\t'
	})
	return normalizeOAuthScopes(fields)
}

func randomOAuthState() string {
	var value [16]byte
	if _, err := rand.Read(value[:]); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(value[:])
}

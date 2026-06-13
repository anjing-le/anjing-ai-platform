package consoleweb

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/anjing-le/anjing-ai-platform/internal/platform/httpjson"
)

func Register(mux *http.ServeMux, staticDir string) {
	mux.HandleFunc("/", Handler(staticDir))
}

func Handler(staticDir string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			httpjson.MethodNotAllowed(w)
			return
		}

		indexPath := filepath.Join(staticDir, "index.html")
		if _, err := os.Stat(indexPath); err != nil {
			httpjson.OK(w, map[string]any{
				"service":   "console-web",
				"status":    "static dir not built",
				"staticDir": staticDir,
				"hint":      "run pnpm build:console first",
			})
			return
		}

		requestPath := strings.TrimPrefix(filepath.Clean(r.URL.Path), "/")
		if requestPath == "." || requestPath == "" {
			http.ServeFile(w, r, indexPath)
			return
		}

		filePath := filepath.Join(staticDir, requestPath)
		if info, err := os.Stat(filePath); err == nil && !info.IsDir() {
			http.ServeFile(w, r, filePath)
			return
		}

		http.ServeFile(w, r, indexPath)
	}
}

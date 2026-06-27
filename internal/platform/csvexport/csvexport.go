package csvexport

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"net/http"
)

func Write(w http.ResponseWriter, filename string, header []string, rows [][]string) error {
	var buffer bytes.Buffer
	writer := csv.NewWriter(&buffer)

	if err := writer.Write(header); err != nil {
		return fmt.Errorf("write csv header: %w", err)
	}
	for _, row := range rows {
		if err := writer.Write(row); err != nil {
			return fmt.Errorf("write csv row: %w", err)
		}
	}
	writer.Flush()
	if err := writer.Error(); err != nil {
		return fmt.Errorf("flush csv: %w", err)
	}

	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	if filename != "" {
		w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	}
	w.WriteHeader(http.StatusOK)
	_, err := w.Write(buffer.Bytes())
	return err
}

package httpjson

import (
	"encoding/json"
	"errors"
	"net/http"
)

type Response struct {
	Success bool   `json:"success"`
	Data    any    `json:"data,omitempty"`
	Error   *Error `json:"error,omitempty"`
}

type Error struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func OK(w http.ResponseWriter, data any) {
	Write(w, http.StatusOK, Response{Success: true, Data: data})
}

func Created(w http.ResponseWriter, data any) {
	Write(w, http.StatusCreated, Response{Success: true, Data: data})
}

func NoContent(w http.ResponseWriter) {
	w.WriteHeader(http.StatusNoContent)
}

func BadRequest(w http.ResponseWriter, message string) {
	Fail(w, http.StatusBadRequest, "bad_request", message)
}

func NotFound(w http.ResponseWriter, message string) {
	Fail(w, http.StatusNotFound, "not_found", message)
}

func MethodNotAllowed(w http.ResponseWriter) {
	Fail(w, http.StatusMethodNotAllowed, "method_not_allowed", "method is not allowed")
}

func Fail(w http.ResponseWriter, status int, code, message string) {
	Write(w, status, Response{
		Success: false,
		Error:   &Error{Code: code, Message: message},
	})
}

func Write(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func Decode(r *http.Request, target any) error {
	if r.Body == nil {
		return errors.New("request body is empty")
	}
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	return decoder.Decode(target)
}

func RequireMethod(w http.ResponseWriter, r *http.Request, methods ...string) bool {
	for _, method := range methods {
		if r.Method == method {
			return true
		}
	}
	MethodNotAllowed(w)
	return false
}

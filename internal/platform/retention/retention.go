package retention

import (
	"errors"
	"time"
)

const (
	DefaultOlderThanDays = 30
	MaxOlderThanDays     = 3650
)

var ErrInvalidOlderThanDays = errors.New("olderThanDays must be between 0 and 3650")

type PurgeRequest struct {
	OlderThanDays *int `json:"olderThanDays"`
}

type PurgeResult struct {
	Deleted       int `json:"deleted"`
	Retained      int `json:"retained"`
	OlderThanDays int `json:"olderThanDays"`
}

func ResolveOlderThanDays(value *int) (int, error) {
	olderThanDays := DefaultOlderThanDays
	if value != nil {
		olderThanDays = *value
	}
	if olderThanDays < 0 || olderThanDays > MaxOlderThanDays {
		return 0, ErrInvalidOlderThanDays
	}
	return olderThanDays, nil
}

func Cutoff(olderThanDays int) time.Time {
	return time.Now().UTC().AddDate(0, 0, -olderThanDays)
}

func Result(deleted, retained, olderThanDays int) PurgeResult {
	return PurgeResult{
		Deleted:       deleted,
		Retained:      retained,
		OlderThanDays: olderThanDays,
	}
}

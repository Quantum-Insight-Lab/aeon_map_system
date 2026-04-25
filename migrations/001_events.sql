-- Append-only события (контракт см. docs/SPEC/events.md, vibepp events.contract)

CREATE TABLE IF NOT EXISTS events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  actor JSONB NOT NULL,
  subject JSONB NOT NULL,
  payload JSONB NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  schema_version INT NOT NULL DEFAULT 1,
  causation_id UUID NULL,
  correlation_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_type ON events (event_type);
CREATE INDEX IF NOT EXISTS idx_events_occurred ON events (occurred_at);

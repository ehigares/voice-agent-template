CREATE TABLE IF NOT EXISTS calls (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vapi_call_id      TEXT NOT NULL UNIQUE,
  agent_id          UUID REFERENCES agent_configs(id),
  caller_id         UUID REFERENCES callers(id),
  phone_number      TEXT NOT NULL,
  direction         TEXT NOT NULL DEFAULT 'inbound',
  status            TEXT NOT NULL DEFAULT 'in-progress',
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at          TIMESTAMPTZ,
  duration_seconds  INT,
  recording_url     TEXT,
  s3_key            TEXT,
  cost_cents        INT,
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_calls_vapi_id ON calls(vapi_call_id);
CREATE INDEX idx_calls_phone ON calls(phone_number);
CREATE INDEX idx_calls_agent ON calls(agent_id);
CREATE INDEX idx_calls_caller ON calls(caller_id);

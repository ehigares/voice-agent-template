CREATE TABLE IF NOT EXISTS callers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone_number    TEXT NOT NULL UNIQUE,
  name            TEXT,
  email           TEXT,
  mem0_user_id    TEXT,
  tags            TEXT[] NOT NULL DEFAULT '{}',
  notes           TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  first_call_at   TIMESTAMPTZ,
  last_call_at    TIMESTAMPTZ,
  total_calls     INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_callers_phone ON callers(phone_number);
CREATE INDEX idx_callers_mem0 ON callers(mem0_user_id);

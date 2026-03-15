CREATE TABLE IF NOT EXISTS agent_configs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  industry        TEXT NOT NULL DEFAULT 'general',
  description     TEXT NOT NULL DEFAULT '',
  vapi_agent_id   TEXT,
  vapi_config     JSONB NOT NULL DEFAULT '{}',
  system_prompt   TEXT NOT NULL DEFAULT '',
  model           TEXT NOT NULL DEFAULT 'claude-haiku-4-5-20251001',
  voice_provider  TEXT NOT NULL DEFAULT 'cartesia',
  voice_id        TEXT NOT NULL DEFAULT '',
  tools           JSONB NOT NULL DEFAULT '[]',
  is_active       BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_configs_name ON agent_configs(name);
CREATE INDEX idx_agent_configs_active ON agent_configs(is_active);

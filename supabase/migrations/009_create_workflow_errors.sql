-- Migration 009: Create workflow_errors table for n8n failure logging.
-- When an n8n workflow fails after all retries, the error is logged here
-- so it can be investigated and the affected call reprocessed.

CREATE TABLE IF NOT EXISTS workflow_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id TEXT,
  workflow TEXT NOT NULL,
  error TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_errors_call_id ON workflow_errors(call_id);
CREATE INDEX IF NOT EXISTS idx_workflow_errors_created_at ON workflow_errors(created_at);

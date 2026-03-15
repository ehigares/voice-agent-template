CREATE TABLE IF NOT EXISTS transcripts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id     UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  speaker     TEXT NOT NULL,
  content     TEXT NOT NULL,
  start_ms    INT NOT NULL DEFAULT 0,
  end_ms      INT NOT NULL DEFAULT 0,
  embedding   VECTOR(1536),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transcripts_call ON transcripts(call_id);
CREATE INDEX idx_transcripts_embedding ON transcripts USING hnsw (embedding vector_cosine_ops);

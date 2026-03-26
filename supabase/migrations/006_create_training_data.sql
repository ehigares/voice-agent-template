CREATE TABLE IF NOT EXISTS training_data (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id          UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  transcript       TEXT NOT NULL,
  tags             TEXT[] NOT NULL DEFAULT '{}',
  sentiment_score  FLOAT,
  quality_score    FLOAT,
  outcome          TEXT,
  notes            TEXT,
  -- Dimension matches text-embedding-3-small (1536). If using a different
  -- model, create a new migration to ALTER this column. See EMBEDDING_DIMENSIONS in .env.example.
  embedding        VECTOR(1536),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_training_call ON training_data(call_id);
CREATE INDEX idx_training_embedding ON training_data USING hnsw (embedding vector_cosine_ops);

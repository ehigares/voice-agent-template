-- Migration 008: Add embedding_model columns to transcripts and training_data.
-- Records which model generated each embedding so stale embeddings can be
-- identified and re-embedded when models change.

ALTER TABLE transcripts
  ADD COLUMN IF NOT EXISTS embedding_model TEXT;

ALTER TABLE training_data
  ADD COLUMN IF NOT EXISTS embedding_model TEXT;

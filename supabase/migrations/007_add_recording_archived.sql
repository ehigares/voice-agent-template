-- Migration 007: Add recording_archived columns to calls table.
-- Tracks whether the recording has been safely uploaded to S3,
-- preventing data loss on workflow retry.

ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS recording_archived BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS recording_archived_at TIMESTAMPTZ;

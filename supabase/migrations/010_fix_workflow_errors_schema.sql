-- Migration 010: Fix workflow_errors schema for databases where 009 already ran.
-- Renames context → metadata and adds level column.
-- Safe to run multiple times (IF EXISTS / IF NOT EXISTS guards).

ALTER TABLE workflow_errors RENAME COLUMN context TO metadata;
ALTER TABLE workflow_errors ADD COLUMN IF NOT EXISTS level TEXT DEFAULT 'error';

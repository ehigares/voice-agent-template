-- Creates the n8n database alongside the application database.
-- Required on first run — without this n8n will fail to start.
-- Uses SELECT ... \gexec because standard PostgreSQL does not support
-- CREATE DATABASE IF NOT EXISTS in init scripts.
SELECT 'CREATE DATABASE n8n_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'n8n_db')\gexec

-- ===========================================
-- ZYPHRON DATABASE INITIALIZATION SCRIPT
-- ===========================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS zyphron;

-- Grant permissions
GRANT ALL PRIVILEGES ON SCHEMA zyphron TO zyphron;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA zyphron TO zyphron;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA zyphron TO zyphron;

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'Zyphron database initialized successfully';
END $$;

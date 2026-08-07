-- Migration: 20240807000000_supabase_foundation_extensions.sql
-- Description: Install required PostgreSQL extensions for Supabase foundation
-- TASK: Module 01 - Supabase Foundation Extensions
-- Depends on: (none - foundation migration)
-- References: DATABASE_LAYER_SCHEMA.md, INFRASTRUCTURE_VALIDATION_CHECKLIST.md

-- ============================================================
-- SECTION 1: REQUIRED POSTGRESQL EXTENSIONS
-- ============================================================

-- pgcrypto: Cryptographic functions for secure data handling
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- uuid-ossp: UUID generation functions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- SECTION 2: EXTENSION VALIDATION
-- ============================================================

-- Verify extensions are installed and accessible
DO $$
BEGIN
    -- Check pgcrypto extension
    IF NOT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto'
    ) THEN
        RAISE EXCEPTION 'pgcrypto extension not installed';
    END IF;
    
    -- Check uuid-ossp extension  
    IF NOT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp'
    ) THEN
        RAISE EXCEPTION 'uuid-ossp extension not installed';
    END IF;
    
    RAISE NOTICE 'All required extensions installed successfully';
END $$;
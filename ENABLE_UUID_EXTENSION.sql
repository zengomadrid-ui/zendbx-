-- ============================================
-- PERMANENT FIX: Enable UUID Extension
-- Run this ONCE in your Render PostgreSQL Shell
-- ============================================

-- This is the ONE-TIME fix that will solve project creation permanently
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Verify it worked
SELECT extname, extversion FROM pg_extension WHERE extname = 'uuid-ossp';

-- You should see:
--  extname   | extversion 
-- -----------+------------
--  uuid-ossp | 1.1
-- (1 row)

-- ============================================
-- HOW TO RUN THIS:
-- ============================================
-- 1. Go to: https://dashboard.render.com
-- 2. Click on your PostgreSQL database
-- 3. Click the "Shell" tab
-- 4. Copy and paste the CREATE EXTENSION command above
-- 5. Press Enter
-- 6. Done! Now project creation will work forever
-- ============================================

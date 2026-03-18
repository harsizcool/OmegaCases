-- Add OmegaCases Plus membership column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS plus BOOLEAN NOT NULL DEFAULT FALSE;

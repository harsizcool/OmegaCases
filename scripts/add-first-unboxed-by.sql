-- Add first_unboxed_by to items table
-- This tracks which user first unboxed this item
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS first_unboxed_by uuid REFERENCES users(id);

-- Garir Dokan Doc Manager - Supabase SQL Schema
-- Run this SQL in your new Supabase Project's SQL Editor (SQL Editor -> New Query)

-- 1. Documents Table (columns: id, data [jsonb], created_at)
CREATE TABLE IF NOT EXISTS public.documents (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Assets Table (columns: id, data [jsonb])
CREATE TABLE IF NOT EXISTS public.assets (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL
);

-- 3. Preferences Table (columns: id, data [jsonb])
CREATE TABLE IF NOT EXISTS public.preferences (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preferences ENABLE ROW LEVEL SECURITY;

-- Allow anonymous access for this client application
CREATE POLICY "Allow public all on documents" ON public.documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on assets" ON public.assets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on preferences" ON public.preferences FOR ALL USING (true) WITH CHECK (true);

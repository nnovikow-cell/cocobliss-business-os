ALTER TABLE public.sales_sessions
  ADD COLUMN IF NOT EXISTS missed_shakes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS missed_paletas integer NOT NULL DEFAULT 0;

-- 1. App settings: shake size in fl oz
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS shake_size_oz numeric NOT NULL DEFAULT 12;

-- 2. Tip options
CREATE TABLE IF NOT EXISTS public.tip_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  kind text NOT NULL DEFAULT 'percent', -- 'percent' | 'fixed'
  amount numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
ALTER TABLE public.tip_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tip_options all authenticated" ON public.tip_options
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_tip_options_updated BEFORE UPDATE ON public.tip_options
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Weather options
CREATE TABLE IF NOT EXISTS public.weather_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
ALTER TABLE public.weather_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "weather_options all authenticated" ON public.weather_options
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_weather_options_updated BEFORE UPDATE ON public.weather_options
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Attendants
CREATE TABLE IF NOT EXISTS public.attendants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
ALTER TABLE public.attendants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendants all authenticated" ON public.attendants
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_attendants_updated BEFORE UPDATE ON public.attendants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Sales sessions: inventory, weather, attendants
ALTER TABLE public.sales_sessions
  ADD COLUMN IF NOT EXISTS shakes_quarts_brought numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paletas_brought integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shake_size_oz_snapshot numeric NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS weather_option_id uuid,
  ADD COLUMN IF NOT EXISTS weather_label_snapshot text,
  ADD COLUMN IF NOT EXISTS attendant_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS attendant_names_snapshot text[] NOT NULL DEFAULT '{}';

-- 6. Sales: tip + sample flag
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS tip_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_sample boolean NOT NULL DEFAULT false;

-- 7. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.tip_options;
ALTER PUBLICATION supabase_realtime ADD TABLE public.weather_options;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendants;

-- 8. Seed sensible defaults (idempotent guard)
INSERT INTO public.weather_options (label, sort_order)
SELECT v.label, v.so FROM (VALUES ('Sunny', 10), ('Cloudy', 20), ('Hot', 30), ('Rainy', 40)) v(label, so)
WHERE NOT EXISTS (SELECT 1 FROM public.weather_options);

INSERT INTO public.tip_options (label, kind, amount, sort_order)
SELECT v.label, v.kind, v.amt, v.so FROM (VALUES
  ('No tip', 'fixed', 0, 5),
  ('10%', 'percent', 10, 10),
  ('15%', 'percent', 15, 20),
  ('20%', 'percent', 20, 30),
  ('$1', 'fixed', 1, 40)
) v(label, kind, amt, so)
WHERE NOT EXISTS (SELECT 1 FROM public.tip_options);

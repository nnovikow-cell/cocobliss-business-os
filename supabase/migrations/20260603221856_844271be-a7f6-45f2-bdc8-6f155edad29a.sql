
CREATE TABLE public.discount_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  kind text NOT NULL DEFAULT 'percent',
  amount numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.discount_options TO authenticated;
GRANT ALL ON public.discount_options TO service_role;

ALTER TABLE public.discount_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage discount options"
  ON public.discount_options FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_discount_options_updated_at
  BEFORE UPDATE ON public.discount_options
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.sales
  ADD COLUMN discount_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN discount_label_snapshot text;

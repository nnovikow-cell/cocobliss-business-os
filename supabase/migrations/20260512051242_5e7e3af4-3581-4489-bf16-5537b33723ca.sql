
-- Checklist categories
CREATE TABLE public.checklist_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT 'teal',
  sort_order integer NOT NULL DEFAULT 0,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
ALTER TABLE public.checklist_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checklist_categories all authenticated" ON public.checklist_categories
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_checklist_categories_updated
  BEFORE UPDATE ON public.checklist_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Size enum
CREATE TYPE public.checklist_item_size AS ENUM ('S','M','L');

-- Checklist items
CREATE TABLE public.checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category_id uuid REFERENCES public.checklist_categories(id) ON DELETE SET NULL,
  location_tag text,
  size_tag public.checklist_item_size NOT NULL DEFAULT 'M',
  owner_user_id uuid,
  sort_order integer NOT NULL DEFAULT 0,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checklist_items all authenticated" ON public.checklist_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_checklist_items_updated
  BEFORE UPDATE ON public.checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sessions
CREATE TYPE public.checklist_session_status AS ENUM ('active','closed');

CREATE TABLE public.checklist_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid,
  event_name_snapshot text NOT NULL,
  event_location_snapshot text,
  opened_by uuid NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  status public.checklist_session_status NOT NULL DEFAULT 'active',
  closed_by uuid,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
ALTER TABLE public.checklist_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checklist_sessions readable" ON public.checklist_sessions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "checklist_sessions insertable" ON public.checklist_sessions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = opened_by);
CREATE POLICY "checklist_sessions updatable" ON public.checklist_sessions
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_checklist_sessions_updated
  BEFORE UPDATE ON public.checklist_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Session items (snapshots)
CREATE TABLE public.checklist_session_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.checklist_sessions(id) ON DELETE CASCADE,
  item_id uuid,
  item_name_snapshot text NOT NULL,
  category_id uuid,
  category_name_snapshot text,
  category_color_snapshot text,
  location_snapshot text,
  size_snapshot public.checklist_item_size NOT NULL DEFAULT 'M',
  owner_user_id_snapshot uuid,
  owner_name_snapshot text,
  is_packed boolean NOT NULL DEFAULT false,
  packed_at timestamptz,
  packed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.checklist_session_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checklist_session_items all authenticated" ON public.checklist_session_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_checklist_session_items_updated
  BEFORE UPDATE ON public.checklist_session_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_checklist_session_items_session ON public.checklist_session_items(session_id);

-- Sales linkage
ALTER TABLE public.sales_sessions ADD COLUMN linked_checklist_session_id uuid;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.checklist_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.checklist_session_items;

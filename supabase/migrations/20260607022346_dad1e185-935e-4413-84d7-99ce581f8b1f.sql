ALTER TABLE public.meetings
  ADD COLUMN linked_event_id uuid REFERENCES public.sales_sessions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS meetings_linked_event_id_idx ON public.meetings(linked_event_id);
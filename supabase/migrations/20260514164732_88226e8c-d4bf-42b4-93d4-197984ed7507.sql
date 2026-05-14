-- Tasks module: recurrence_series + tasks
CREATE TABLE public.recurrence_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL,
  owner uuid REFERENCES public.attendants(id) ON DELETE SET NULL,
  note text,
  recurrence_day int NOT NULL CHECK (recurrence_day BETWEEN 0 AND 6),
  created_by uuid REFERENCES public.attendants(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  assigned_day int NOT NULL CHECK (assigned_day BETWEEN 0 AND 6),
  assigned_week date NOT NULL,
  category text NOT NULL,
  owner uuid REFERENCES public.attendants(id) ON DELETE SET NULL,
  note text,
  completed_day int CHECK (completed_day BETWEEN 0 AND 6),
  completed_at timestamptz,
  created_by uuid REFERENCES public.attendants(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_recurring boolean NOT NULL DEFAULT false,
  recurrence_id uuid REFERENCES public.recurrence_series(id) ON DELETE SET NULL,
  recurrence_day int CHECK (recurrence_day BETWEEN 0 AND 6)
);

CREATE INDEX idx_tasks_assigned_week ON public.tasks(assigned_week);
CREATE INDEX idx_tasks_recurrence_id ON public.tasks(recurrence_id);
CREATE UNIQUE INDEX idx_tasks_series_week_day ON public.tasks(recurrence_id, assigned_week, assigned_day) WHERE recurrence_id IS NOT NULL;

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurrence_series ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks all authenticated" ON public.tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "recurrence_series all authenticated" ON public.recurrence_series FOR ALL TO authenticated USING (true) WITH CHECK (true);
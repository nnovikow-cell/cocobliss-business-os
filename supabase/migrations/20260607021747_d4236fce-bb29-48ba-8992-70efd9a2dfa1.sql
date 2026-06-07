ALTER TABLE public.meetings ADD COLUMN topics jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.meetings ADD COLUMN notes text;
UPDATE public.meetings SET topics = CASE WHEN topics_discussed IS NULL OR btrim(topics_discussed) = '' THEN '[]'::jsonb ELSE jsonb_build_array(topics_discussed) END;
ALTER TABLE public.meetings DROP COLUMN topics_discussed;
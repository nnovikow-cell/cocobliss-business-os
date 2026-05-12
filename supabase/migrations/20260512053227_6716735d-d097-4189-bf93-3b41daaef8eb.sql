CREATE POLICY "checklist_sessions admin delete closed"
ON public.checklist_sessions
FOR DELETE
TO authenticated
USING (status = 'closed' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "checklist_session_items admin delete"
ON public.checklist_session_items
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
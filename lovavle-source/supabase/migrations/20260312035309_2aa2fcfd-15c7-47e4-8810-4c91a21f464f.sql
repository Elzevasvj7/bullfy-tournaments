
-- Notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL, -- 'new_ib', 'status_change', 'conditions_update', 'bd_reassign'
  title text NOT NULL,
  message text NOT NULL,
  reference_id text, -- ID of related record (ib_id, report_id, etc.)
  reference_type text, -- 'ib', 'report', etc.
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications (user_id = auth.uid() OR user_id IS NULL for broadcast)
CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL);

-- Users can update (mark read) their own notifications
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL)
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- System can insert notifications (via triggers with SECURITY DEFINER)
CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Index for fast queries
CREATE INDEX idx_notifications_user_read ON public.notifications(user_id, read, created_at DESC);

-- ===========================================
-- TRIGGER: New IB created → notify admins
-- ===========================================
CREATE OR REPLACE FUNCTION public.notify_new_ib()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _admin_id uuid;
BEGIN
  -- Notify all admins and global_admins
  FOR _admin_id IN
    SELECT DISTINCT user_id FROM public.user_roles WHERE role IN ('admin', 'global_admin')
  LOOP
    -- Don't notify the creator
    IF _admin_id != COALESCE(NEW.created_by, '00000000-0000-0000-0000-000000000000') THEN
      INSERT INTO public.notifications (user_id, type, title, message, reference_id, reference_type)
      VALUES (
        _admin_id,
        'new_ib',
        'Nuevo IB registrado',
        'Se registró el IB ' || NEW.nombre_ib || ' por ' || NEW.nombre_bd,
        NEW.id::text,
        'ib'
      );
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_ib
  AFTER INSERT ON public.ibs
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_ib();

-- ===========================================
-- TRIGGER: IB status changed → notify creator BD
-- ===========================================
CREATE OR REPLACE FUNCTION public.notify_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.created_by IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, reference_id, reference_type)
    VALUES (
      NEW.created_by,
      'status_change',
      'Cambio de estado en Deal',
      'El IB ' || NEW.nombre_ib || ' cambió de "' || OLD.status || '" a "' || NEW.status || '"',
      NEW.id::text,
      'ib'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_status_change
  AFTER UPDATE ON public.ibs
  FOR EACH ROW EXECUTE FUNCTION public.notify_status_change();

-- ===========================================
-- TRIGGER: BD reassignment → notify old BD, new BD, and admins
-- ===========================================
CREATE OR REPLACE FUNCTION public.notify_bd_reassign()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _admin_id uuid;
  _ib_name text;
BEGIN
  SELECT nombre_ib INTO _ib_name FROM public.ibs WHERE id = NEW.ib_id;

  -- Notify old BD
  IF NEW.bd_anterior_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, reference_id, reference_type)
    VALUES (NEW.bd_anterior_id, 'bd_reassign', 'IB reasignado', 'El IB ' || COALESCE(_ib_name, '') || ' fue reasignado a ' || NEW.bd_nuevo_nombre, NEW.ib_id::text, 'ib');
  END IF;

  -- Notify new BD
  IF NEW.bd_nuevo_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, reference_id, reference_type)
    VALUES (NEW.bd_nuevo_id, 'bd_reassign', 'Nuevo IB asignado', 'Se te asignó el IB ' || COALESCE(_ib_name, ''), NEW.ib_id::text, 'ib');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_bd_reassign
  AFTER INSERT ON public.ib_bd_history
  FOR EACH ROW EXECUTE FUNCTION public.notify_bd_reassign();

-- ===========================================
-- TRIGGER: Conditions updated (report with _is_update) → notify admins + BD
-- ===========================================
CREATE OR REPLACE FUNCTION public.notify_conditions_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _admin_id uuid;
  _bd_id uuid;
BEGIN
  -- Only for update reports
  IF (NEW.data->>'_is_update')::boolean IS TRUE AND NEW.report_type = 'technical' THEN
    -- Notify admins
    FOR _admin_id IN
      SELECT DISTINCT user_id FROM public.user_roles WHERE role IN ('admin', 'global_admin')
    LOOP
      INSERT INTO public.notifications (user_id, type, title, message, reference_id, reference_type)
      VALUES (
        _admin_id,
        'conditions_update',
        'Condiciones modificadas',
        'Se modificaron las condiciones del IB ' || NEW.nombre_ib || ' (' || NEW.report_number || ')',
        NEW.ib_id::text,
        'ib'
      );
    END LOOP;

    -- Notify the BD who created the IB
    SELECT created_by INTO _bd_id FROM public.ibs WHERE id = NEW.ib_id;
    IF _bd_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, message, reference_id, reference_type)
      VALUES (
        _bd_id,
        'conditions_update',
        'Condiciones actualizadas',
        'Las condiciones del IB ' || NEW.nombre_ib || ' fueron actualizadas (' || NEW.report_number || ')',
        NEW.ib_id::text,
        'ib'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_conditions_update
  AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.notify_conditions_update();

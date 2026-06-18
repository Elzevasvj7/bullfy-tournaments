
-- Update from address in auto_create_ops_queue trigger
CREATE OR REPLACE FUNCTION public.auto_create_ops_queue()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _ops_user RECORD;
  _email_html text;
  _base_url text := 'https://dpfqhwcjyecpnvtchudo.supabase.co';
  _anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwZnFod2NqeWVjcG52dGNodWRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMTAyNzMsImV4cCI6MjA4ODY4NjI3M30.jn-UUyI5p87-j9Bi5biWIvCIxBH3DolY7aldMcj7MdI';
BEGIN
  IF NEW.status = 'submitted' THEN
    INSERT INTO public.ops_queue (ib_id, status)
    VALUES (NEW.id, 'nuevo')
    ON CONFLICT (ib_id) DO NOTHING;

    FOR _ops_user IN
      SELECT DISTINCT ur.user_id
      FROM public.user_roles ur
      WHERE ur.role IN ('operaciones', 'admin_operaciones')
    LOOP
      INSERT INTO public.notifications (user_id, type, title, message, reference_id, reference_type)
      VALUES (
        _ops_user.user_id,
        'ops_new_deal',
        'Nuevo Deal para configurar',
        'El IB ' || NEW.nombre_ib || ' (BD: ' || NEW.nombre_bd || ') requiere configuración.',
        NEW.id::text,
        'ops_queue'
      );
    END LOOP;

    FOR _ops_user IN
      SELECT DISTINCT p.correo
      FROM public.user_roles ur
      JOIN public.profiles p ON p.id = ur.user_id
      WHERE ur.role IN ('operaciones', 'admin_operaciones')
      AND p.correo IS NOT NULL
    LOOP
      _email_html := '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">'
        || '<div style="background:#062B63;padding:20px;text-align:center;"><h1 style="color:#83CBFF;margin:0;">Bullfy IB System</h1></div>'
        || '<div style="padding:24px;background:#ffffff;">'
        || '<h2 style="color:#062B63;">⚙️ Nuevo Deal para Configurar</h2>'
        || '<p>El IB <strong>' || NEW.nombre_ib || '</strong> (BD: ' || NEW.nombre_bd || ') fue enviado y requiere configuración.</p>'
        || '<a href="https://bullfyibsystem.lovable.app/operaciones" style="display:inline-block;background:#146EF5;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;margin-top:12px;">Ver Cola</a>'
        || '</div>'
        || '<div style="background:#f5f5f5;padding:16px;text-align:center;color:#666;font-size:12px;">Bullfy IB System</div></div>';

      PERFORM net.http_post(
        url := _base_url || '/functions/v1/send-transactional-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || _anon_key
        ),
        body := jsonb_build_object(
          'to', _ops_user.correo,
          'subject', '⚙️ Nuevo Deal: ' || NEW.nombre_ib,
          'html', _email_html
        )
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;

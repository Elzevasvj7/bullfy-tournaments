
-- Add welcome_message to sales_agent_status for customizable TwiML greeting
ALTER TABLE public.sales_agent_status
ADD COLUMN welcome_message text DEFAULT 'Gracias por atender, un asesor de Bullfy se comunicará con usted en breve.';

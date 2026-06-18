-- Tabla de símbolos del broker sincronizada desde MetaAPI
CREATE TABLE public.broker_symbols (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol text NOT NULL UNIQUE,
  description text,
  category text,
  base_currency text,
  quote_currency text,
  digits integer,
  contract_size numeric,
  min_volume numeric,
  max_volume numeric,
  volume_step numeric,
  tick_size numeric,
  tick_value numeric,
  enabled boolean NOT NULL DEFAULT true,
  raw_data jsonb,
  last_synced_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_broker_symbols_symbol ON public.broker_symbols(symbol);
CREATE INDEX idx_broker_symbols_category ON public.broker_symbols(category);
CREATE INDEX idx_broker_symbols_enabled ON public.broker_symbols(enabled);

ALTER TABLE public.broker_symbols ENABLE ROW LEVEL SECURITY;

-- Cualquier usuario autenticado puede leer (para que módulos internos los consuman)
CREATE POLICY "Authenticated users can read broker symbols"
  ON public.broker_symbols
  FOR SELECT
  TO authenticated
  USING (true);

-- Solo admins pueden insertar/actualizar/borrar
CREATE POLICY "Admins can insert broker symbols"
  ON public.broker_symbols
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin'));

CREATE POLICY "Admins can update broker symbols"
  ON public.broker_symbols
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin'));

CREATE POLICY "Admins can delete broker symbols"
  ON public.broker_symbols
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin'));

-- Trigger para updated_at
CREATE TRIGGER update_broker_symbols_updated_at
  BEFORE UPDATE ON public.broker_symbols
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Tabla de log de sincronizaciones (para auditoría)
CREATE TABLE public.broker_symbols_sync_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  triggered_by uuid REFERENCES auth.users(id),
  status text NOT NULL,
  symbols_count integer DEFAULT 0,
  inserted_count integer DEFAULT 0,
  updated_count integer DEFAULT 0,
  error_message text,
  duration_ms integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.broker_symbols_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read sync log"
  ON public.broker_symbols_sync_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'global_admin'));

CREATE POLICY "System can insert sync log"
  ON public.broker_symbols_sync_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
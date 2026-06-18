import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_BROKER_GAIN = 4;

export const useBrokerPropSettings = () => {
  return useQuery({
    queryKey: ["broker-prop-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("broker_prop_settings")
        .select("ganancia_broker")
        .eq("id", 1)
        .maybeSingle();

      if (error) throw error;

      return {
        gananciaBroker: data?.ganancia_broker ?? DEFAULT_BROKER_GAIN,
      };
    },
    staleTime: 1000 * 60 * 5,
  });
};
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Users, CheckCircle2 } from "lucide-react";
import type { MasterIBOption } from "../SubIBWizard";

interface Props {
  selectedId: string;
  onSelect: (ib: MasterIBOption) => void;
}

const StepSelectMasterIB = ({ selectedId, onSelect }: Props) => {
  const [ibs, setIbs] = useState<MasterIBOption[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("ibs")
        .select("id, nombre_ib, correo_ib, nombre_bd, modelo_negocio, tipo_acuerdo_brokeraje, lugar_operacion")
        .in("status", ["submitted", "active", "configurado", "en_proceso"])
        .order("nombre_ib");
      setIbs(data ?? []);
      setLoading(false);
    };
    fetch();
  }, []);

  const filtered = ibs.filter(
    (ib) =>
      ib.nombre_ib.toLowerCase().includes(search.toLowerCase()) ||
      ib.correo_ib.toLowerCase().includes(search.toLowerCase()) ||
      ib.nombre_bd.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-display font-bold text-foreground flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Seleccionar Master IB
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          El Sub IB se vinculará a este IB y heredará su configuración de compensación.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, correo o BD..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando IBs...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No se encontraron IBs</p>
      ) : (
        <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
          {filtered.map((ib) => {
            const isSelected = ib.id === selectedId;
            return (
              <button
                key={ib.id}
                onClick={() => onSelect(ib)}
                className={`w-full text-left rounded-lg border p-4 transition-all ${
                  isSelected
                    ? "border-primary bg-primary/10 shadow-gold"
                    : "border-border hover:border-muted-foreground/40 hover:bg-secondary/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-foreground flex items-center gap-2">
                      {ib.nombre_ib}
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-primary" />}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{ib.correo_ib}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-xs font-mono uppercase text-muted-foreground">{ib.nombre_bd}</p>
                    <div className="flex gap-1.5 justify-end">
                      <Badge variant="outline" className="text-[10px]">{ib.modelo_negocio}</Badge>
                      {ib.tipo_acuerdo_brokeraje && (
                        <Badge variant="secondary" className="text-[10px]">{ib.tipo_acuerdo_brokeraje}</Badge>
                      )}
                      <Badge variant="outline" className="text-[10px]">{ib.lugar_operacion}</Badge>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StepSelectMasterIB;

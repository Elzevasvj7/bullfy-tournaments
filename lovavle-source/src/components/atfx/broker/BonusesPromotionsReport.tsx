import { useATFX } from "@/hooks/useATFX";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DataTableATFX, { ColumnDef } from "../DataTableATFX";
import { extractRows, fmtUSD } from "../utils";

const bonusCols: ColumnDef<any>[] = [
  { key: "id", label: "ID" },
  { key: "customer_email", label: "Cliente" },
  { key: "type", label: "Tipo" },
  { key: "amount", label: "Monto", render: (r) => fmtUSD(r.amount) },
  { key: "status", label: "Status" },
  { key: "created_at", label: "Otorgado" },
  { key: "expires_at", label: "Expira" },
];

const promoCols: ColumnDef<any>[] = [
  { key: "id", label: "ID" },
  { key: "name", label: "Nombre" },
  { key: "type", label: "Tipo" },
  { key: "status", label: "Status" },
  { key: "starts_at", label: "Inicia" },
  { key: "ends_at", label: "Termina" },
  { key: "participants_count", label: "Participantes" },
];

export default function BonusesPromotionsReport() {
  const bonuses = useATFX("list_bonuses", { limit: 1000 });
  const promos = useATFX("list_promotions", {});

  return (
    <Tabs defaultValue="bonuses">
      <TabsList>
        <TabsTrigger value="bonuses">Bonos</TabsTrigger>
        <TabsTrigger value="promos">Promociones</TabsTrigger>
      </TabsList>
      <TabsContent value="bonuses" className="mt-4">
        <DataTableATFX data={extractRows(bonuses.data)} columns={bonusCols} loading={bonuses.isLoading} onRefresh={() => bonuses.refetch()} filename="atfx-bonuses" searchKeys={["id", "customer_email", "type", "status"]} />
      </TabsContent>
      <TabsContent value="promos" className="mt-4">
        <DataTableATFX data={extractRows(promos.data)} columns={promoCols} loading={promos.isLoading} onRefresh={() => promos.refetch()} filename="atfx-promotions" searchKeys={["id", "name", "type", "status"]} />
      </TabsContent>
    </Tabs>
  );
}

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import EditableReferenceTable from "@/components/settings/EditableReferenceTable";

const TABS = [
  { value: "geographies", label: "Geografías", table: "accounting_geographies",
    columns: [
      { key: "name", label: "Nombre", type: "text" as const },
      { key: "country_code", label: "País (ISO)", type: "text" as const },
      { key: "city", label: "Ciudad", type: "text" as const },
    ] },
  { value: "expense_categories", label: "Categorías Gasto", table: "accounting_expense_categories",
    columns: [
      { key: "name", label: "Nombre", type: "text" as const },
      { key: "code", label: "Código", type: "text" as const },
    ] },
  { value: "revenue_categories", label: "Categorías Ingreso", table: "accounting_revenue_categories",
    columns: [
      { key: "name", label: "Nombre", type: "text" as const },
      { key: "code", label: "Código", type: "text" as const },
    ] },
  { value: "vendors", label: "Proveedores", table: "accounting_vendors",
    columns: [
      { key: "name", label: "Nombre", type: "text" as const },
      { key: "tax_id", label: "NIT/RFC", type: "text" as const },
      { key: "email", label: "Email", type: "text" as const },
      { key: "phone", label: "Teléfono", type: "text" as const },
    ] },
  { value: "payment_methods", label: "Métodos de pago", table: "accounting_payment_methods",
    columns: [
      { key: "name", label: "Nombre", type: "text" as const },
      { key: "kind", label: "Tipo (cash/bank/crypto)", type: "text" as const },
    ] },
  { value: "cost_centers", label: "Centros de costo", table: "accounting_cost_centers",
    columns: [
      { key: "name", label: "Nombre", type: "text" as const },
      { key: "code", label: "Código", type: "text" as const },
    ] },
];

export default function CatalogosPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Catálogos / Misceláneos</h2>
        <p className="text-muted-foreground text-sm">
          Mantén actualizadas las tablas maestras del sistema contable.
        </p>
      </div>
      <Tabs defaultValue="geographies">
        <TabsList className="flex-wrap h-auto">
          {TABS.map((t) => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}
        </TabsList>
        {TABS.map((t) => (
          <TabsContent key={t.value} value={t.value} className="mt-4">
            <EditableReferenceTable tableName={t.table} columns={t.columns} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

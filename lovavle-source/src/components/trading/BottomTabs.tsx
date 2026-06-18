import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function BottomTabs() {
  return (
    <Tabs defaultValue="positions" className="flex h-full flex-col">
      <TabsList className="h-8 w-fit rounded-none border-b border-border bg-transparent p-0">
        <TabsTrigger value="positions" className="h-8 rounded-none text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary">Posiciones</TabsTrigger>
        <TabsTrigger value="orders" className="h-8 rounded-none text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary">Pendientes</TabsTrigger>
        <TabsTrigger value="history" className="h-8 rounded-none text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary">Historial</TabsTrigger>
        <TabsTrigger value="journal" className="h-8 rounded-none text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary">Journal</TabsTrigger>
      </TabsList>
      <div className="flex-1 overflow-auto">
        <TabsContent value="positions" className="m-0 p-3 text-xs text-muted-foreground">
          Sin posiciones abiertas. Se cargará desde MT5 Bridge en Fase 3.
        </TabsContent>
        <TabsContent value="orders" className="m-0 p-3 text-xs text-muted-foreground">
          Sin órdenes pendientes.
        </TabsContent>
        <TabsContent value="history" className="m-0 p-3 text-xs text-muted-foreground">
          Historial de deals (próximamente).
        </TabsContent>
        <TabsContent value="journal" className="m-0 p-3 text-xs text-muted-foreground">
          Sin actividad registrada.
        </TabsContent>
      </div>
    </Tabs>
  );
}

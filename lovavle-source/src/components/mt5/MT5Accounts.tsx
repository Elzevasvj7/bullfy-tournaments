import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useMT5Connection } from "@/hooks/useMT5Connection";
import { mt5GetAccounts, type MT5Account } from "@/services/mt5Api";
import { useQuery } from "@tanstack/react-query";
import { Users, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const MT5Accounts = () => {
  const { connected } = useMT5Connection();

  const { data: accounts, isLoading, error, refetch } = useQuery<MT5Account[]>({
    queryKey: ["mt5-accounts"],
    queryFn: mt5GetAccounts,
    enabled: connected,
  });

  if (!connected) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <Users className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Conéctate a la API para ver las cuentas MT5.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Cuentas MT5</CardTitle>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-1" /> Actualizar
        </Button>
      </CardHeader>
      <CardContent>
        {error && <p className="text-destructive text-sm mb-4">{(error as Error).message}</p>}

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : !accounts?.length ? (
          <p className="text-muted-foreground text-sm text-center py-8">No se encontraron cuentas.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Login</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Grupo</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Equity</TableHead>
                  <TableHead className="text-right">Leverage</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((acc) => (
                  <TableRow key={acc.id}>
                    <TableCell className="font-mono text-sm">{acc.login}</TableCell>
                    <TableCell>{acc.name}</TableCell>
                    <TableCell className="text-muted-foreground">{acc.group}</TableCell>
                    <TableCell className="text-right font-medium">${acc.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">${acc.equity.toLocaleString("en-US", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">1:{acc.leverage}</TableCell>
                    <TableCell>
                      <Badge variant={acc.status === "active" ? "default" : "secondary"}>
                        {acc.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MT5Accounts;

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/shared/PasswordInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, XCircle, KeyRound, Shield, Ban, UserCheck, Pencil, Trash2, Users, UserX, AlertTriangle, Search, UserPlus } from "lucide-react";

interface ProfileWithRole {
  id: string;
  nombre: string;
  correo: string;
  status: string;
  created_at: string;
  roles: string[];
}

const ALL_ROLES = [
  { value: "bd", label: "Business Developer" },
  { value: "admin_bd", label: "Admin BD" },
  { value: "operaciones", label: "Operaciones" },
  { value: "admin_operaciones", label: "Admin Operaciones" },
  { value: "marketing", label: "Marketing" },
  { value: "admin_ventas", label: "Admin Ventas" },
  { value: "ventas", label: "Ventas" },
  { value: "dealing", label: "Dealing" },
  { value: "admin", label: "Admin" },
  { value: "global_admin", label: "Global Admin" },
  { value: "ib_externo", label: "IB Externo" },
  { value: "bullfy_family", label: "Bullfy Family" },
  { value: "accounting_user", label: "Accounting User" },
  { value: "accountant", label: "Accountant" },
  { value: "directivo", label: "Directivo" },
];

const UsersList = () => {
  const { isGlobalAdmin } = useAuth();
  const [users, setUsers] = useState<ProfileWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [userTab, setUserTab] = useState("activos");
  const [resetDialog, setResetDialog] = useState<{ open: boolean; userId: string; nombre: string }>({ open: false, userId: "", nombre: "" });
  const [newPassword, setNewPassword] = useState("");
  const [roleDialog, setRoleDialog] = useState<{ open: boolean; userId: string; nombre: string; currentRoles: string[] }>({ open: false, userId: "", nombre: "", currentRoles: [] });
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [editDialog, setEditDialog] = useState<{ open: boolean; userId: string; nombre: string; correo: string }>({ open: false, userId: "", nombre: "", correo: "" });
  const [editNombre, setEditNombre] = useState("");
  const [editCorreo, setEditCorreo] = useState("");
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; userId: string; nombre: string }>({ open: false, userId: "", nombre: "" });
  const [deleting, setDeleting] = useState(false);
  const [createDialog, setCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUserNombre, setNewUserNombre] = useState("");
  const [newUserCorreo, setNewUserCorreo] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("bd");

  const handleCreateUser = async () => {
    if (!newUserNombre.trim() || !newUserCorreo.trim() || !newUserPassword || newUserPassword.length < 6 || !newUserRole) {
      toast({ title: "Error", description: "Completa todos los campos. La contraseña debe tener al menos 6 caracteres.", variant: "destructive" });
      return;
    }
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("admin-create-user", {
      body: { email: newUserCorreo.trim(), password: newUserPassword, nombre: newUserNombre.trim(), role: newUserRole },
    });
    setCreating(false);
    if (error || (data as any)?.error) {
      toast({ title: "Error", description: (data as any)?.error || error?.message || "No se pudo crear el usuario", variant: "destructive" });
      return;
    }
    toast({ title: "Usuario creado", description: `${newUserNombre} fue creado con rol ${newUserRole}` });
    setCreateDialog(false);
    setNewUserNombre(""); setNewUserCorreo(""); setNewUserPassword(""); setNewUserRole("bd");
    fetchUsers();
  };

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    const { data: allRoles } = await supabase.from("user_roles").select("user_id, role");

    if (profiles) {
      const mapped = profiles.map((p) => ({
        ...p,
        roles: allRoles?.filter((r) => r.user_id === p.id).map((r) => r.role) || [],
      }));
      setUsers(mapped);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filterBySearch = (list: ProfileWithRole[]) => {
    let filtered = list;
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(u => u.nombre.toLowerCase().includes(q) || u.correo.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") {
      filtered = filtered.filter(u => u.status === statusFilter);
    }
    return filtered;
  };

  const activeUsers = filterBySearch(users.filter((u) => u.status !== "disabled"));
  const disabledUsers = filterBySearch(users.filter((u) => u.status === "disabled"));

  const updateStatus = async (userId: string, status: string) => {
    const { error } = await supabase.from("profiles").update({ status }).eq("id", userId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      const statusMsg = status === "approved" ? "aprobado" : status === "disabled" ? "deshabilitado" : "rechazado";
      toast({ title: "Actualizado", description: `Usuario ${statusMsg}` });
      fetchUsers();
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      toast({ title: "Error", description: "La contraseña debe tener al menos 8 caracteres", variant: "destructive" });
      return;
    }
    const { error } = await supabase.functions.invoke("admin-reset-password", {
      body: { userId: resetDialog.userId, newPassword },
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Contraseña actualizada", description: `Nueva contraseña asignada a ${resetDialog.nombre}` });
    }
    setResetDialog({ open: false, userId: "", nombre: "" });
    setNewPassword("");
  };

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleEditUser = async () => {
    if (!editNombre.trim() || !editCorreo.trim()) {
      toast({ title: "Error", description: "Nombre y correo son requeridos", variant: "destructive" });
      return;
    }
    const { error } = await supabase.functions.invoke("admin-edit-user", {
      body: { userId: editDialog.userId, nombre: editNombre.trim(), correo: editCorreo.trim() },
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Actualizado", description: `Datos de ${editNombre.trim()} actualizados` });
      fetchUsers();
    }
    setEditDialog({ open: false, userId: "", nombre: "", correo: "" });
  };

  const handleChangeRoles = async () => {
    if (selectedRoles.length === 0) {
      toast({ title: "Error", description: "Debe seleccionar al menos un rol", variant: "destructive" });
      return;
    }
    const targetHasGlobalAdmin = roleDialog.currentRoles.includes("global_admin");
    if (targetHasGlobalAdmin && !selectedRoles.includes("global_admin")) {
      toast({ title: "Protección", description: "No se puede remover el rol Global Admin desde esta interfaz", variant: "destructive" });
      return;
    }
    await supabase.from("user_roles").delete().eq("user_id", roleDialog.userId);
    const inserts = selectedRoles.map((role) => ({ user_id: roleDialog.userId, role: role as any }));
    const { error } = await supabase.from("user_roles").insert(inserts);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Roles actualizados", description: `${roleDialog.nombre} ahora tiene ${selectedRoles.length} rol(es)` });
      fetchUsers();
    }
    setRoleDialog({ open: false, userId: "", nombre: "", currentRoles: [] });
    setSelectedRoles([]);
  };

  const handleDeleteUser = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("admin-delete-user", {
        body: { userId: deleteDialog.userId },
      });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Usuario eliminado", description: `${deleteDialog.nombre} ha sido eliminado del sistema` });
        fetchUsers();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Error inesperado", variant: "destructive" });
    } finally {
      setDeleting(false);
      setDeleteDialog({ open: false, userId: "", nombre: "" });
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "approved": return <Badge className="bg-accent/20 text-accent border-accent/30">Aprobado</Badge>;
      case "disabled": return <Badge className="bg-muted text-muted-foreground border-border">Deshabilitado</Badge>;
      case "rejected": return <Badge variant="destructive">Rechazado</Badge>;
      default: return <Badge className="bg-primary/20 text-primary border-primary/30">Pendiente</Badge>;
    }
  };

  const roleBadge = (role: string) => {
    switch (role) {
      case "global_admin": return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Global Admin</Badge>;
      case "admin": return <Badge className="bg-primary/20 text-primary border-primary/30">Admin</Badge>;
      case "admin_operaciones": return <Badge className="bg-accent/20 text-accent border-accent/30">Admin Ops</Badge>;
      case "operaciones": return <Badge className="bg-accent/20 text-accent border-accent/30">Operaciones</Badge>;
      case "marketing": return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Marketing</Badge>;
      case "admin_ventas": return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Admin Ventas</Badge>;
      case "ventas": return <Badge className="bg-teal-500/20 text-teal-400 border-teal-500/30">Ventas</Badge>;
      case "ib_externo": return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">IB Externo</Badge>;
      case "bullfy_family": return <Badge className="bg-pink-500/20 text-pink-400 border-pink-500/30">✨ Bullfy Family</Badge>;
      default: return <Badge className="bg-secondary text-secondary-foreground">BD</Badge>;
    }
  };

  const renderUserTable = (userList: ProfileWithRole[], isDisabledSection = false) => (
    <div className="bg-gradient-card rounded-xl border border-border shadow-card overflow-hidden">
      {userList.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">
          {isDisabledSection ? "No hay usuarios deshabilitados" : "No hay usuarios activos"}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-4 text-muted-foreground font-medium">Nombre</th>
                <th className="text-left p-4 text-muted-foreground font-medium">Correo</th>
                <th className="text-left p-4 text-muted-foreground font-medium">Roles</th>
                <th className="text-left p-4 text-muted-foreground font-medium">Estado</th>
                <th className="text-left p-4 text-muted-foreground font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {userList.map((u) => (
                <tr key={u.id} className="border-b border-border/50 hover:bg-secondary/20">
                  <td className="p-4 text-foreground font-medium">{u.nombre || "—"}</td>
                  <td className="p-4 text-muted-foreground">{u.correo}</td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((r) => <span key={r}>{roleBadge(r)}</span>)}
                    </div>
                  </td>
                  <td className="p-4">{statusBadge(u.status)}</td>
                  <td className="p-4">
                    <div className="flex gap-2 flex-wrap">
                      {u.status === "pending" && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => updateStatus(u.id, "approved")} className="text-accent hover:text-accent gap-1">
                            <CheckCircle className="w-3.5 h-3.5" /> Aprobar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => updateStatus(u.id, "rejected")} className="text-destructive hover:text-destructive gap-1">
                            <XCircle className="w-3.5 h-3.5" /> Rechazar
                          </Button>
                        </>
                      )}
                      {u.status === "approved" && (
                        <Button size="sm" variant="ghost" onClick={() => updateStatus(u.id, "disabled")} className="text-muted-foreground hover:text-destructive gap-1">
                          <Ban className="w-3.5 h-3.5" /> Deshabilitar
                        </Button>
                      )}
                      {(u.status === "rejected" || u.status === "disabled") && (
                        <Button size="sm" variant="ghost" onClick={() => updateStatus(u.id, "approved")} className="text-accent hover:text-accent gap-1">
                          <UserCheck className="w-3.5 h-3.5" /> Habilitar
                        </Button>
                      )}
                      {isGlobalAdmin && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => setResetDialog({ open: true, userId: u.id, nombre: u.nombre })} className="text-primary hover:text-primary gap-1">
                            <KeyRound className="w-3.5 h-3.5" /> Password
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setRoleDialog({ open: true, userId: u.id, nombre: u.nombre, currentRoles: u.roles }); setSelectedRoles([...u.roles]); }} className="text-primary hover:text-primary gap-1">
                            <Shield className="w-3.5 h-3.5" /> Roles
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setEditDialog({ open: true, userId: u.id, nombre: u.nombre, correo: u.correo }); setEditNombre(u.nombre); setEditCorreo(u.correo); }} className="text-primary hover:text-primary gap-1">
                            <Pencil className="w-3.5 h-3.5" /> Editar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setDeleteDialog({ open: true, userId: u.id, nombre: u.nombre })} className="text-destructive hover:text-destructive gap-1">
                            <Trash2 className="w-3.5 h-3.5" /> Eliminar
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <>
      {loading ? (
        <p className="text-muted-foreground">Cargando usuarios...</p>
      ) : (
        <Tabs value={userTab} onValueChange={setUserTab}>
          <div className="flex items-center gap-4 mb-4 flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o correo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="approved">Aprobado</SelectItem>
                <SelectItem value="pending">Pendiente</SelectItem>
                <SelectItem value="rejected">Rechazado</SelectItem>
              </SelectContent>
            </Select>
            <TabsList className="bg-secondary/50 border border-border">
              <TabsTrigger value="activos" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                <Users className="w-4 h-4" /> Activos ({activeUsers.length})
              </TabsTrigger>
              <TabsTrigger value="deshabilitados" className="gap-2 data-[state=active]:bg-muted data-[state=active]:text-muted-foreground">
                <UserX className="w-4 h-4" /> Deshabilitados ({disabledUsers.length})
              </TabsTrigger>
            </TabsList>
            {isGlobalAdmin && (
              <Button onClick={() => setCreateDialog(true)} className="ml-auto gap-2 bg-gradient-gold text-primary-foreground">
                <UserPlus className="w-4 h-4" /> Nuevo Usuario
              </Button>
            )}
          </div>

          <TabsContent value="activos">
            {renderUserTable(activeUsers)}
          </TabsContent>

          <TabsContent value="deshabilitados">
            {renderUserTable(disabledUsers, true)}
          </TabsContent>
        </Tabs>
      )}

      {/* Reset Password Dialog */}
      <Dialog open={resetDialog.open} onOpenChange={(open) => setResetDialog((prev) => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restablecer contraseña de {resetDialog.nombre}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nueva contraseña</Label>
              <PasswordInput value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 8 caracteres" minLength={8} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialog({ open: false, userId: "", nombre: "" })}>Cancelar</Button>
            <Button onClick={handleResetPassword} className="bg-gradient-gold text-primary-foreground">Actualizar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Roles Dialog */}
      <Dialog open={roleDialog.open} onOpenChange={(open) => setRoleDialog((prev) => ({ ...prev, open }))}>
        <DialogContent className="max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Asignar roles a {roleDialog.nombre}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 overflow-y-auto flex-1 pr-2">
            <Label>Selecciona uno o más roles</Label>
            <div className="space-y-3">
              {ALL_ROLES.map((role) => (
                <label key={role.value} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-secondary/30 cursor-pointer transition-colors">
                  <Checkbox
                    checked={selectedRoles.includes(role.value)}
                    onCheckedChange={() => toggleRole(role.value)}
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-foreground">{role.label}</span>
                  </div>
                  {roleBadge(role.value)}
                </label>
              ))}
            </div>
            {selectedRoles.length === 0 && (
              <p className="text-xs text-destructive">Debe seleccionar al menos un rol</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleDialog({ open: false, userId: "", nombre: "", currentRoles: [] })}>Cancelar</Button>
            <Button onClick={handleChangeRoles} disabled={selectedRoles.length === 0} className="bg-gradient-gold text-primary-foreground">Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editDialog.open} onOpenChange={(open) => setEditDialog((prev) => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar datos de {editDialog.nombre}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre completo</Label>
              <Input value={editNombre} onChange={(e) => setEditNombre(e.target.value)} placeholder="Nombre completo" />
            </div>
            <div className="space-y-2">
              <Label>Correo electrónico</Label>
              <Input type="email" value={editCorreo} onChange={(e) => setEditCorreo(e.target.value)} placeholder="correo@ejemplo.com" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog({ open: false, userId: "", nombre: "", correo: "" })}>Cancelar</Button>
            <Button onClick={handleEditUser} className="bg-gradient-gold text-primary-foreground">Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog((prev) => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" /> Eliminar usuario
            </DialogTitle>
            <DialogDescription>
              Esta acción es irreversible. Se eliminará al usuario <strong className="text-foreground">{deleteDialog.nombre}</strong> del sistema, incluyendo su perfil, roles y acceso de autenticación.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-sm text-destructive">
              ⚠️ El usuario no podrá volver a iniciar sesión y todos sus datos de acceso serán eliminados permanentemente.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, userId: "", nombre: "" })} disabled={deleting}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={deleting}>
              {deleting ? "Eliminando..." : "Eliminar definitivamente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog (Global Admin only) */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" /> Crear nuevo usuario
            </DialogTitle>
            <DialogDescription>
              Solo Global Admin puede crear usuarios manualmente con contraseña.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 overflow-y-auto flex-1 pr-2">
            <div className="space-y-2">
              <Label>Nombre completo</Label>
              <Input value={newUserNombre} onChange={(e) => setNewUserNombre(e.target.value)} placeholder="Juan Pérez" />
            </div>
            <div className="space-y-2">
              <Label>Correo electrónico</Label>
              <Input type="email" value={newUserCorreo} onChange={(e) => setNewUserCorreo(e.target.value)} placeholder="usuario@bullfy.com" />
            </div>
            <div className="space-y-2">
              <Label>Contraseña (mín. 6 caracteres)</Label>
              <PasswordInput value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={newUserRole} onValueChange={setNewUserRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un rol" />
                </SelectTrigger>
                <SelectContent>
                  {ALL_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialog(false)} disabled={creating}>Cancelar</Button>
            <Button onClick={handleCreateUser} disabled={creating} className="bg-gradient-gold text-primary-foreground gap-2">
              <UserPlus className="w-4 h-4" /> {creating ? "Creando..." : "Crear usuario"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default UsersList;

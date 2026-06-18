import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toastUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2, Search, Shield, Video, Users, Plus, Check, ChevronsUpDown } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface AccessEntry {
  id: string;
  user_id: string;
  tier: string;
  enabled: boolean;
  can_publish_social: boolean;
  can_auto_clip: boolean;
  can_remove_branding: boolean;
  monthly_clip_limit: number;
  monthly_analysis_limit: number;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  // joined
  user_name?: string;
  user_email?: string;
}

const TIER_DEFAULTS: Record<string, { clips: number; analyses: number; social: boolean; autoClip: boolean; noBrand: boolean }> = {
  free: { clips: 3, analyses: 5, social: false, autoClip: false, noBrand: false },
  pro: { clips: 30, analyses: 50, social: true, autoClip: true, noBrand: false },
  enterprise: { clips: 9999, analyses: 9999, social: true, autoClip: true, noBrand: true },
};

const VideoStudioAccessAdmin = () => {
  const [entries, setEntries] = useState<AccessEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editEntry, setEditEntry] = useState<AccessEntry | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newUserId, setNewUserId] = useState("");
  const [newTier, setNewTier] = useState("free");
  const [saving, setSaving] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, { nombre: string; correo: string }>>({});
  const [allProfiles, setAllProfiles] = useState<{ id: string; nombre: string; correo: string }[]>([]);
  const [userPickerOpen, setUserPickerOpen] = useState(false);

  useEffect(() => {
    fetchEntries();
    fetchAllProfiles();
  }, []);

  const fetchEntries = async () => {
    const { data } = await supabase
      .from("video_studio_access")
      .select("*")
      .order("created_at", { ascending: false });

    const accessData = (data || []) as AccessEntry[];

    // Fetch profile info for all user_ids
    const userIds = accessData.map(a => a.user_id);
    if (userIds.length > 0) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, nombre, correo")
        .in("id", userIds);

      const profileMap: Record<string, { nombre: string; correo: string }> = {};
      (profileData || []).forEach((p: any) => {
        profileMap[p.id] = { nombre: p.nombre, correo: p.correo };
      });
      setProfiles(profileMap);
    }

    setEntries(accessData);
    setLoading(false);
  };

  const fetchAllProfiles = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, nombre, correo")
      .order("nombre");
    setAllProfiles((data || []) as { id: string; nombre: string; correo: string }[]);
  };

  const availableProfiles = useMemo(() => {
    const existingIds = new Set(entries.map(e => e.user_id));
    return allProfiles.filter(p => !existingIds.has(p.id));
  }, [allProfiles, entries]);

  const selectedProfile = allProfiles.find(p => p.id === newUserId);

  const handleToggle = async (entry: AccessEntry, field: keyof Pick<AccessEntry, "enabled" | "can_publish_social" | "can_auto_clip" | "can_remove_branding">, value: boolean) => {
    const updatePayload: any = { [field]: value };
    const { error } = await supabase
      .from("video_studio_access")
      .update(updatePayload)
      .eq("id", entry.id);

    if (error) {
      toast.error("Error: " + error.message);
    } else {
      toast.success("Actualizado");
      fetchEntries();
    }
  };

  const handleTierChange = async (entry: AccessEntry, tier: string) => {
    const defaults = TIER_DEFAULTS[tier];
    const { error } = await supabase
      .from("video_studio_access")
      .update({
        tier,
        monthly_clip_limit: defaults.clips,
        monthly_analysis_limit: defaults.analyses,
        can_publish_social: defaults.social,
        can_auto_clip: defaults.autoClip,
        can_remove_branding: defaults.noBrand,
      })
      .eq("id", entry.id);

    if (error) {
      toast.error("Error: " + error.message);
    } else {
      toast.success(`Tier actualizado a ${tier}`);
      fetchEntries();
    }
  };

  const handleAdd = async () => {
    if (!newUserId.trim()) {
      toast.error("Ingresa un User ID");
      return;
    }
    setSaving(true);
    const defaults = TIER_DEFAULTS[newTier];
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from("video_studio_access").insert({
      user_id: newUserId.trim(),
      tier: newTier,
      enabled: true,
      monthly_clip_limit: defaults.clips,
      monthly_analysis_limit: defaults.analyses,
      can_publish_social: defaults.social,
      can_auto_clip: defaults.autoClip,
      can_remove_branding: defaults.noBrand,
      approved_by: user?.id || null,
      approved_at: new Date().toISOString(),
    });

    if (error) {
      if (error.code === "23505") toast.error("Este usuario ya tiene acceso configurado");
      else toast.error("Error: " + error.message);
    } else {
      toast.success("Acceso creado");
      setAddOpen(false);
      setNewUserId("");
      fetchEntries();
    }
    setSaving(false);
  };

  const tierBadge = (tier: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      free: "outline",
      pro: "secondary",
      enterprise: "default",
    };
    return <Badge variant={variants[tier] || "outline"}>{tier.toUpperCase()}</Badge>;
  };

  const filtered = entries.filter(e => {
    if (!search) return true;
    const q = search.toLowerCase();
    const p = profiles[e.user_id];
    return (
      e.user_id.toLowerCase().includes(q) ||
      (p?.nombre?.toLowerCase().includes(q)) ||
      (p?.correo?.toLowerCase().includes(q))
    );
  });

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Control de Acceso — Video Studio
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Gestiona los niveles y permisos de cada usuario</p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="gap-1.5">
          <Plus className="w-4 h-4" /> Agregar Acceso
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {["free", "pro", "enterprise"].map(tier => (
          <Card key={tier}>
            <CardContent className="pt-4 flex items-center gap-3">
              <Video className="w-5 h-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{entries.filter(e => e.tier === tier && e.enabled).length}</p>
                <p className="text-sm text-muted-foreground">{tier.charAt(0).toUpperCase() + tier.slice(1)} activos</p>
              </div>
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <Users className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{entries.filter(e => !e.enabled).length}</p>
              <p className="text-sm text-muted-foreground">Deshabilitados</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar por nombre o correo..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead className="text-center">Habilitado</TableHead>
              <TableHead className="text-center">Clips/mes</TableHead>
              <TableHead className="text-center">Análisis/mes</TableHead>
              <TableHead className="text-center">Social</TableHead>
              <TableHead className="text-center">Auto-Clip</TableHead>
              <TableHead className="text-center">Sin Marca</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No hay usuarios con acceso configurado
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(entry => {
                const p = profiles[entry.user_id];
                return (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{p?.nombre || "—"}</p>
                        <p className="text-xs text-muted-foreground">{p?.correo || entry.user_id.slice(0, 8)}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select value={entry.tier} onValueChange={v => handleTierChange(entry, v)}>
                        <SelectTrigger className="h-8 w-28 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free">Free</SelectItem>
                          <SelectItem value="pro">Pro</SelectItem>
                          <SelectItem value="enterprise">Enterprise</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch checked={entry.enabled} onCheckedChange={v => handleToggle(entry, "enabled", v)} />
                    </TableCell>
                    <TableCell className="text-center text-sm font-mono">{entry.monthly_clip_limit}</TableCell>
                    <TableCell className="text-center text-sm font-mono">{entry.monthly_analysis_limit}</TableCell>
                    <TableCell className="text-center">
                      <Switch checked={entry.can_publish_social} onCheckedChange={v => handleToggle(entry, "can_publish_social", v)} />
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch checked={entry.can_auto_clip} onCheckedChange={v => handleToggle(entry, "can_auto_clip", v)} />
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch checked={entry.can_remove_branding} onCheckedChange={v => handleToggle(entry, "can_remove_branding", v)} />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) { setNewUserId(""); setNewTier("free"); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar Acceso Video Studio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Usuario</Label>
              <Popover open={userPickerOpen} onOpenChange={setUserPickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={userPickerOpen} className="w-full justify-between font-normal">
                    {selectedProfile
                      ? `${selectedProfile.nombre || "Sin nombre"} — ${selectedProfile.correo || ""}`
                      : "Seleccionar usuario..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar por nombre o correo..." />
                    <CommandList>
                      <CommandEmpty>No se encontraron usuarios.</CommandEmpty>
                      <CommandGroup className="max-h-60 overflow-auto">
                        {availableProfiles.map(p => (
                          <CommandItem
                            key={p.id}
                            value={`${p.nombre || ""} ${p.correo || ""}`}
                            onSelect={() => { setNewUserId(p.id); setUserPickerOpen(false); }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", newUserId === p.id ? "opacity-100" : "opacity-0")} />
                            <div className="flex flex-col">
                              <span className="font-medium text-sm">{p.nombre || "Sin nombre"}</span>
                              <span className="text-xs text-muted-foreground">{p.correo || p.id.slice(0, 8)}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Tier</Label>
              <Select value={newTier} onValueChange={setNewTier}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free — 3 clips, 5 análisis/mes</SelectItem>
                  <SelectItem value="pro">Pro — 30 clips, 50 análisis/mes, social</SelectItem>
                  <SelectItem value="enterprise">Enterprise — Ilimitado, sin watermark</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAdd} disabled={saving || !newUserId} className="w-full gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Crear Acceso
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VideoStudioAccessAdmin;

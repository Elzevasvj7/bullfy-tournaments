import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Shield, Briefcase, Sparkles, Crown, MessageSquareWarning, Network } from "lucide-react";
import UsersList from "@/components/admin/UsersList";
import RolesPermissions from "@/components/admin/RolesPermissions";
import BusinessDevelopers from "@/components/admin/BusinessDevelopers";
import BullfyFamily from "@/components/admin/BullfyFamily";
import PartnerUsersGlobalAdmin from "@/components/admin/PartnerUsersGlobalAdmin";
import SmsSecurityPanel from "@/components/admin/SmsSecurityPanel";
import UnifiedIdentitiesPanel from "@/components/admin/UnifiedIdentitiesPanel";
import { useAuth } from "@/hooks/useAuth";

const AdminUsuarios = () => {
  const { isGlobalAdmin, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState("usuarios");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-primary" />
          <div>
            <h2 className="text-2xl font-display font-bold text-foreground">Gestión de Usuarios</h2>
            <p className="text-sm text-muted-foreground">Administra Business Developers, roles y permisos</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-secondary/50 border border-border">
            <TabsTrigger value="usuarios" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Users className="w-4 h-4" /> Usuarios
            </TabsTrigger>
            <TabsTrigger value="bds" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Briefcase className="w-4 h-4" /> Business Developers
            </TabsTrigger>
            <TabsTrigger value="family" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Sparkles className="w-4 h-4" /> Bullfy Family
            </TabsTrigger>
            <TabsTrigger value="roles" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Shield className="w-4 h-4" /> Roles y Permisos
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="portal_partners" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                <Crown className="w-4 h-4" /> Socios de Portales
              </TabsTrigger>
            )}
            {isGlobalAdmin && (
              <TabsTrigger value="sms_security" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                <MessageSquareWarning className="w-4 h-4" /> SMS Security
              </TabsTrigger>
            )}
            {isGlobalAdmin && (
              <TabsTrigger value="identities" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                <Network className="w-4 h-4" /> Identidades
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="usuarios">
            <UsersList />
          </TabsContent>

          <TabsContent value="bds">
            <BusinessDevelopers />
          </TabsContent>

          <TabsContent value="family">
            <BullfyFamily />
          </TabsContent>

          <TabsContent value="roles">
            <RolesPermissions />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="portal_partners">
              <PartnerUsersGlobalAdmin />
            </TabsContent>
          )}
          {isGlobalAdmin && (
            <TabsContent value="sms_security">
              <SmsSecurityPanel />
            </TabsContent>
          )}
          {isGlobalAdmin && (
            <TabsContent value="identities">
              <UnifiedIdentitiesPanel />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default AdminUsuarios;

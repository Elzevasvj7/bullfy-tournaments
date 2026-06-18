import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import PortalPromotions from "@/components/admin/PortalPromotions";
import LiveAdsCampaigns from "@/components/live/LiveAdsCampaigns";
import MarketingCampaigns from "@/components/admin/MarketingCampaigns";
import WaitingTemplateManager from "@/components/live/WaitingTemplateManager";
import VideoStudioDashboard from "@/components/marketing/VideoStudioDashboard";
import VideoStudioAccessAdmin from "@/components/marketing/VideoStudioAccessAdmin";
import CopyAnalyzerTab from "@/components/marketing/CopyAnalyzerTab";
import BrainAnalysisHistory from "@/components/marketing/BrainAnalysisHistory";
import NewsletterStudio from "@/components/marketing/NewsletterStudio";
import BreakingNewsDashboard from "@/components/marketing/BreakingNewsDashboard";
import RelevantEventsManager from "@/components/marketing/RelevantEventsManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Megaphone, Bell, Loader2, Radio, Target, Clock, Video, Shield, Brain, History, Newspaper, AlertTriangle, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/toastUtils";
import { useAuth } from "@/hooks/useAuth";

const Marketing = () => {
  const [sending, setSending] = useState(false);
  const { isGlobalAdmin } = useAuth();

  const handleSendPromoNotification = async () => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-promo-notification");
      if (error) throw error;
      toast.success(`Notificación enviada a ${data?.notified ?? 0} IBs`);
    } catch (err: any) {
      toast.error("Error al enviar notificación: " + (err.message || "Error desconocido"));
    } finally {
      setSending(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Megaphone className="w-6 h-6 text-primary" />
            <div>
              <h2 className="text-2xl font-display font-bold text-foreground">Marketing</h2>
              <p className="text-sm text-muted-foreground">Gestiona promociones, contenido y ads del sistema</p>
            </div>
          </div>
          <Button onClick={handleSendPromoNotification} disabled={sending} className="gap-2">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
            Enviar Notificación de Promociones
          </Button>
        </div>

        <Tabs defaultValue="promotions">
          <TabsList>
            <TabsTrigger value="promotions" className="gap-1">
              <Megaphone className="w-3 h-3" /> Promociones Portal
            </TabsTrigger>
            <TabsTrigger value="live-ads" className="gap-1">
              <Radio className="w-3 h-3" /> Ads Bullfy Live
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="gap-1">
              <Target className="w-3 h-3" /> Campañas IB
            </TabsTrigger>
            <TabsTrigger value="waiting-rooms" className="gap-1">
              <Clock className="w-3 h-3" /> Salas de Espera
            </TabsTrigger>
            <TabsTrigger value="video-studio" className="gap-1">
              <Video className="w-3 h-3" /> Video Studio
            </TabsTrigger>
            <TabsTrigger value="ai-analyzer" className="gap-1">
              <Brain className="w-3 h-3" /> Bullfy Brain
            </TabsTrigger>
            <TabsTrigger value="brain-history" className="gap-1">
              <History className="w-3 h-3" /> Historial Brain
            </TabsTrigger>
            <TabsTrigger value="newsletter" className="gap-1">
              <Newspaper className="w-3 h-3" /> Newsletter
            </TabsTrigger>
            <TabsTrigger value="breaking-news" className="gap-1">
              <AlertTriangle className="w-3 h-3" /> Breaking News
            </TabsTrigger>
            <TabsTrigger value="relevant-events" className="gap-1">
              <CalendarClock className="w-3 h-3" /> Evento Relevante
            </TabsTrigger>
            {isGlobalAdmin && (
              <TabsTrigger value="studio-access" className="gap-1">
                <Shield className="w-3 h-3" /> Acceso Studio
              </TabsTrigger>
            )}
          </TabsList>
          <TabsContent value="promotions" className="mt-4">
            <PortalPromotions />
          </TabsContent>
          <TabsContent value="live-ads" className="mt-4">
            <LiveAdsCampaigns />
          </TabsContent>
          <TabsContent value="campaigns" className="mt-4">
            <MarketingCampaigns />
          </TabsContent>
          <TabsContent value="waiting-rooms" className="mt-4">
            <WaitingTemplateManager />
          </TabsContent>
          <TabsContent value="video-studio" className="mt-4">
            <VideoStudioDashboard />
          </TabsContent>
          <TabsContent value="ai-analyzer" className="mt-4">
            <CopyAnalyzerTab />
          </TabsContent>
          <TabsContent value="brain-history" className="mt-4">
            <BrainAnalysisHistory />
          </TabsContent>
          <TabsContent value="breaking-news" className="mt-4">
            <BreakingNewsDashboard />
          </TabsContent>
          <TabsContent value="newsletter" className="mt-4">
            <NewsletterStudio />
          </TabsContent>
          <TabsContent value="relevant-events" className="mt-4">
            <RelevantEventsManager />
          </TabsContent>
          {isGlobalAdmin && (
            <TabsContent value="studio-access" className="mt-4">
              <VideoStudioAccessAdmin />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Marketing;

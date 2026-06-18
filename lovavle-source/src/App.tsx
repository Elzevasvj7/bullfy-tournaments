import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import UpdatePrompt from "@/components/UpdatePrompt";
import Index from "./pages/Index";
import IBs from "./pages/IBs";
import Deals from "./pages/Deals";
import Login from "./pages/Login";
import Registro from "./pages/Registro";
import PendingApproval from "./pages/PendingApproval";
import AdminUsuarios from "./pages/AdminUsuarios";
import AdminFinanzas from "./pages/AdminFinanzas";
import AdminRetiros from "./pages/AdminRetiros";
import Settings from "./pages/Settings";
import Marketing from "./pages/Marketing";
import Operaciones from "./pages/Operaciones";
import ResetPassword from "./pages/ResetPassword";
import SubIBs from "./pages/SubIBs";
import IbBullfyExperience from "./pages/IbBullfyExperience";
import ExperienceLeads from "./pages/ExperienceLeads";
import NotFound from "./pages/NotFound";
import IBExternoPortal from "./pages/IBExternoPortal";
import Estadisticas from "./pages/Estadisticas";
import BullfyLive from "./pages/BullfyLive";
import Zoom from "./pages/Zoom";
import PartnerPortal from "./pages/PartnerPortal";
import LiveGuest from "./pages/LiveGuest";
import Presentacion from "./pages/Presentacion";
import Manual from "./pages/Manual";
import LeadSystem from "./pages/LeadSystem";
import FakeLive from "./pages/FakeLive";
import ConexionMT5 from "./pages/ConexionMT5";
import LiveEgress from "./pages/LiveEgress";
import CampaignPresentation from "./pages/CampaignPresentation";
import NewsletterResults from "./pages/NewsletterResults";
import BrokerPropATFX from "./pages/BrokerPropATFX";
import Simulaciones from "./pages/Simulaciones";
import SimulacionX12Publica from "./pages/SimulacionX12Publica";
import TournamentLayout from "./pages/tournament/TournamentLayout";
import TournamentLobby from "./pages/tournament/TournamentLobby";
import TournamentLogin from "./pages/tournament/TournamentLogin";
import TournamentImpersonate from "./pages/tournament/TournamentImpersonate";
import TournamentRegister from "./pages/tournament/TournamentRegister";
import TournamentDashboard from "./pages/tournament/TournamentDashboard";
import TournamentRankings from "./pages/tournament/TournamentRankings";
import TournamentElite from "./pages/tournament/TournamentElite";
import TournamentWallet from "./pages/tournament/TournamentWallet";
import TournamentDetail from "./pages/tournament/TournamentDetail";
import TournamentLive from "./pages/tournament/TournamentLive";
import TournamentScoring from "./pages/tournament/TournamentScoring";
import TournamentRedeem from "./pages/tournament/TournamentRedeem";
import TournamentCreate from "./pages/tournament/TournamentCreate";
import TournamentKYC from "./pages/tournament/TournamentKYC";
import TournamentAdmin from "./pages/tournament/TournamentAdmin";
import TournamentProgress from "./pages/tournament/TournamentProgress";
import TournamentProfile from "./pages/tournament/TournamentProfile";
import TournamentAvatarStudio from "./pages/tournament/TournamentAvatarStudio";
import TournamentPoses from "./pages/tournament/TournamentPoses";
import TournamentTV from "./pages/tournament/TournamentTV";
import TournamentArena from "./pages/tournament/TournamentArena";
import TournamentLanding from "./pages/tournament/TournamentLanding";
import TournamentMT5Account from "./pages/tournament/TournamentMT5Account";
import TournamentClans from "./pages/tournament/TournamentClans";
import TournamentClanCreate from "./pages/tournament/TournamentClanCreate";
import TournamentClanDetail from "./pages/tournament/TournamentClanDetail";
import TournamentVersus from "./pages/tournament/TournamentVersus";
import TournamentVersusInvite from "./pages/tournament/TournamentVersusInvite";
import TournamentVerifyUser from "./pages/tournament/TournamentVerifyUser";
import TradingPlatform from "./pages/TradingPlatform";
import ContabilidadLayout from "./pages/contabilidad/ContabilidadLayout";
import ContabilidadDashboard from "./pages/contabilidad/ContabilidadDashboard";
import ContabilidadHome from "./pages/contabilidad/ContabilidadHome";
import FacturasPage from "./pages/contabilidad/FacturasPage";
import GastosPage from "./pages/contabilidad/GastosPage";
import TesoreriaPage from "./pages/contabilidad/TesoreriaPage";
import PlaceholderPage from "./pages/contabilidad/PlaceholderPage";
import CatalogosPage from "./pages/contabilidad/CatalogosPage";
import IngresosPage from "./pages/contabilidad/IngresosPage";
import PresupuestosPage from "./pages/contabilidad/PresupuestosPage";
import ReportesPage from "./pages/contabilidad/ReportesPage";
import AuditoriaPage from "./pages/contabilidad/AuditoriaPage";
import PeriodosPage from "./pages/contabilidad/PeriodosPage";
import AlertasPage from "./pages/contabilidad/AlertasPage";
import CuentasCobrarPage from "./pages/contabilidad/CuentasCobrarPage";
import CuentasPagarPage from "./pages/contabilidad/CuentasPagarPage";
import ConciliacionPage from "./pages/contabilidad/ConciliacionPage";
import FlujoCajaPage from "./pages/contabilidad/FlujoCajaPage";
import InsightsPage from "./pages/contabilidad/InsightsPage";
import EntidadesPage from "./pages/contabilidad/EntidadesPage";
import ActivosPage from "./pages/contabilidad/ActivosPage";
import AnomaliasPage from "./pages/contabilidad/AnomaliasPage";
import ChatPage from "./pages/contabilidad/ChatPage";
import ReportesFiscalesPage from "./pages/contabilidad/ReportesFiscalesPage";
import TarjetasPage from "./pages/contabilidad/TarjetasPage";
import { getCustomDomainSlug } from "@/lib/portalRouting";

const queryClient = new QueryClient();

// Dominio propio de un IB (ej. clubfinanciero.pro): la app queda amarrada a ese
// portal en la raíz; el panel Bullfy y otros IBs NO son accesibles por ahí.
const customDomainSlug = getCustomDomainSlug();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" storageKey="bullfy-theme">
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <UpdatePrompt />
          {customDomainSlug ? (
            // ── Dominio white-label (clubfinanciero.pro): solo el portal del IB ──
            // El portal se monta en la raíz (URL limpia). Se permite /live/guest
            // porque el portal lo usa para los streams. Cualquier otra ruta cae
            // al propio portal (no expone Bullfy ni otros IBs).
            <Routes>
              <Route path="/live/guest" element={<LiveGuest />} />
              <Route path="/live/fake/:slug" element={<FakeLive />} />
              <Route path="/*" element={<PartnerPortal slugOverride={customDomainSlug} />} />
            </Routes>
          ) : (
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/registro" element={<Registro />} />
            <Route path="/pendiente" element={<PendingApproval />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/ibs" element={<ProtectedRoute><IBs /></ProtectedRoute>} />
            <Route path="/deals" element={<ProtectedRoute><Deals /></ProtectedRoute>} />
            <Route path="/sub-ibs" element={<ProtectedRoute><SubIBs /></ProtectedRoute>} />
            <Route path="/operaciones" element={<ProtectedRoute><Operaciones /></ProtectedRoute>} />
            <Route path="/usuarios" element={<ProtectedRoute requireAdmin><AdminUsuarios /></ProtectedRoute>} />
            <Route path="/finanzas" element={<ProtectedRoute requireAdmin><AdminFinanzas /></ProtectedRoute>} />
            <Route path="/retiros" element={<ProtectedRoute requireAdmin><AdminRetiros /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute requireAdmin><Settings /></ProtectedRoute>} />
            <Route path="/marketing" element={<ProtectedRoute><Marketing /></ProtectedRoute>} />
            <Route path="/experience-leads" element={<ProtectedRoute><ExperienceLeads /></ProtectedRoute>} />
            <Route path="/estadisticas" element={<ProtectedRoute requireAdmin><Estadisticas /></ProtectedRoute>} />
            <Route path="/live" element={<ProtectedRoute><BullfyLive /></ProtectedRoute>} />
            <Route path="/zoom" element={<Zoom />} />
            <Route path="/zoom/*" element={<Zoom />} />
            <Route path="/live/fake/:slug" element={<FakeLive />} />
            <Route path="/live-egress/:roomName" element={<LiveEgress />} />
            <Route path="/live/guest" element={<LiveGuest />} />
            <Route path="/presentacion" element={<Presentacion />} />
            <Route path="/p/:slug" element={<CampaignPresentation />} />
            <Route path="/newsletter-results/:id" element={<NewsletterResults />} />
            <Route path="/manual" element={<ProtectedRoute><Manual /></ProtectedRoute>} />
            <Route path="/leads" element={<ProtectedRoute><LeadSystem /></ProtectedRoute>} />
            <Route path="/conexion-mt5" element={<ProtectedRoute requireAdmin><ConexionMT5 /></ProtectedRoute>} />
            <Route path="/trading-platform" element={<ProtectedRoute requireAdmin><TradingPlatform /></ProtectedRoute>} />
            <Route path="/Broker_Prop" element={<ProtectedRoute requireGlobalAdmin><BrokerPropATFX /></ProtectedRoute>} />
            <Route path="/simulaciones" element={<ProtectedRoute requireAdmin><Simulaciones /></ProtectedRoute>} />
            <Route path="/simulaciones/x12/:code" element={<SimulacionX12Publica />} />
            <Route path="/IbBullfyExperience/*" element={<IbBullfyExperience />} />
            <Route path="/ib-portal/*" element={<ProtectedRoute requireIBExterno><IBExternoPortal /></ProtectedRoute>} />
            <Route path="/partner/:slug/*" element={<PartnerPortal />} />
            <Route path="/contabilidad" element={<ProtectedRoute requireAccounting><ContabilidadLayout /></ProtectedRoute>}>
              <Route index element={<ContabilidadHome />} />
              <Route path="dashboard" element={<ContabilidadDashboard />} />
              <Route path="facturas" element={<FacturasPage />} />
              <Route path="gastos" element={<GastosPage />} />
              <Route path="ingresos" element={<IngresosPage />} />
              <Route path="cobrar" element={<CuentasCobrarPage />} />
              <Route path="pagar" element={<CuentasPagarPage />} />
              <Route path="tesoreria" element={<TesoreriaPage />} />
              <Route path="conciliacion" element={<ConciliacionPage />} />
              <Route path="flujo-caja" element={<FlujoCajaPage />} />
              <Route path="presupuestos" element={<PresupuestosPage />} />
              <Route path="reportes" element={<ReportesPage />} />
              <Route path="alertas" element={<AlertasPage />} />
              <Route path="insights" element={<InsightsPage />} />
              <Route path="periodos" element={<PeriodosPage />} />
              <Route path="auditoria" element={<AuditoriaPage />} />
              <Route path="entidades" element={<EntidadesPage />} />
              <Route path="activos" element={<ActivosPage />} />
              <Route path="anomalias" element={<AnomaliasPage />} />
              <Route path="chat" element={<ChatPage />} />
              <Route path="reportes-fiscales" element={<ReportesFiscalesPage />} />
              <Route path="catalogos" element={<CatalogosPage />} />
              <Route path="tarjetas" element={<TarjetasPage />} />
            </Route>
            <Route path="/tournament/landing" element={<TournamentLanding />} />
            <Route path="/tournament" element={<TournamentLayout />}>
              <Route index element={<TournamentLobby />} />
              <Route path="login" element={<TournamentLogin />} />
              <Route path="impersonate" element={<TournamentImpersonate />} />
              <Route path="register" element={<TournamentRegister />} />
              <Route path="dashboard" element={<TournamentDashboard />} />
              <Route path="rankings" element={<TournamentRankings />} />
              <Route path="elite" element={<TournamentElite />} />
              <Route path="wallet" element={<TournamentWallet />} />
              <Route path="redeem" element={<TournamentRedeem />} />
              <Route path="create" element={<TournamentCreate />} />
              <Route path="t/:slug" element={<TournamentDetail />} />
              <Route path="t/:slug/live" element={<TournamentLive />} />
              <Route path="t/:slug/scoring" element={<TournamentScoring />} />
              <Route path="t/:slug/tv" element={<TournamentTV />} />
              <Route path="t/:slug/arena" element={<TournamentArena />} />
              <Route path="kyc" element={<TournamentKYC />} />
              <Route path="progress" element={<TournamentProgress />} />
              <Route path="p/:username" element={<TournamentProfile />} />
              <Route path="avatar" element={<TournamentAvatarStudio />} />
              <Route path="poses" element={<TournamentPoses />} />
              <Route path="account/:participantId" element={<TournamentMT5Account />} />
              <Route path="clans" element={<TournamentClans />} />
              <Route path="clans/create" element={<TournamentClanCreate />} />
              <Route path="clans/:clanId" element={<TournamentClanDetail />} />
              <Route path="versus" element={<TournamentVersus />} />
              <Route path="versus/invite/:token" element={<TournamentVersusInvite />} />
              <Route path="verify" element={<TournamentVerifyUser />} />
            </Route>
            <Route path="/tournament-admin" element={<TournamentAdmin />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          )}
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ThemeProvider>
);

export default App;

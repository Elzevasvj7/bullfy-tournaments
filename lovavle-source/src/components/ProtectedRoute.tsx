import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import ForcedChangePasswordDialog from "@/components/ib-externo/ChangePasswordDialog";
import { useState } from "react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireGlobalAdmin?: boolean;
  requireOps?: boolean;
  requireIBExterno?: boolean;
  requireAccounting?: boolean;
}

const ProtectedRoute = ({ children, requireAdmin, requireGlobalAdmin, requireOps, requireIBExterno, requireAccounting }: ProtectedRouteProps) => {
  const { user, loading, isAdmin, isGlobalAdmin, isOperaciones, isApproved, isIBExterno, isAccountingUser, isAccountant, isDirectivo, profile } = useAuth();
  const [passwordChanged, setPasswordChanged] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // IB Externo users always go to their portal
  if (isIBExterno && !requireIBExterno) return <Navigate to="/ib-portal" replace />;

  // IB Externo pending approval
  if (isIBExterno && !isApproved) return <Navigate to="/pendiente" replace />;

  if (!isIBExterno && !isApproved) return <Navigate to="/pendiente" replace />;
  if (requireGlobalAdmin && !isGlobalAdmin) return <Navigate to="/" replace />;
  if (requireAdmin && !isAdmin) return <Navigate to="/" replace />;
  if (requireOps && !isOperaciones && !isAdmin) return <Navigate to="/" replace />;
  if (requireIBExterno && !isIBExterno && !isAdmin) return <Navigate to="/" replace />;
  if (requireAccounting && !isAccountingUser && !isAccountant && !isGlobalAdmin && !isDirectivo) return <Navigate to="/" replace />;

  // Force password change for IB externo
  if (isIBExterno && profile?.must_change_password && !passwordChanged) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <ForcedChangePasswordDialog open={true} onComplete={() => setPasswordChanged(true)} />
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;

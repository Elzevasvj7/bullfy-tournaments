import { useEffect, useState, useCallback, useRef, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { subscribeToPush, isPushSupported } from "@/lib/pushNotifications";
import {
  MOCK_AUTH_ENABLED,
  mockAdminProfile,
  mockAdminUser,
  mockRoles,
} from "@/lib/mockAuth";
import type { User } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  profile: { nombre: string; correo: string; status: string; ib_id: string | null; sub_ib_id: string | null; must_change_password: boolean } | null;
  roles: string[];
  loading: boolean;
  isAdmin: boolean;
  isGlobalAdmin: boolean;
  isBD: boolean;
  isAdminBD: boolean;
  isOperaciones: boolean;
  isAdminOperaciones: boolean;
  isIBExterno: boolean;
  isMarketing: boolean;
  isVentas: boolean;
  isAdminVentas: boolean;
  isDealing: boolean;
  isBullfyFamily: boolean;
  isAccountant: boolean;
  isTreasurer: boolean;
  isDirectivo: boolean;
  isAccountingUser: boolean;
  isApproved: boolean;
  signOut: () => Promise<void>;
  refetchProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthContextType["profile"]>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const hydratedUserRef = useRef<string | null>(null);

  const fetchUserData = useCallback(async (userId: string): Promise<boolean> => {
    if (MOCK_AUTH_ENABLED && userId === mockAdminUser.id) {
      setProfile(mockAdminProfile);
      setRoles(mockRoles);
      return true;
    }

    try {
      const [profileRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("nombre, correo, status, ib_id, sub_ib_id, must_change_password").eq("id", userId).single(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
      ]);
      if (!mountedRef.current) return false;
      setProfile(profileRes.data ?? null);
      setRoles(rolesRes.data?.map((r) => r.role) ?? []);
      return true;
    } catch (err) {
      console.error("Error fetching user data:", err);
      return false;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    if (MOCK_AUTH_ENABLED) {
      setUser(mockAdminUser as User);
      setProfile(mockAdminProfile);
      setRoles(mockRoles);
      hydratedUserRef.current = mockAdminUser.id;
      setLoading(false);

      return () => {
        mountedRef.current = false;
      };
    }

    // 1. Check existing session first
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mountedRef.current) return;
      if (session?.user) {
        setUser(session.user);
        await fetchUserData(session.user.id);
        hydratedUserRef.current = session.user.id;
      }
      if (mountedRef.current) setLoading(false);
    });

    // 2. Listen for auth changes (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mountedRef.current) return;

        if (event === "INITIAL_SESSION") {
          return;
        }

        if (event === "SIGNED_OUT") {
          setUser(null);
          setProfile(null);
          setRoles([]);
          hydratedUserRef.current = null;
          setLoading(false);
          return;
        }

        if (event === "SIGNED_IN" && session?.user) {
          setUser(session.user);

          const isSameHydratedUser = hydratedUserRef.current === session.user.id;

          if (!isSameHydratedUser) {
            setLoading(true);
            fetchUserData(session.user.id).then(() => {
              if (mountedRef.current) {
                hydratedUserRef.current = session.user.id;
                setLoading(false);
              }
            });
          }

          // Auto-subscribe to push if permission already granted
          isPushSupported().then((supported) => {
            if (supported && Notification.permission === "granted") {
              subscribeToPush(session.user.id);
            }
          });
        }

        if (event === "TOKEN_REFRESHED" && session?.user) {
          setUser(session.user);
        }
      }
    );

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [fetchUserData]);

  const isGlobalAdmin = roles.includes("global_admin");
  const isAdmin = roles.includes("admin") || isGlobalAdmin;
  const isBD = roles.includes("bd") || roles.includes("admin_bd");
  const isAdminBD = roles.includes("admin_bd");
  const isOperaciones = roles.includes("operaciones") || roles.includes("admin_operaciones");
  const isAdminOperaciones = roles.includes("admin_operaciones");
  const isIBExterno = roles.includes("ib_externo");
  const isMarketing = roles.includes("marketing");
  const isVentas = roles.includes("ventas") || roles.includes("admin_ventas");
  const isAdminVentas = roles.includes("admin_ventas");
  const isDealing = roles.includes("dealing");
  const isBullfyFamily = roles.includes("bullfy_family");
  const isAccountant = roles.includes("accountant");
  const isTreasurer = roles.includes("treasurer");
  const isDirectivo = roles.includes("directivo");
  const isAccountingUser = roles.includes("accounting_user");
  const isApproved = profile?.status === "approved" || isAdmin;

  const signOut = async () => {
    if (MOCK_AUTH_ENABLED) {
      setUser(mockAdminUser as User);
      setProfile(mockAdminProfile);
      setRoles(mockRoles);
      return;
    }

    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setRoles([]);
  };

  const refetchProfile = async () => {
    if (user) await fetchUserData(user.id);
  };

  return (
    <AuthContext.Provider value={{ user, profile, roles, loading, isAdmin, isGlobalAdmin, isBD, isAdminBD, isOperaciones, isAdminOperaciones, isIBExterno, isMarketing, isVentas, isAdminVentas, isDealing, isBullfyFamily, isAccountant, isTreasurer, isDirectivo, isAccountingUser, isApproved, signOut, refetchProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

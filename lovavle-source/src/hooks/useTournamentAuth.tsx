import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  MOCK_AUTH_ENABLED,
  MOCK_TOURNAMENT_TOKEN,
  mockTournamentUser,
  mockTournamentWallet,
  mockUnlockedPoses,
} from "@/lib/mockAuth";

const STORAGE_KEY = "tournament_session_token";
const avatarCacheKey = (userId: string) => `tournament_avatar_3d_url:${userId}`;

export type TournamentUser = {
  id: string;
  email: string;
  phone?: string;
  full_name: string;
  country?: string | null;
  avatar_url?: string | null;
  avatar_config?: Record<string, any> | null;
  avatar_3d_url?: string | null;
  is_elite: boolean;
  kyc_status: string;
  bullfy_points: number;
  lifetime_winnings_usd: number;
  referral_code?: string | null;
  daily_streak?: number;
  username?: string | null;
  bio?: string | null;
  public_profile?: boolean;
  preferred_pose?: string | null;
  is_verified_user?: boolean;
  clan_id?: string | null;
  clan_change_available_at?: string | null;
};

export type TournamentWallet = {
  balance_usd: number;
  locked_usd: number;
  bmoney_balance?: number;
  bmoney_locked?: number;
  last_bmoney_topup_at?: string | null;
};

type Ctx = {
  user: TournamentUser | null;
  wallet: TournamentWallet | null;
  unlockedPoses: string[];
  loading: boolean;
  token: string | null;
  setSession: (token: string, user: TournamentUser) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const TournamentAuthCtx = createContext<Ctx | null>(null);

export function TournamentAuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    MOCK_AUTH_ENABLED ? MOCK_TOURNAMENT_TOKEN : localStorage.getItem(STORAGE_KEY),
  );
  const [user, setUser] = useState<TournamentUser | null>(() =>
    MOCK_AUTH_ENABLED ? mockTournamentUser : null,
  );
  const [wallet, setWallet] = useState<TournamentWallet | null>(() =>
    MOCK_AUTH_ENABLED ? mockTournamentWallet : null,
  );
  const [unlockedPoses, setUnlockedPoses] = useState<string[]>(() =>
    MOCK_AUTH_ENABLED ? mockUnlockedPoses : [],
  );
  const [loading, setLoading] = useState(!MOCK_AUTH_ENABLED);

  const refresh = useCallback(async () => {
    if (MOCK_AUTH_ENABLED) {
      setToken(MOCK_TOURNAMENT_TOKEN);
      setUser(mockTournamentUser);
      setWallet(mockTournamentWallet);
      setUnlockedPoses(mockUnlockedPoses);
      setLoading(false);
      return;
    }

    const t = localStorage.getItem(STORAGE_KEY);
    if (!t) { setUser(null); setWallet(null); setUnlockedPoses([]); setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("tournament-auth-me", {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (error || !data?.ok) {
        localStorage.removeItem(STORAGE_KEY);
        setToken(null); setUser(null); setWallet(null); setUnlockedPoses([]);
      } else {
        const cachedAvatar3D = data.user?.id ? localStorage.getItem(avatarCacheKey(data.user.id)) : null;
        const nextUser = data.user?.avatar_3d_url
          ? data.user
          : { ...data.user, avatar_3d_url: cachedAvatar3D || data.user?.avatar_3d_url || null };
        if (nextUser?.id && nextUser.avatar_3d_url) {
          try { localStorage.setItem(avatarCacheKey(nextUser.id), nextUser.avatar_3d_url); } catch { /* quota: ignore dataURL cache */ }
        }
        setUser(nextUser); setWallet(data.wallet);
        setUnlockedPoses(Array.isArray(data.unlocked_poses) ? data.unlocked_poses : []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const setSession = useCallback((t: string, u: TournamentUser) => {
    if (MOCK_AUTH_ENABLED) {
      setToken(MOCK_TOURNAMENT_TOKEN);
      setUser(mockTournamentUser);
      setWallet(mockTournamentWallet);
      setUnlockedPoses(mockUnlockedPoses);
      setLoading(false);
      return;
    }

    try { localStorage.setItem(STORAGE_KEY, t); } catch { /* ignore */ }
    if (u.avatar_3d_url) {
      try { localStorage.setItem(avatarCacheKey(u.id), u.avatar_3d_url); } catch { /* quota: ignore */ }
    }
    let cachedAvatar3D: string | null = null;
    try { cachedAvatar3D = localStorage.getItem(avatarCacheKey(u.id)); } catch { /* ignore */ }
    setToken(t); setUser(u.avatar_3d_url ? u : { ...u, avatar_3d_url: cachedAvatar3D || null });
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    if (MOCK_AUTH_ENABLED) {
      setToken(MOCK_TOURNAMENT_TOKEN);
      setUser(mockTournamentUser);
      setWallet(mockTournamentWallet);
      setUnlockedPoses(mockUnlockedPoses);
      setLoading(false);
      return;
    }

    const t = localStorage.getItem(STORAGE_KEY);
    if (t) {
      try {
        await supabase.functions.invoke("tournament-auth-logout", {
          headers: { Authorization: `Bearer ${t}` },
        });
      } catch { /* ignore */ }
    }
    localStorage.removeItem(STORAGE_KEY);
    setToken(null); setUser(null); setWallet(null); setUnlockedPoses([]);
  }, []);

  const value = useMemo(() => ({ user, wallet, unlockedPoses, loading, token, setSession, refresh, logout }),
    [user, wallet, unlockedPoses, loading, token, setSession, refresh, logout]);

  return <TournamentAuthCtx.Provider value={value}>{children}</TournamentAuthCtx.Provider>;
}

export function useTournamentAuth() {
  const ctx = useContext(TournamentAuthCtx);
  if (!ctx) throw new Error("useTournamentAuth must be used within TournamentAuthProvider");
  return ctx;
}

export const MOCK_AUTH_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_MOCK_AUTH === "true";

export const MOCK_ADMIN_USER_ID = "mock-admin-user";
export const MOCK_TOURNAMENT_TOKEN = "mock-tournament-token";

export const mockAdminUser = {
  id: MOCK_ADMIN_USER_ID,
  email: "mock@bullfy.local",
  app_metadata: {},
  user_metadata: {
    full_name: "Mock Admin",
  },
  aud: "authenticated",
  created_at: "2026-06-05T00:00:00.000Z",
};

export const mockAdminProfile = {
  nombre: "Mock Admin",
  correo: "mock@bullfy.local",
  status: "approved",
  ib_id: null,
  sub_ib_id: null,
  must_change_password: false,
};

export const mockRoles = [
  "global_admin",
  "admin",
  "accounting_user",
  "accountant",
  "directivo",
  "marketing",
  "ventas",
  "admin_ventas",
  "operaciones",
  "admin_operaciones",
  "bd",
  "admin_bd",
];

export const mockTournamentUser = {
  id: "mock-tournament-user",
  email: "trader@bullfy.local",
  phone: "+584120000000",
  full_name: "Karlos Guzman",
  country: "VE",
  avatar_url: null,
  avatar_config: null,
  avatar_3d_url: null,
  is_elite: true,
  kyc_status: "approved",
  bullfy_points: 538,
  lifetime_winnings_usd: 1840,
  referral_code: "BULLFY-MOCK",
  daily_streak: 7,
  username: "karlosfx",
  bio: "Trader mock para explorar el prototipo.",
  public_profile: true,
  preferred_pose: "victory",
  is_verified_user: true,
  clan_id: "mock-clan",
  clan_change_available_at: null,
};

export const mockTournamentWallet = {
  balance_usd: 250,
  locked_usd: 0,
  bmoney_balance: 1680,
  bmoney_locked: 120,
  last_bmoney_topup_at: "2026-06-04T16:45:00.000Z",
};

export const mockUnlockedPoses = [
  "idle",
  "wave",
  "victory",
  "cheer",
  "thinking",
  "clapping",
];

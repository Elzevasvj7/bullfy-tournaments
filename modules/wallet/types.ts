export type WalletBalance = {
  realBalance: number;
  demoBalance: number;
  bullfyPoints: number;
  pendingRewards: number;
  claimableRewards: number;
};

export type WalletMovementType =
  | "deposit"
  | "withdrawal"
  | "entryFee"
  | "reward"
  | "points"
  | "adjustment";

export type WalletMovementStatus = "pending" | "completed" | "failed";

export type WalletCurrency = "USD" | "DEMO" | "BFP";

export type WalletMovement = {
  id: string;
  type: WalletMovementType;
  status: WalletMovementStatus;
  title: string;
  description: string;
  amount: number;
  currency: WalletCurrency;
  createdAt: string;
  tournamentName?: string;
};

export type WalletPaymentMethod = {
  id: string;
  label: string;
  network: string;
  lastFour: string;
  status: "active" | "disabled";
};

export type WalletAccount = {
  traderId: string;
  balances: WalletBalance;
  paymentMethods: WalletPaymentMethod[];
  movements: WalletMovement[];
};

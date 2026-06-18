export type ExternalWalletDto = {
  trader_id: string;
  balances: {
    real_balance: number;
    demo_balance: number;
    bullfy_points: number;
    pending_rewards: number;
    claimable_rewards: number;
  };
  payment_methods: Array<{
    method_id: string;
    label: string;
    network: string;
    last_four: string;
    status: "ACTIVE" | "DISABLED";
  }>;
  movements: Array<{
    movement_id: string;
    movement_type:
      | "DEPOSIT"
      | "WITHDRAWAL"
      | "ENTRY_FEE"
      | "REWARD"
      | "POINTS"
      | "ADJUSTMENT";
    status: "PENDING" | "COMPLETED" | "FAILED";
    title: string;
    description: string;
    amount: number;
    currency: "USD" | "DEMO" | "BFP";
    created_at: string;
    tournament_name?: string;
  }>;
};

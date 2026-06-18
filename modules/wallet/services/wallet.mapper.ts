import type {
  WalletAccount,
  WalletMovementStatus,
  WalletMovementType,
} from "../types";
import type { ExternalWalletDto } from "./wallet.contracts";

const movementTypeMap: Record<
  ExternalWalletDto["movements"][number]["movement_type"],
  WalletMovementType
> = {
  ADJUSTMENT: "adjustment",
  DEPOSIT: "deposit",
  ENTRY_FEE: "entryFee",
  POINTS: "points",
  REWARD: "reward",
  WITHDRAWAL: "withdrawal",
};

const movementStatusMap: Record<
  ExternalWalletDto["movements"][number]["status"],
  WalletMovementStatus
> = {
  COMPLETED: "completed",
  FAILED: "failed",
  PENDING: "pending",
};

export function mapWallet(dto: ExternalWalletDto): WalletAccount {
  return {
    traderId: dto.trader_id,
    balances: {
      realBalance: dto.balances.real_balance,
      demoBalance: dto.balances.demo_balance,
      bullfyPoints: dto.balances.bullfy_points,
      pendingRewards: dto.balances.pending_rewards,
      claimableRewards: dto.balances.claimable_rewards,
    },
    paymentMethods: dto.payment_methods.map((method) => ({
      id: method.method_id,
      label: method.label,
      network: method.network,
      lastFour: method.last_four,
      status: method.status === "ACTIVE" ? "active" : "disabled",
    })),
    movements: dto.movements.map((movement) => ({
      id: movement.movement_id,
      type: movementTypeMap[movement.movement_type],
      status: movementStatusMap[movement.status],
      title: movement.title,
      description: movement.description,
      amount: movement.amount,
      currency: movement.currency,
      createdAt: movement.created_at,
      tournamentName: movement.tournament_name,
    })),
  };
}

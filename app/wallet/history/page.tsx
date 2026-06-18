import { getCurrentSessionUser } from "@/modules/auth/services/session-user";
import {
  getWalletAccount,
  WalletHistoryTabs,
  WalletShell,
} from "@/modules/wallet";

export default async function WalletHistoryPage() {
  const [wallet, sessionUser] = await Promise.all([
    getWalletAccount(),
    getCurrentSessionUser(),
  ]);
  const usdMovements = wallet.movements.filter(
    (movement) => movement.currency === "USD",
  );
  const bmoneyMovements = wallet.movements.filter(
    (movement) => movement.currency === "DEMO",
  );

  return (
    <WalletShell
      active="history"
      eyebrow="Ledger"
      sessionUser={sessionUser}
      title="Historial"
    >
      <WalletHistoryTabs
        bmoneyMovements={bmoneyMovements}
        usdMovements={usdMovements}
      />
    </WalletShell>
  );
}

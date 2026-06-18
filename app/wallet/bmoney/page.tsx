import { getCurrentSessionUser } from "@/modules/auth/services/session-user";
import { getWalletAccount, WalletBmoneyPage } from "@/modules/wallet";

export default async function BmoneyWalletPage() {
  const [wallet, sessionUser] = await Promise.all([
    getWalletAccount(),
    getCurrentSessionUser(),
  ]);

  return <WalletBmoneyPage sessionUser={sessionUser} wallet={wallet} />;
}

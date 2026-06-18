import { getCurrentSessionUser } from "@/modules/auth/services/session-user";
import { getWalletAccount, WalletUsdPage } from "@/modules/wallet";
import { getTopUpAmountUsd } from "@/modules/wallet/services/nowpayments";

type WalletPageProps = {
  searchParams?: Promise<{
    payment?: string;
    pid?: string;
  }>;
};

export default async function WalletPage({ searchParams }: WalletPageProps) {
  const params = (await searchParams) ?? {};
  const [wallet, sessionUser] = await Promise.all([
    getWalletAccount(),
    getCurrentSessionUser(),
  ]);
  const paymentState =
    params.payment === "success" || params.payment === "cancel"
      ? params.payment
      : undefined;

  return (
    <WalletUsdPage
      paymentIntentId={params.pid}
      paymentState={paymentState}
      sessionUser={sessionUser}
      topUpAmountUsd={getTopUpAmountUsd()}
      wallet={wallet}
    />
  );
}

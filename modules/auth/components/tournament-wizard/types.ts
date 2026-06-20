import type { FormEvent } from "react";
import type { AuthVerificationChannel } from "../../types";

export type StepId = "identity" | "verify" | "clan" | "review";

export type TournamentWizardStep = {
  id: StepId;
  label: string;
  title: string;
};

export type TournamentWizardFormState = {
  fullName: string;
  email: string;
  phone: string;
  country: string;
  password: string;
  referredByCode: string;
  emailCode: string;
  smsCode: string;
  clanName: string;
  clanTag: string;
  clanDescription: string;
  clanPublic: boolean;
};

export type TournamentWizardState = {
  emailVerified: boolean;
  error: string | null;
  form: TournamentWizardFormState;
  pendingAction: string | null;
  smsVerified: boolean;
  stepIndex: number;
};

export type TournamentWizardActions = {
  goToStep: (nextIndex: number) => void;
  handleOtp: (channel: AuthVerificationChannel) => Promise<void>;
  handleSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleVerify: (channel: AuthVerificationChannel) => Promise<void>;
  nextStep: () => void;
  previousStep: () => void;
  updateEmail: (value: string) => void;
  updateForm: <Key extends keyof TournamentWizardFormState>(
    key: Key,
    value: TournamentWizardFormState[Key],
  ) => void;
  updatePhone: (value: string) => void;
};

export type TournamentWizardMeta = {
  activeStep: TournamentWizardStep;
  canMoveNext: boolean;
  previewDescription: string;
  previewName: string;
  previewTag: string;
  progress: number;
};

export type TournamentWizardContextValue = {
  actions: TournamentWizardActions;
  meta: TournamentWizardMeta;
  state: TournamentWizardState;
};

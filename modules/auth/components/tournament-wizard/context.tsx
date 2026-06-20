"use client";

import { createContext, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { createClan } from "@/modules/clans/services/clan.client";
import {
  requestRegistrationOtp,
  verifyRegistrationOtp,
} from "../../services/auth.client";
import type { AuthVerificationChannel } from "../../types";
import {
  INITIAL_TOURNAMENT_WIZARD_FORM,
  TOURNAMENT_WIZARD_STEPS,
} from "./constants";
import type {
  StepId,
  TournamentWizardContextValue,
  TournamentWizardFormState,
} from "./types";

const TournamentWizardContext =
  createContext<TournamentWizardContextValue | null>(null);

export function TournamentWizardProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<TournamentWizardFormState>(
    INITIAL_TOURNAMENT_WIZARD_FORM,
  );
  const [emailVerified, setEmailVerified] = useState(false);
  const [smsVerified, setSmsVerified] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeStep = TOURNAMENT_WIZARD_STEPS[stepIndex];
  const canMoveNext = validateStep(activeStep.id);
  const progress = ((stepIndex + 1) / TOURNAMENT_WIZARD_STEPS.length) * 100;
  const previewName = form.clanName.trim() || "Clan VIP";
  const previewTag = form.clanTag.trim() || "VIP";
  const previewDescription =
    form.clanDescription.trim() ||
    "Mesa privada para traders competitivos con reglas claras, capitan activo y entrada controlada.";

  async function handleOtp(channel: AuthVerificationChannel) {
    setError(null);
    setPendingAction(`request-${channel}`);

    try {
      await requestRegistrationOtp({
        email: form.email,
        phone: form.phone,
        channel,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo enviar.");
    } finally {
      setPendingAction(null);
    }
  }

  async function handleVerify(channel: AuthVerificationChannel) {
    setError(null);
    setPendingAction(`verify-${channel}`);

    try {
      await verifyRegistrationOtp({
        email: form.email,
        phone: form.phone,
        channel,
        code: channel === "email" ? form.emailCode : form.smsCode,
      });

      if (channel === "email") {
        setEmailVerified(true);
      } else {
        setSmsVerified(true);
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo verificar el codigo.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!validateStep("review")) {
      setError("Completa todos los pasos antes de confirmar.");
      return;
    }

    try {
      setPendingAction("submit");
      const { error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        phone: form.phone,
        password: form.password,
        options: {
          data: {
            country: form.country,
            full_name: form.fullName,
            referred_by_code: form.referredByCode || null,
            vip_entry: "register-tournament",
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      const clan = await createClan({
        name: form.clanName,
        tag: form.clanTag,
        description: form.clanDescription,
        isPublic: form.clanPublic,
      });

      router.push(`/clans/${clan.slug}`);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo completar el registro VIP.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  function goToStep(nextIndex: number) {
    if (nextIndex <= stepIndex) {
      setStepIndex(nextIndex);
      return;
    }

    for (let index = 0; index < nextIndex; index += 1) {
      const step = TOURNAMENT_WIZARD_STEPS[index];

      if (!validateStep(step.id)) {
        setError(`Completa primero el paso ${step.label}.`);
        return;
      }
    }

    setError(null);
    setStepIndex(nextIndex);
  }

  function nextStep() {
    setStepIndex((current) =>
      Math.min(TOURNAMENT_WIZARD_STEPS.length - 1, current + 1),
    );
  }

  function previousStep() {
    setStepIndex((current) => Math.max(0, current - 1));
  }

  function updateEmail(value: string) {
    updateForm("email", value);
    setEmailVerified(false);
  }

  function updatePhone(value: string) {
    updateForm("phone", value);
    setSmsVerified(false);
  }

  function updateForm<Key extends keyof TournamentWizardFormState>(
    key: Key,
    value: TournamentWizardFormState[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validateStep(step: StepId): boolean {
    if (step === "identity") {
      return (
        form.fullName.trim().length > 2 &&
        form.email.includes("@") &&
        form.phone.trim().length >= 7 &&
        form.password.length >= 8
      );
    }

    if (step === "verify") {
      return emailVerified && smsVerified;
    }

    if (step === "clan") {
      return (
        form.clanName.trim().length >= 3 &&
        form.clanTag.trim().length >= 2 &&
        form.clanDescription.trim().length >= 12
      );
    }

    return (
      validateStep("identity") &&
      validateStep("verify") &&
      validateStep("clan")
    );
  }

  return (
    <TournamentWizardContext.Provider
      value={{
        actions: {
          goToStep,
          handleOtp,
          handleSubmit,
          handleVerify,
          nextStep,
          previousStep,
          updateEmail,
          updateForm,
          updatePhone,
        },
        meta: {
          activeStep,
          canMoveNext,
          previewDescription,
          previewName,
          previewTag,
          progress,
        },
        state: {
          emailVerified,
          error,
          form,
          pendingAction,
          smsVerified,
          stepIndex,
        },
      }}
    >
      {children}
    </TournamentWizardContext.Provider>
  );
}

export function useTournamentWizard() {
  const context = useContext(TournamentWizardContext);

  if (!context) {
    throw new Error(
      "useTournamentWizard must be used within TournamentWizardProvider.",
    );
  }

  return context;
}

import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

import { currentAppVersion } from "@/lib/buildInfo";
import { kycApi, type KycConsentState } from "@/services/api";

/**
 * Consent before ID/selfie capture. Mirrors web's `useKycConsent`.
 *
 * `required` stays false while the server's switch is off (until legal approves
 * the wording) - and also when the consent state can't be read: a failed read
 * must never block verification. The server enforces consent on submit anyway,
 * so a missed screen surfaces as KYC_CONSENT_REQUIRED, not as a silent pass.
 */
export function useKycConsent() {
  const [state, setState] = useState<KycConsentState | null>(null);
  const [agreeing, setAgreeing] = useState(false);
  // For the Didit screen: a spinner while loading, and Retry on failure. The
  // manual path keeps its rule above (a failed read never blocks).
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mounted = useRef(true);

  const refetch = useCallback(async () => {
    try {
      const res = await kycApi.getConsent();
      if (mounted.current) { setState(res.data ?? null); setError(null); }
    } catch (err) {
      if (mounted.current) { setState(null); setError(err instanceof Error ? err : new Error(String(err))); }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refetch();
    return () => { mounted.current = false; };
  }, [refetch]);

  const agree = useCallback(async () => {
    if (!state?.policy_version) return;
    setAgreeing(true);
    try {
      await kycApi.giveConsent(state.policy_version, Platform.OS === "ios" ? "ios" : "android", currentAppVersion());
      await refetch();
    } finally {
      if (mounted.current) setAgreeing(false);
    }
  }, [state?.policy_version, refetch]);

  const ready = !!(state?.required && state.policy_version && state.retention_days && state.contact_email);
  return { required: ready, consent: state, agreeing, agree, refetch, loading, error };
}

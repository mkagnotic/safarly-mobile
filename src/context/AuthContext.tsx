import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { authApi } from "@/services/api/auth";
import { useAppStore } from "@/store/useAppStore";

/** Server response shape from `supabase.auth.signUp`. Mirrors the relevant subset. */
export interface SignUpResult {
  /** Present only if email confirmation is disabled in Supabase Auth settings. */
  hasSession: boolean;
}

export interface SignUpMetadata {
  full_name?: string;
  phone?: string;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  /** True until the persisted session has been rehydrated from AsyncStorage. */
  initializing: boolean;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (
    email: string,
    password: string,
    metadata?: SignUpMetadata,
  ) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface Props {
  children: ReactNode;
}

/**
 * Single source of truth for the Supabase auth session.
 *
 * Responsibilities:
 *   1. Rehydrate the persisted session on cold start (so a returning user
 *      lands directly inside the app instead of bouncing through Login).
 *   2. Keep the zustand `authenticated` flag in lockstep with the real
 *      session — every screen that reads it (RootNavigator, etc.) keeps
 *      working with no further changes.
 *   3. Expose a small, promise-based API for the auth screens.
 *
 * The provider does NOT toast or navigate on its own — those are screen
 * concerns. It just owns the session.
 */
export function AuthProvider({ children }: Readonly<Props>) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);

  // Avoid setting state after unmount on the initial getSession() race.
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const applySession = (next: Session | null) => {
      if (!mountedRef.current) return;
      setSession(next);
      const store = useAppStore.getState();
      if (next && !store.authenticated) store.login();
      else if (!next && store.authenticated) store.logout();

      // Propagate the JWT to the Realtime client. Without this, RLS-gated
      // postgres_changes subscriptions silently drop events on Supabase v2,
      // even though REST calls work fine. Pass `null` on sign-out so the
      // socket downgrades to anon and stops receiving privileged rows.
      try {
        supabase.realtime.setAuth(next?.access_token ?? null);
      } catch {
        /* setAuth throws if the realtime socket isn't ready yet — harmless. */
      }
    };

    void supabase.auth
      .getSession()
      .then(({ data }) => applySession(data.session))
      .finally(() => {
        if (mountedRef.current) setInitializing(false);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      applySession(next);
    });

    return () => {
      mountedRef.current = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      initializing,
      signInWithPassword: async (email, password) => {
        await authApi.customerLogin(email.trim(), password);
      },
      signUpWithPassword: async (email, password, metadata) => {
        // We bypass `authApi.customerSignup` here so we can pass `options.data`
        // (user_metadata) — name/phone collected on SignupScreen end up there
        // and are picked up by ProfileSetup as defaults.
        const trimmed: SignUpMetadata = {};
        if (metadata?.full_name?.trim()) trimmed.full_name = metadata.full_name.trim();
        if (metadata?.phone?.trim()) trimmed.phone = metadata.phone.trim();
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: Object.keys(trimmed).length ? { data: trimmed } : undefined,
        });
        if (error) throw error;
        return { hasSession: !!data.session };
      },
      signOut: async () => {
        // signOut() also fires onAuthStateChange — the store flag flips there.
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
    }),
    [session, initializing],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside an <AuthProvider>");
  }
  return ctx;
}

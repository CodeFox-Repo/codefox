'use client';

import { useEffect, useState } from 'react';
import { useApolloClient } from '@apollo/client';
import { LogIn, LogOut, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { LOGIN_USER, REGISTER_USER } from '@/graphql/mutations/auth';
import { LocalStore } from '@/lib/storage';

const EMAIL = process.env.NEXT_PUBLIC_DEV_EMAIL;
const PASSWORD = process.env.NEXT_PUBLIC_DEV_PASSWORD;

/**
 * Dev-only switch between the signed-in and signed-out views.
 *
 * Signs in as a throwaway account from `frontend/.env`, creating it on first
 * use, so the toggle works on a fresh clone instead of only after you have
 * logged in by hand. The whole component compiles out of a production build,
 * and the credentials only exist in a gitignored dev env file.
 */
export function DevAuthToggle() {
  const client = useApolloClient();
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSignedIn(!!localStorage.getItem(LocalStore.accessToken));
  }, []);

  if (process.env.NODE_ENV !== 'development') return null;

  const signIn = async () => {
    const input = { email: EMAIL, password: PASSWORD };

    const login = () =>
      client.mutate({
        mutation: LOGIN_USER,
        variables: { input },
        fetchPolicy: 'no-cache',
      });

    let result;
    try {
      result = await login();
    } catch {
      // No such account yet — make one, then log in.
      await client.mutate({
        mutation: REGISTER_USER,
        variables: {
          input: {
            username: EMAIL!.split('@')[0],
            email: EMAIL,
            password: PASSWORD,
            confirmPassword: PASSWORD,
          },
        },
        fetchPolicy: 'no-cache',
      });
      result = await login();
    }

    const { accessToken, refreshToken } = result.data.login;
    localStorage.setItem(LocalStore.accessToken, accessToken);
    if (refreshToken)
      localStorage.setItem(LocalStore.refreshToken, refreshToken);
  };

  const toggle = async () => {
    if (busy) return;

    if (!EMAIL || !PASSWORD) {
      toast.error(
        'Set NEXT_PUBLIC_DEV_EMAIL and NEXT_PUBLIC_DEV_PASSWORD in frontend/.env'
      );
      return;
    }

    setBusy(true);
    try {
      if (signedIn) {
        localStorage.removeItem(LocalStore.accessToken);
        localStorage.removeItem(LocalStore.refreshToken);
      } else {
        await signIn();
      }
      // A reload is the honest way to re-run every auth-dependent effect.
      window.location.reload();
    } catch (error) {
      setBusy(false);
      toast.error(
        `Dev sign-in failed: ${(error as Error)?.message ?? 'unknown error'}`
      );
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={
        signedIn ? 'Dev: preview signed-out' : `Dev: sign in as ${EMAIL ?? '—'}`
      }
      // Not "Preview signed out": that label collided with the Preview tab in
      // accessible-name lookups (tests, screen readers) and got activated in
      // its place.
      aria-label={signedIn ? 'Dev sign out' : 'Dev sign in'}
      // Above the corner, not in it: the SaveChangesBar docks bottom-right and
      // this sat exactly on its Save button.
      className="fixed bottom-24 right-5 z-[100] flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card/90 text-foreground shadow-lg backdrop-blur transition-colors hover:border-primary"
    >
      {busy ? (
        <Loader2 className="h-[18px] w-[18px] animate-spin text-primary" />
      ) : signedIn ? (
        <LogOut className="h-[18px] w-[18px]" />
      ) : (
        <LogIn className="h-[18px] w-[18px] text-primary" />
      )}
      <span
        aria-hidden
        className="absolute -right-0.5 -top-0.5 rounded-full border border-border bg-background px-1 font-mono text-[8px] leading-[14px] text-muted-foreground"
      >
        dev
      </span>
    </button>
  );
}

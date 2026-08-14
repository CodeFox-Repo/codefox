'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ModeToggle } from '../mode-toggle';
import { AvatarUploader } from '../avatar-uploader';
import { useAuthContext } from '@/providers/AuthProvider';
import { gql, useMutation, useQuery } from '@apollo/client';
import { toast } from 'sonner';
import { CHANGE_PASSWORD, HAS_PASSWORD } from '@/graphql/mutations/auth';

/**
 * Section shell shared by every block on this page, matching the rule-and-label
 * rhythm the landing page and workbench use.
 */
function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t-[3px] border-border pt-8">
      <h2 className="mb-6 font-mono text-sm uppercase tracking-[0.12em] text-primary">
        {label}
      </h2>
      <div className="divide-y divide-border rounded-lg border border-border bg-card px-5">
        {children}
      </div>
    </section>
  );
}

function Row({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 py-4">
      <div className="min-w-0">
        <p className="font-medium text-foreground">{title}</p>
        <p className="mt-0.5 max-w-[52ch] font-mono text-xs text-muted-foreground">
          {hint}
        </p>
      </div>
      {children}
    </div>
  );
}

const UPDATE_USERNAME = gql`
  mutation UpdateUsername($username: String!) {
    updateUsername(username: $username) {
      id
      username
    }
  }
`;

/**
 * The name shown next to this user's projects, editable in place.
 *
 * Saves on blur or Enter rather than behind a button: one field with its own
 * Save is more chrome than the change deserves. Escape puts the old name
 * back, which is the only way out of a half-typed edit.
 */
function UsernameField({ current }: { current?: string | null }) {
  const { refreshUserInfo } = useAuthContext();
  const [value, setValue] = useState(current ?? '');
  const [saving, setSaving] = useState(false);
  const [update] = useMutation(UPDATE_USERNAME);

  // The field is uncontrolled by the server while typing, but a refresh
  // elsewhere (or the first load) has to land in it.
  useEffect(() => setValue(current ?? ''), [current]);

  const commit = async () => {
    const next = value.trim();
    if (saving || !next || next === current) {
      setValue(current ?? '');
      return;
    }
    setSaving(true);
    try {
      await update({ variables: { username: next } });
      await refreshUserInfo();
      toast.success('Username updated');
    } catch (error: any) {
      // The server owns the rules (length, characters, already taken), so
      // show what it said rather than guessing at a second copy of them.
      toast.error(error?.message ?? 'Could not update your username');
      setValue(current ?? '');
    } finally {
      setSaving(false);
    }
  };

  return (
    <input
      value={value}
      disabled={saving}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setValue(current ?? '');
          e.currentTarget.blur();
        }
      }}
      maxLength={32}
      aria-label="Username"
      className="w-56 rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm text-foreground transition-colors hover:border-primary/60 focus:border-primary focus:outline-none disabled:opacity-60"
    />
  );
}

/**
 * Change your own password.
 *
 * Collapsed to a button until asked for: this is the rare action on a page of
 * settings, and three password boxes sitting open is what a security page
 * looks like, not an account page.
 */
function PasswordField() {
  const { login } = useAuthContext();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setOpen(false);
    setCurrent('');
    setNext('');
    setConfirm('');
    setError(null);
  };

  const [changePassword, { loading }] = useMutation(CHANGE_PASSWORD, {
    onCompleted: (data) => {
      // The change ended every session including this one; these are the
      // replacements, so the tab the user is standing in stays signed in.
      login(data.changePassword.accessToken, data.changePassword.refreshToken);
      toast.success('Password changed — other devices were signed out');
      close();
    },
    // The server's own words ("Current password is incorrect"), not a guess.
    onError: (err) => setError(err.message),
  });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm text-foreground transition-colors hover:border-primary/60"
      >
        Change password
      </button>
    );
  }

  const field =
    'w-full rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm text-foreground focus:border-primary focus:outline-none';

  return (
    <form
      className="w-full max-w-xs space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        // The server never sees the confirm box, so it cannot catch this typo.
        if (next !== confirm) {
          setError('The two new passwords do not match.');
          return;
        }
        setError(null);
        changePassword({
          variables: { currentPassword: current, newPassword: next },
        });
      }}
    >
      <input
        type="password"
        value={current}
        onChange={(e) => {
          setCurrent(e.target.value);
          setError(null);
        }}
        placeholder="Current password"
        aria-label="Current password"
        autoComplete="current-password"
        required
        className={field}
      />
      <input
        type="password"
        value={next}
        onChange={(e) => {
          setNext(e.target.value);
          setError(null);
        }}
        placeholder="New password"
        aria-label="New password"
        autoComplete="new-password"
        minLength={8}
        required
        className={field}
      />
      <input
        type="password"
        value={confirm}
        onChange={(e) => {
          setConfirm(e.target.value);
          setError(null);
        }}
        placeholder="Confirm new password"
        aria-label="Confirm new password"
        autoComplete="new-password"
        required
        className={field}
      />
      {error && <p className="font-mono text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading || !current || !next || !confirm}
          className="rounded-md border border-primary bg-primary px-3 py-1.5 font-mono text-sm text-primary-foreground transition-opacity disabled:opacity-50"
        >
          {loading ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={close}
          className="rounded-md border border-border px-3 py-1.5 font-mono text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/**
 * Read-only field value: a chip on the page background (against the section's
 * card) with a mono tag so it reads as locked, not as a broken input.
 */
function ReadOnlyValue({ value }: { value?: string | null }) {
  return (
    <span
      aria-readonly="true"
      className="inline-flex max-w-full items-center gap-2.5 rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm text-muted-foreground"
    >
      <span className="min-w-0 break-all">{value || '—'}</span>
      <span className="shrink-0 whitespace-nowrap text-[10px] uppercase tracking-[0.12em] text-primary">
        read-only
      </span>
    </span>
  );
}

export default function UserSetting() {
  const { user } = useAuthContext();
  const [avatarUrl, setAvatarUrl] = useState('');
  // undefined until answered — see the Password row.
  const { data: passwordData } = useQuery(HAS_PASSWORD);
  const hasPassword: boolean | undefined = passwordData?.hasPassword;

  useEffect(() => {
    if (user) setAvatarUrl(user.avatarUrl || '');
  }, [user]);

  const avatarFallback = useMemo(
    () => (user?.username || 'US').substring(0, 2).toUpperCase(),
    [user?.username]
  );

  return (
    <div className="mx-auto w-full max-w-[880px] px-5 pb-24 pt-10 sm:px-8">
      <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-foreground">
        Settings
      </h1>
      <p className="mt-2 max-w-[52ch] font-mono text-sm text-muted-foreground">
        Your account and how CodeFox looks.
      </p>

      <div className="mt-12 space-y-14">
        <Section label="ACCOUNT">
          <Row title="Avatar" hint="Shown next to your projects and in chat.">
            <AvatarUploader
              currentAvatarUrl={avatarUrl}
              avatarFallback={avatarFallback}
              onAvatarChange={setAvatarUrl}
            />
          </Row>

          <Row
            title="Username"
            hint="Shown next to your projects in the gallery."
          >
            <UsernameField current={user?.username} />
          </Row>

          <Row title="Email" hint="The address you signed in with.">
            <ReadOnlyValue value={user?.email} />
          </Row>

          {/* Hidden entirely until the answer is known: rendering the form and
              then swapping it for "no password" reads as a bug. A Google
              account gets the explanation instead of a form that can only
              fail. */}
          {hasPassword !== undefined && (
            <Row
              title="Password"
              hint={
                hasPassword
                  ? 'Changing it signs out your other devices.'
                  : 'You sign in with Google, so there is no password to change.'
              }
            >
              {hasPassword ? (
                <PasswordField />
              ) : (
                <ReadOnlyValue value="Google sign-in" />
              )}
            </Row>
          )}
        </Section>

        <Section label="APPEARANCE">
          <Row title="Theme" hint="Warm dark, or the same palette on paper.">
            <ModeToggle />
          </Row>
        </Section>
      </div>
    </div>
  );
}

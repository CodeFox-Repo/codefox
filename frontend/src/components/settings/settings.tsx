'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ModeToggle } from '../mode-toggle';
import { AvatarUploader } from '../avatar-uploader';
import { useAuthContext } from '@/providers/AuthProvider';
import { gql, useMutation } from '@apollo/client';
import { toast } from 'sonner';

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
 * Read-only field value: a chip on the page background (against the section's
 * card) with a mono tag so it reads as locked, not as a broken input.
 */
function ReadOnlyValue({ value }: { value?: string | null }) {
  return (
    <span
      aria-readonly="true"
      className="inline-flex items-center gap-2.5 rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm text-muted-foreground"
    >
      {value || '—'}
      <span className="text-[10px] uppercase tracking-[0.12em] text-primary">
        read-only
      </span>
    </span>
  );
}

export default function UserSetting() {
  const { user } = useAuthContext();
  const [avatarUrl, setAvatarUrl] = useState('');

  useEffect(() => {
    if (user) setAvatarUrl(user.avatarUrl || '');
  }, [user]);

  const avatarFallback = useMemo(
    () => (user?.username || 'US').substring(0, 2).toUpperCase(),
    [user?.username]
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-5 pb-24 pt-10 sm:px-8">
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

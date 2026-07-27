'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ModeToggle } from '../mode-toggle';
import { AvatarUploader } from '../avatar-uploader';
import { useAuthContext } from '@/providers/AuthProvider';

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
    <section className="border-t-[3px] border-border pt-6">
      <h2 className="mb-5 font-mono text-sm tracking-[0.12em] text-primary">
        {label}
      </h2>
      {children}
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
    <div className="flex flex-wrap items-center justify-between gap-4 py-3">
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
    <div className="mx-auto w-full max-w-[1180px] px-5 pb-24 pt-4 sm:px-10">
      <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-foreground">
        Settings
      </h1>
      <p className="mt-2 max-w-[52ch] font-mono text-sm text-muted-foreground">
        Your account and how CodeFox looks.
      </p>

      <div className="mt-10 space-y-10">
        <Section label="ACCOUNT">
          <Row title="Avatar" hint="Shown next to your projects and in chat.">
            <AvatarUploader
              currentAvatarUrl={avatarUrl}
              avatarFallback={avatarFallback}
              onAvatarChange={setAvatarUrl}
            />
          </Row>

          {/* Read-only: the API exposes no mutation to change either yet. */}
          <Row title="Username" hint="Not editable yet.">
            <span className="font-mono text-sm text-muted-foreground">
              {user?.username || '—'}
            </span>
          </Row>

          <Row title="Email" hint="The address you signed in with.">
            <span className="font-mono text-sm text-muted-foreground">
              {user?.email || '—'}
            </span>
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

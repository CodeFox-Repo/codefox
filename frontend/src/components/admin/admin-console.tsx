'use client';

import { useQuery, useMutation } from '@apollo/client';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  ADMIN_DELETE_PROJECT,
  ADMIN_OVERVIEW,
  ADMIN_PROJECTS,
  ADMIN_SET_USER_ACTIVE,
  ADMIN_STOP_PREVIEW,
  ADMIN_SWEEP_ORPHANS,
  ADMIN_USERS,
} from '@/graphql/admin';

const bytes = (n: number) => {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(
    Math.floor(Math.log(n) / Math.log(1024)),
    units.length - 1
  );
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

const duration = (seconds: number) => {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
};

const day = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

/** Section rule and label, the rhythm the settings page and landing page use. */
function Section({
  label,
  action,
  children,
}: {
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t-[3px] border-border pt-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="font-mono text-sm uppercase tracking-[0.12em] text-primary">
          {label}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * A number worth watching.
 *
 * `tone` is reserved for values that mean someone has to act — an orphaned
 * directory is a gigabyte nothing will reclaim. Everything else stays neutral
 * so the one that matters is the one that stands out.
 */
function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'warn';
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1.5 font-display text-2xl font-bold tracking-[-0.02em] ${
          tone === 'warn' ? 'text-destructive' : 'text-foreground'
        }`}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

function Pill({
  children,
  muted,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <span
      className={`inline-block rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] ${
        muted
          ? 'border-border text-muted-foreground'
          : 'border-primary/40 text-primary'
      }`}
    >
      {children}
    </span>
  );
}

function Action({
  children,
  onClick,
  busy,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  busy?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className={`rounded-md border px-2.5 py-1 font-mono text-xs transition-colors disabled:opacity-40 ${
        danger
          ? 'border-border text-muted-foreground hover:border-destructive hover:text-destructive'
          : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
      }`}
    >
      {busy ? '…' : children}
    </button>
  );
}

const cell = 'px-3 py-2.5 text-left align-middle';

export default function AdminConsole() {
  const overview = useQuery(ADMIN_OVERVIEW, {
    fetchPolicy: 'cache-and-network',
    // The interesting numbers — running previews, disk — change without anyone
    // touching this page.
    pollInterval: 15_000,
  });
  const projects = useQuery(ADMIN_PROJECTS, {
    fetchPolicy: 'cache-and-network',
  });
  const users = useQuery(ADMIN_USERS, { fetchPolicy: 'cache-and-network' });

  const [pending, setPending] = useState<string | null>(null);
  const refetchAll = () =>
    Promise.all([overview.refetch(), projects.refetch(), users.refetch()]);

  const run = async (key: string, fn: () => Promise<unknown>, done: string) => {
    setPending(key);
    try {
      await fn();
      await refetchAll();
      toast.success(done);
    } catch (error) {
      toast.error((error as Error)?.message ?? 'Failed');
    } finally {
      setPending(null);
    }
  };

  const [deleteProject] = useMutation(ADMIN_DELETE_PROJECT);
  const [setUserActive] = useMutation(ADMIN_SET_USER_ACTIVE);
  const [stopPreview] = useMutation(ADMIN_STOP_PREVIEW);
  const [sweepOrphans] = useMutation(ADMIN_SWEEP_ORPHANS);

  // A non-admin reaches this page and the API refuses every query. Say so
  // plainly instead of rendering a console full of zeroes.
  const denied = overview.error?.message?.match(/role|auth/i);
  if (denied) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-20">
        <h1 className="font-display text-2xl font-bold tracking-[-0.02em]">
          Not your console
        </h1>
        <p className="mt-2 font-mono text-sm text-muted-foreground">
          This page needs the Admin role.
        </p>
      </main>
    );
  }

  const o = overview.data?.adminOverview;

  return (
    <main className="mx-auto w-full max-w-6xl space-y-12 px-6 py-12">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em] text-foreground">
          Console
        </h1>
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          {o
            ? `${o.runtime.nodeEnv} · ${o.runtime.provider} · ${o.runtime.model} · up ${duration(o.runtime.uptime)}`
            : 'loading…'}
        </p>
      </header>

      <Section label="At a glance">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Users" value={o?.counts.users ?? '—'} />
          <Stat
            label="Projects"
            value={o?.counts.projects ?? '—'}
            hint={o ? `${o.counts.deletedProjects} deleted` : undefined}
          />
          <Stat label="Chats" value={o?.counts.chats ?? '—'} />
          <Stat
            label="Disk"
            value={o ? bytes(o.disk.projectBytes) : '—'}
            hint={o ? `${o.disk.projectDirs} directories` : undefined}
          />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Running previews"
            value={o?.previews.length ?? '—'}
            hint="dev servers held open"
          />
          <Stat
            label="Orphan dirs"
            value={o?.disk.orphanDirs ?? '—'}
            hint={o?.disk.orphanDirs ? 'files with no project' : 'clean'}
            tone={o?.disk.orphanDirs ? 'warn' : undefined}
          />
          <Stat
            label="Sign-up"
            value={o ? (o.runtime.registrationOpen ? 'open' : 'closed') : '—'}
            hint="ALLOW_REGISTRATION"
          />
          <Stat
            label="Sandbox"
            value={o?.runtime.sandbox ?? '—'}
            hint="SANDBOX_PROVIDER"
          />
        </div>
      </Section>

      <Section
        label="Previews"
        action={
          o && o.disk.orphanDirs > 0 ? (
            <Action
              busy={pending === 'sweep'}
              onClick={() =>
                run(
                  'sweep',
                  () => sweepOrphans(),
                  'Reclaimed the orphaned directories'
                )
              }
            >
              Sweep {o.disk.orphanDirs} orphan
              {o.disk.orphanDirs === 1 ? '' : 's'}
            </Action>
          ) : undefined
        }
      >
        {o?.previews.length ? (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full min-w-[520px] font-mono text-xs">
              <tbody className="divide-y divide-border">
                {o.previews.map((p: any) => (
                  <tr key={p.projectPath}>
                    <td className={`${cell} text-foreground`}>
                      {p.projectPath}
                    </td>
                    <td className={`${cell} text-muted-foreground`}>
                      :{p.port}
                    </td>
                    <td className={`${cell} text-muted-foreground`}>
                      pid {p.pid}
                    </td>
                    <td className={`${cell} text-right`}>
                      <Action
                        danger
                        busy={pending === p.projectPath}
                        onClick={() =>
                          run(
                            p.projectPath,
                            () =>
                              stopPreview({
                                variables: { projectPath: p.projectPath },
                              }),
                            'Preview stopped'
                          )
                        }
                      >
                        stop
                      </Action>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="font-mono text-xs text-muted-foreground">
            Nothing running.
          </p>
        )}
      </Section>

      <Section label={`Projects (${projects.data?.adminProjects.length ?? 0})`}>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[720px] text-xs">
            <thead>
              <tr className="border-b border-border font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className={cell}>Name</th>
                <th className={cell}>Owner</th>
                <th className={cell}>Chats</th>
                <th className={cell}>State</th>
                <th className={cell}>Created</th>
                <th className={cell} />
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-mono">
              {projects.data?.adminProjects.map((p: any) => (
                <tr key={p.id}>
                  <td
                    className={`${cell} max-w-[220px] truncate text-foreground`}
                  >
                    {p.projectName}
                  </td>
                  <td className={`${cell} text-muted-foreground`}>
                    {p.ownerEmail}
                  </td>
                  <td className={`${cell} text-muted-foreground`}>{p.chats}</td>
                  <td className={`${cell} space-x-1.5`}>
                    {p.isPublic && <Pill>public</Pill>}
                    {!p.onDisk && <Pill muted>no files</Pill>}
                  </td>
                  <td className={`${cell} text-muted-foreground`}>
                    {day(p.createdAt)}
                  </td>
                  <td className={`${cell} text-right`}>
                    <Action
                      danger
                      busy={pending === p.id}
                      onClick={() =>
                        run(
                          p.id,
                          () =>
                            deleteProject({ variables: { projectId: p.id } }),
                          'Project deleted'
                        )
                      }
                    >
                      delete
                    </Action>
                  </td>
                </tr>
              ))}
              {!projects.data?.adminProjects.length && (
                <tr>
                  <td className={`${cell} text-muted-foreground`} colSpan={6}>
                    No projects.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Section label={`Users (${users.data?.adminUsers.length ?? 0})`}>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[680px] text-xs">
            <thead>
              <tr className="border-b border-border font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className={cell}>Email</th>
                <th className={cell}>Projects</th>
                <th className={cell}>Chats</th>
                <th className={cell}>Roles</th>
                <th className={cell}>Joined</th>
                <th className={cell} />
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-mono">
              {users.data?.adminUsers.map((u: any) => (
                <tr key={u.id} className={u.isActive ? '' : 'opacity-50'}>
                  <td className={`${cell} text-foreground`}>{u.email}</td>
                  <td className={`${cell} text-muted-foreground`}>
                    {u.projects}
                  </td>
                  <td className={`${cell} text-muted-foreground`}>{u.chats}</td>
                  <td className={`${cell} space-x-1.5`}>
                    {u.roles.map((r: string) => (
                      <Pill key={r}>{r}</Pill>
                    ))}
                    {!u.isActive && <Pill muted>disabled</Pill>}
                  </td>
                  <td className={`${cell} text-muted-foreground`}>
                    {day(u.createdAt)}
                  </td>
                  <td className={`${cell} text-right`}>
                    <Action
                      danger={u.isActive}
                      busy={pending === u.id}
                      onClick={() =>
                        run(
                          u.id,
                          () =>
                            setUserActive({
                              variables: {
                                userId: u.id,
                                isActive: !u.isActive,
                              },
                            }),
                          u.isActive ? 'User disabled' : 'User enabled'
                        )
                      }
                    >
                      {u.isActive ? 'disable' : 'enable'}
                    </Action>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </main>
  );
}

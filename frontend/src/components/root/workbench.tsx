'use client';

import Link from 'next/link';
import { useChatList } from '@/hooks/useChatList';
import { PromptForm, PromptFormRef } from '@/components/root/prompt-form';

interface WorkbenchProps {
  promptFormRef: React.RefObject<PromptFormRef>;
  onSubmit: () => void;
  isLoading: boolean;
}

const relativeTime = (value: string | number | Date) => {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '';
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

/**
 * The signed-in home. Deliberately not the landing page: someone with an
 * account does not need the pitch, they need the composer and their work.
 */
export function Workbench({
  promptFormRef,
  onSubmit,
  isLoading,
}: WorkbenchProps) {
  const { chats, loading } = useChatList();
  const recent = chats.slice(0, 9);

  return (
    <div className="mx-auto w-full max-w-[1180px] px-5 pb-24 pt-4 sm:px-10">
      <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-foreground">
        What are we building?
      </h1>

      <div className="mt-5 rounded-xl border border-border bg-card">
        <PromptForm
          ref={promptFormRef}
          isAuthorized
          compact
          onSubmit={onSubmit}
          onAuthRequired={() => {}}
          isLoading={isLoading}
        />
      </div>

      <section className="mt-14">
        <div className="mb-4 flex items-baseline justify-between border-t-[3px] border-border pt-5">
          <h2 className="font-mono text-sm tracking-[0.12em] text-primary">
            RECENT
          </h2>
          {recent.length > 0 && (
            <span className="font-mono text-xs text-muted-foreground">
              {chats.length} total
            </span>
          )}
        </div>

        {loading ? (
          <p className="font-mono text-sm text-muted-foreground">Loading…</p>
        ) : recent.length === 0 ? (
          <p className="font-mono text-sm text-muted-foreground">
            Nothing yet. Describe a project above to start one.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((chat) => (
              <li key={chat.id}>
                <Link
                  href={`/chat?id=${chat.id}`}
                  className="block rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/45"
                >
                  <p className="truncate font-medium text-foreground">
                    {chat.title || 'Untitled'}
                  </p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {relativeTime(chat.createdAt)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

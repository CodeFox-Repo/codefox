'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { useChatList } from '@/hooks/useChatList';
import { PromptForm, PromptFormRef } from '@/components/root/prompt-form';
import { PublicProjects } from '@/components/root/public-projects';

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
      <h1 className="text-balance font-display text-2xl font-bold tracking-[-0.02em] text-foreground">
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
          // A skeleton in the shape of the thing that is coming, rather than
          // the word "Loading" — the row keeps its height so the page below
          // does not jump when the data lands.
          <ul
            aria-hidden
            className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]"
          >
            {[0, 1, 2].map((i) => (
              <li
                key={i}
                className="h-[104px] animate-pulse rounded-xl border border-border bg-card"
              />
            ))}
          </ul>
        ) : recent.length === 0 ? (
          <p className="font-mono text-sm text-muted-foreground">
            Nothing yet. Describe a project above to start one.
          </p>
        ) : (
          // auto-fit, not a fixed three columns: a fixed grid left a third of
          // the row empty with two chats, and auto-fill was worse still — it
          // keeps the empty tracks, so the cards stayed narrow.
          <ul className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
            {recent.map((chat) => (
              <li key={chat.id}>
                <Link
                  href={`/chat?id=${chat.id}`}
                  className="group/card flex h-full flex-col justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/45"
                >
                  <p className="line-clamp-2 text-pretty font-medium leading-snug text-foreground">
                    {chat.title || 'Untitled'}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-muted-foreground">
                      {relativeTime(chat.createdAt)}
                    </span>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/card:opacity-100" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <PublicProjects limit={3} />
    </div>
  );
}

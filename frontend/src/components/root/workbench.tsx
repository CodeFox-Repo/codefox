'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@apollo/client';
import {
  ArrowUpRight,
  Copy,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useChatList } from '@/hooks/useChatList';
import {
  DELETE_CHAT,
  DELETE_PROJECT,
  DUPLICATE_PROJECT,
  UPDATE_CHAT_TITLE,
} from '@/graphql/request';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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
/**
 * Concrete enough that the agent builds instead of asking. Each one exercises
 * a different scenario the product already supports.
 */
const STARTERS = [
  'A SaaS landing page, dark, with a pricing section',
  'A personal homepage with an about section and links',
  'An analytics dashboard with KPI cards and a line chart',
  'A launch announcement email with one call to action',
  'A pricing comparison of three plans, with a recommendation',
];

export function Workbench({
  promptFormRef,
  onSubmit,
  isLoading,
}: WorkbenchProps) {
  const { chats, loading, refetchChats } = useChatList();
  // Nine keeps the grid tidy, but the tenth project must not be unreachable.
  const [showAll, setShowAll] = useState(false);
  const recent = showAll ? chats : chats.slice(0, 9);

  // With the sidebar gone, the cards are where a project gets renamed or
  // deleted. One dialog serves both, keyed by mode.
  const [action, setAction] = useState<{
    mode: 'rename' | 'delete';
    id: string;
    title: string;
    /** Absent only for a chat that never got a project scaffolded. */
    projectId?: string;
  } | null>(null);
  const [draft, setDraft] = useState('');

  const [updateTitle] = useMutation(UPDATE_CHAT_TITLE, {
    onCompleted: () => refetchChats(),
    onError: () => toast.error('Could not rename the project'),
  });
  const deleted = {
    onCompleted: () => {
      toast.success('Project deleted');
      refetchChats();
    },
    onError: () => toast.error('Could not delete the project'),
  };
  // deleteProject already marks every chat of the project deleted and reclaims
  // the workspace, so it is the whole delete. deleteChat is the fallback for a
  // chat whose project never got scaffolded — there is nothing else to reclaim.
  const [deleteProject] = useMutation(DELETE_PROJECT, deleted);
  const [duplicate] = useMutation(DUPLICATE_PROJECT, deleted);
  const [duplicating, setDuplicating] = useState(false);
  const router = useRouter();
  const [deleteChat] = useMutation(DELETE_CHAT, deleted);

  const commitRename = () => {
    const next = draft.trim();
    if (action && next && next !== action.title) {
      updateTitle({ variables: { input: { chatId: action.id, title: next } } });
    }
    setAction(null);
  };

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
          {chats.length > 9 ? (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {showAll ? 'Show recent' : `Show all ${chats.length}`}
            </button>
          ) : (
            recent.length > 0 && (
              <span className="font-mono text-xs text-muted-foreground">
                {chats.length} total
              </span>
            )
          )}
        </div>

        {loading && chats.length === 0 ? (
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
          <div className="space-y-4">
            <p className="font-mono text-sm text-muted-foreground">
              Nothing yet. Describe a project above — or start from one of
              these.
            </p>
            {/* Specific enough to build from directly: "a website" gets you a
                question card, which is the right answer to a vague brief and
                the wrong first experience. Each names a kind, a look and one
                concrete section, so the agent has everything it needs. */}
            <ul className="flex flex-wrap gap-2">
              {STARTERS.map((starter) => (
                <li key={starter}>
                  <button
                    type="button"
                    onClick={() => {
                      promptFormRef.current?.setMessage(starter);
                      // The composer is above the fold on desktop and off it
                      // on a phone; without this the click looks like nothing
                      // happened.
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="rounded-lg border border-border bg-card px-3 py-2 text-left font-mono text-xs text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
                  >
                    {starter}
                  </button>
                </li>
              ))}
            </ul>
            <p className="font-mono text-xs text-muted-foreground">
              Or{' '}
              <a
                href="#built-with-codefox"
                className="text-primary underline-offset-4 hover:underline"
              >
                see what others made
              </a>{' '}
              — remixing one is a shorter road than a blank box.
            </p>
          </div>
        ) : (
          // auto-fit, not a fixed three columns: a fixed grid left a third of
          // the row empty with two chats, and auto-fill was worse still — it
          // keeps the empty tracks, so the cards stayed narrow.
          <ul className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
            {recent.map((chat) => (
              <li key={chat.id} className="group/card relative">
                {/* Above the Link so opening the menu does not navigate. */}
                <div className="absolute right-2 top-2 z-10 opacity-0 transition-opacity focus-within:opacity-100 group-hover/card:opacity-100">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label="Project options"
                        className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        <MoreHorizontal size={14} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() =>
                          setTimeout(() => {
                            setDraft(chat.title || '');
                            setAction({
                              mode: 'rename',
                              id: chat.id,
                              title: chat.title || '',
                            });
                          }, 0)
                        }
                      >
                        <Pencil className="mr-2 h-4 w-4 shrink-0" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={!chat.project?.id || duplicating}
                        onSelect={() => {
                          const projectId = chat.project?.id;
                          if (!projectId) return;
                          setDuplicating(true);
                          duplicate({ variables: { projectId } })
                            .then(({ data }) => {
                              const id = data?.duplicateProject?.id;
                              toast.success('Copied — opening it now');
                              if (id) router.push(`/chat?id=${id}`);
                            })
                            // The server's words: the quota refusal names the
                            // limit and the way out.
                            .catch((e) => toast.error(e.message))
                            .finally(() => setDuplicating(false));
                        }}
                      >
                        <Copy className="mr-2 h-4 w-4 shrink-0" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() =>
                          setTimeout(
                            () =>
                              setAction({
                                mode: 'delete',
                                id: chat.id,
                                title: chat.title || 'Untitled',
                                projectId: chat.project?.id,
                              }),
                            0
                          )
                        }
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4 shrink-0" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <Link
                  href={`/chat?id=${chat.id}`}
                  className="flex h-full flex-col justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/45"
                >
                  <p className="line-clamp-2 text-pretty font-medium leading-snug text-foreground">
                    {chat.title || 'Untitled'}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-muted-foreground">
                      {/* <time> so "2h ago" carries the real timestamp for a
                          crawler and a screen reader; the text stays relative
                          because that is what a person wants to read. */}
                      <time dateTime={new Date(chat.createdAt).toISOString()}>
                        {relativeTime(chat.createdAt)}
                      </time>
                      <span className="mx-1.5 opacity-40">·</span>
                      {/* Projects from before the template column are Next apps. */}
                      {chat.project?.template === 'html' ? 'Page' : 'Next.js'}
                      {chat.project?.isPublic && (
                        <>
                          <span className="mx-1.5 opacity-40">·</span>
                          <span className="text-primary">Public</span>
                        </>
                      )}
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

      <Dialog
        open={action !== null}
        onOpenChange={(o) => !o && setAction(null)}
      >
        <DialogContent>
          {action?.mode === 'rename' ? (
            <DialogHeader className="space-y-4">
              <DialogTitle>Rename project</DialogTitle>
              <Input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && commitRename()}
                aria-label="Project title"
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAction(null)}>
                  Cancel
                </Button>
                <Button onClick={commitRename}>Save</Button>
              </div>
            </DialogHeader>
          ) : (
            <DialogHeader className="space-y-4">
              <DialogTitle>Delete project?</DialogTitle>
              <DialogDescription>
                “{action?.title}”, its chat history, and the generated files
                will be removed. This cannot be undone.
              </DialogDescription>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAction(null)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (action?.projectId) {
                      deleteProject({
                        variables: { projectId: action.projectId },
                      });
                    } else if (action) {
                      deleteChat({ variables: { chatId: action.id } });
                    }
                    setAction(null);
                  }}
                >
                  Delete
                </Button>
              </div>
            </DialogHeader>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

'use client';

import { useContext, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { GitFork, ImageOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { FETCH_PUBLIC_PROJECTS } from '@/graphql/request';
import { ProjectContext } from '@/components/chat/code-engine/project-context';
import { useAuthContext } from '@/providers/AuthProvider';
import { mediaUrl } from '@/lib/media';
import { shareUrl } from '@/lib/share';

interface PublicProject {
  id: string;
  projectName: string;
  /** The share id — what /share/<id> serves. */
  uniqueProjectId?: string | null;
  template?: string | null;
  userId?: string | null;
  photoUrl?: string | null;
  subNumber?: number | null;
  user?: { username?: string | null } | null;
}

/**
 * The cover, as a link when the project is a page anyone can open. Next apps
 * have no shareable url, so theirs stays a plain tile rather than a link that
 * goes nowhere.
 */
function ShareLink({
  href,
  className,
  label,
  children,
}: {
  href: string | null;
  className: string;
  label: string;
  children: React.ReactNode;
}) {
  if (!href) return <div className={className}>{children}</div>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={label}
      className={className}
    >
      {children}
    </a>
  );
}

/**
 * Projects other people published.
 *
 * The backend only serves projects that have a cover, so the coverless
 * branch below is a fallback for a photoUrl that 404s rather than the normal
 * case — a wall of "no preview yet" tiles showcases nothing.
 */
export function PublicProjects({ limit = 6 }: { limit?: number }) {
  const router = useRouter();
  const { isAuthorized, user } = useAuthContext();
  const { forkProject } = useContext(ProjectContext);
  const [forking, setForking] = useState<string | null>(null);

  const { data, loading } = useQuery(FETCH_PUBLIC_PROJECTS, {
    variables: { input: { size: limit, strategy: 'latest' } },
  });

  const projects: PublicProject[] = data?.fetchPublicProjects ?? [];
  const empty = !loading && projects.length === 0;

  const handleFork = async (id: string) => {
    if (!isAuthorized) {
      // On the landing page this button is already at '/' — navigating there
      // was a silent no-op. Say what signing in unlocks instead.
      toast.info('Sign in to remix a project into your workspace.');
      return;
    }
    setForking(id);
    const chatId = await forkProject(id);
    setForking(null);
    if (chatId) router.push(`/chat?id=${chatId}`);
  };

  // The share page's Remix button lands here as `?remix=<uniqueProjectId>`.
  // It runs the same handleFork the cards use — auth prompt, quota message
  // and double-click guard all come along rather than being rebuilt.
  //
  // The param is dropped BEFORE forking, so a refresh mid-fork cannot start a
  // second one; `claimed` covers the same tick, since this effect reruns when
  // the wall loads and when signing in flips isAuthorized.
  const remixParam = useSearchParams().get('remix');
  const claimed = useRef<string | null>(null);
  useEffect(() => {
    if (!remixParam || claimed.current === remixParam) return;
    // `remixParam` is the project's row id — what forkProject takes — so it
    // does NOT need to be on the wall. Matching against the wall is what
    // limited remixing to the newest six public projects; anything older
    // resolved to nothing and the click did nothing at all.
    const match = projects.find((p) => p.id === remixParam);
    const name = match?.projectName ?? 'this project';
    // Signed out: keep the param so signing in re-runs this effect and the
    // remix survives the round trip. Clearing it here is how the intent gets
    // lost between "sign in" and being signed in.
    if (!isAuthorized) {
      toast.info(`Sign in to remix ${name}.`);
      return;
    }
    claimed.current = remixParam;
    router.replace('/', { scroll: false });
    toast.info(`Remixing ${name}…`);
    void handleFork(remixParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remixParam, projects, isAuthorized]);

  return (
    // The id is the empty state's "see what others made" target.
    <section id="built-with-codefox" className="mt-14 pb-4">
      <div className="mb-5 flex items-baseline justify-between border-t-[3px] border-border pt-6">
        <h2 className="font-mono text-sm tracking-[0.12em] text-primary">
          BUILT WITH CODEFOX
        </h2>
        <span className="font-mono text-xs text-muted-foreground">
          remix any of them
        </span>
      </div>

      {loading ? (
        <ul
          aria-hidden
          className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]"
        >
          {[0, 1, 2].map((i) => (
            <li
              key={i}
              className="animate-pulse overflow-hidden rounded-xl border border-border bg-card"
            >
              <div className="aspect-[16/10] bg-secondary" />
              <div className="h-[68px]" />
            </li>
          ))}
        </ul>
      ) : empty ? (
        // The section used to disappear when nothing was public, which left a
        // hole where the showcase belongs and told a new user nothing. Hold
        // the space and say what would fill it.
        <div className="rounded-xl border border-dashed border-border bg-card/40 px-6 py-14 text-center">
          <p className="font-medium text-foreground">Nothing published yet</p>
          <p className="mx-auto mt-2 max-w-[52ch] text-pretty text-sm leading-relaxed text-muted-foreground">
            A project appears here once it is public and has a cover. The cover
            is a shot of the page itself, taken the first time its preview
            renders — so make one of yours public, open it, and it joins the
            wall.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
          {projects.map((p) => (
            <li
              key={p.id}
              className="group/card overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/45"
            >
              <ShareLink
                href={shareUrl(p)}
                className="relative block aspect-[16/10] overflow-hidden bg-secondary"
                label={`Open ${p.projectName}`}
              >
                {p.photoUrl ? (
                  <Image
                    src={mediaUrl(p.photoUrl)}
                    alt={`${p.projectName} preview`}
                    fill
                    sizes="(max-width: 640px) 100vw, 33vw"
                    className="object-cover object-top transition-transform duration-500 group-hover/card:scale-[1.03]"
                  />
                ) : (
                  // Without this the tile was an empty rectangle that read as a
                  // broken image. Say which state it is instead: the project is
                  // real and forkable, its preview simply has not run.
                  <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
                    <ImageOff
                      className="h-5 w-5 text-muted-foreground/60"
                      aria-hidden
                    />
                    <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                      No preview yet
                    </p>
                  </div>
                )}
              </ShareLink>

              <div className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">
                    {p.projectName}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {p.user?.username ?? 'anonymous'}
                    {p.subNumber
                      ? ` · ${p.subNumber} remix${p.subNumber === 1 ? '' : 'es'}`
                      : ''}
                  </p>
                </div>

                {/* The API refuses to fork a project back to its own owner,
                    so offering the action here could only ever fail. */}
                {user?.id && p.userId === user.id ? (
                  <span className="shrink-0 rounded-lg border border-border px-3 py-1.5 font-mono text-xs text-muted-foreground">
                    Yours
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleFork(p.id)}
                    disabled={forking === p.id}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:border-primary disabled:opacity-50"
                  >
                    {forking === p.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <GitFork className="h-3.5 w-3.5" />
                    )}
                    Remix
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

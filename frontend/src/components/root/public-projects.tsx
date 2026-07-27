'use client';

import { useContext, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client';
import { GitFork, Loader2 } from 'lucide-react';
import { FETCH_PUBLIC_PROJECTS } from '@/graphql/request';
import { ProjectContext } from '@/components/chat/code-engine/project-context';
import { useAuthContext } from '@/providers/AuthProvider';
import { mediaUrl } from '@/lib/media';

interface PublicProject {
  id: string;
  projectName: string;
  userId?: string | null;
  photoUrl?: string | null;
  subNumber?: number | null;
  user?: { username?: string | null } | null;
}

/**
 * Projects other people published.
 *
 * The backend only surfaces projects that have a cover image, so a card
 * always has something to show — no placeholder tiles.
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
  if (!loading && projects.length === 0) return null;

  const handleFork = async (id: string) => {
    if (!isAuthorized) {
      router.push('/');
      return;
    }
    setForking(id);
    const chatId = await forkProject(id);
    setForking(null);
    if (chatId) router.push(`/chat?id=${chatId}`);
  };

  return (
    <section className="pb-4">
      <div className="mb-5 flex items-baseline justify-between border-t-[3px] border-border pt-6">
        <h2 className="font-mono text-sm tracking-[0.12em] text-primary">
          BUILT WITH CODEFOX
        </h2>
        <span className="font-mono text-xs text-muted-foreground">
          fork any of them
        </span>
      </div>

      {loading ? (
        <p className="font-mono text-sm text-muted-foreground">Loading…</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <li
              key={p.id}
              className="group/card overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/45"
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-secondary">
                {p.photoUrl && (
                  <Image
                    src={mediaUrl(p.photoUrl)}
                    alt={`${p.projectName} preview`}
                    fill
                    sizes="(max-width: 640px) 100vw, 33vw"
                    className="object-cover object-top transition-transform duration-500 group-hover/card:scale-[1.03]"
                  />
                )}
              </div>

              <div className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">
                    {p.projectName}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {p.user?.username ?? 'anonymous'}
                    {p.subNumber ? ` · ${p.subNumber} forks` : ''}
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
                    Fork
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

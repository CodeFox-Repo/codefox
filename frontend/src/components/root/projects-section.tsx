'use client';

import { useQuery } from '@apollo/client';
import { FETCH_PUBLIC_PROJECTS } from '@/graphql/request';
import { ExpandableCard } from './expand-card';
import { useContext, useEffect, useState, useMemo } from 'react';
import { ProjectContext } from '../chat/code-engine/project-context';
import { redirectChatPage } from '../chat-page-navigation';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/providers/AuthProvider';
import { Project } from '../chat/project-modal';

export function ProjectsSection() {
  const [view, setView] = useState<'my' | 'community'>('my');
  const { user } = useAuthContext();
  const {
    setChatId,
    pendingProjects,
    setPendingProjects,
    setRefetchPublicProjects,
  } = useContext(ProjectContext);
  const [currentChatid, setCurrentChatid] = useState('');
  const [publicRefreshCounter, setPublicRefreshCounter] = useState(0); // ✅ NEW
  const router = useRouter();

  const { data, loading, error, refetch } = useQuery(FETCH_PUBLIC_PROJECTS, {
    variables: { input: { size: 100, strategy: 'latest' } },
    fetchPolicy: 'network-only',
  });
  const { tempLoadingProjectId } = useContext(ProjectContext);

  useEffect(() => {
    setRefetchPublicProjects(() => async () => {
      setPublicRefreshCounter((prev) => prev + 1);
      return await refetch();
    });
  }, [refetch, setRefetchPublicProjects]);

  useEffect(() => {
    refetch();
  }, [publicRefreshCounter]);

  const allProjects = data?.fetchPublicProjects || [];

  useEffect(() => {
    const realProjectMap = new Map<string, Project>(
      allProjects.map((p) => [p.id, p])
    );

    setPendingProjects((prev) => {
      const newPending = prev.filter((p) => {
        const real = realProjectMap.get(p.id);
        console.log('[Check Pending]', {
          pendingId: p.id,
          pendingName: p.projectName,
          real: real ?? '❌ not found',
          projectPath: real?.projectPath ?? 'N/A',
        });
        return !real || !real.projectPath;
      });

      return newPending.length === prev.length ? prev : newPending;
    });
  }, [allProjects, pendingProjects, setPendingProjects]);

  useEffect(() => {
    console.log(
      '[Effect] All realProjects updated:',
      allProjects.map((p) => ({ id: p.id, path: p.projectPath }))
    );
  }, [allProjects]);

  const mergedProjects = useMemo(() => {
    const map = new Map<string, any>();

    pendingProjects.forEach((p) => {
      map.set(p.id, {
        ...p,
        isReady: Boolean(p.projectPath),
        _source: 'pending',
      });
    });

    allProjects.forEach((p) => {
      map.set(p.id, {
        ...p,
        isReady: Boolean(p.projectPath),
        _source: 'real',
      });
    });

    return Array.from(map.values());
  }, [pendingProjects, allProjects]);

  const filteredProjects = useMemo(() => {
    if (!user?.id) return view === 'my' ? [] : mergedProjects;

    return mergedProjects.filter(
      (project) =>
        view === 'my' ? project.userId === user.id : project.userId !== user.id // community 只要不是自己即可
    );
  }, [mergedProjects, user?.id, view]);

  const transformedProjects = filteredProjects.map((project) => {
    return {
      id: project.id,
      name: project.projectName,
      path: project.projectPath,
      isReady: project.isReady,
      createDate: project.createdAt
        ? new Date(project.createdAt).toISOString().split('T')[0]
        : '2025-01-01',
      author: project.user?.username || 'Unknown',
      forkNum: project.subNumber || 0,
      image: project.isReady
        ? project.photoUrl ||
          `https://picsum.photos/500/250?random=${project.id}`
        : '/placeholder-black.png',
    };
  });

  const handleOpenChat = (chatId: string) => {
    redirectChatPage(chatId, setCurrentChatid, setChatId, router);
  };

  return (
    <section className="w-full max-w-7xl mx-auto px-4">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold dark:text-white">
            {view === 'my' ? 'My Projects' : 'Community Projects'}
          </h2>
          <div className="flex gap-2">
            <Button
              variant={view === 'my' ? 'default' : 'outline'}
              onClick={() => setView('my')}
            >
              My Projects
            </Button>
            <Button
              variant={view === 'community' ? 'default' : 'outline'}
              onClick={() => setView('community')}
            >
              Community
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-10">Loading...</div>
        ) : error ? (
          <div className="text-center py-10 text-red-500">
            Error: {error.message}
          </div>
        ) : (
          <>
            {view === 'my' && tempLoadingProjectId && (
              <ExpandableCard
                key={`loading-${tempLoadingProjectId}`}
                projects={[
                  {
                    id: tempLoadingProjectId,
                    name: 'Generating Project...',
                    image: '/placeholder-black.png', // 或者 '/loading.gif' 如果你有
                    isReady: false,
                    createDate: new Date().toISOString().split('T')[0],
                    author: user?.username || 'Unknown',
                    forkNum: 0,
                    path: '',
                  },
                ]}
                isGenerating={true}
                onOpenChat={() =>
                  redirectChatPage(
                    tempLoadingProjectId,
                    setCurrentChatid,
                    setChatId,
                    router
                  )
                }
              />
            )}

            {transformedProjects.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {transformedProjects.map((project) => (
                  <ExpandableCard
                    key={project.id}
                    projects={[project]}
                    isGenerating={!project.isReady}
                    onOpenChat={() => handleOpenChat(project.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-gray-500 dark:text-gray-400">
                No projects available.
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

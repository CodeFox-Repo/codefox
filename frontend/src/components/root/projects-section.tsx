'use client';

import { useQuery } from '@apollo/client';
import { FETCH_PUBLIC_PROJECTS, GET_USER_PROJECTS } from '@/graphql/request';
import { ExpandableCard } from './expand-card';
import { useContext, useEffect, useMemo, useState } from 'react';
import { ProjectContext } from '../chat/code-engine/project-context';
import { redirectChatPage } from '../chat-page-navigation';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/providers/AuthProvider';
import { Project } from '../chat/project-modal';

export function ProjectsSection() {
  const [view, setView] = useState<'my' | 'community'>('my');
  const { user } = useAuthContext();
  const router = useRouter();

  const {
    setChatId,
    pendingProjects,
    setPendingProjects,
    setRefetchPublicProjects,
    tempLoadingProjectId,
  } = useContext(ProjectContext);

  const [currentChatid, setCurrentChatid] = useState('');
  const [publicRefreshCounter, setPublicRefreshCounter] = useState(0);

  // Fetch both public and user projects
  const {
    data: publicData,
    loading: publicLoading,
    error: publicError,
    refetch: refetchPublic,
  } = useQuery(FETCH_PUBLIC_PROJECTS, {
    variables: { input: { size: 100, strategy: 'latest' } },
    fetchPolicy: 'network-only',
  });

  const {
    data: userData,
    loading: userLoading,
    error: userError,
    refetch: refetchUser,
  } = useQuery(GET_USER_PROJECTS, {
    fetchPolicy: 'network-only',
  });

  useEffect(() => {
    setRefetchPublicProjects(() => async () => {
      setPublicRefreshCounter((prev) => prev + 1);
      await refetchPublic();
      return await refetchUser();
    });
  }, [refetchPublic, refetchUser, setRefetchPublicProjects]);

  useEffect(() => {
    refetchPublic();
    refetchUser();
  }, [publicRefreshCounter]);

  const publicProjects = publicData?.fetchPublicProjects || [];
  const userProjects = userData?.getUserProjects || [];

  useEffect(() => {
    const realMap = new Map(userProjects.map((p: Project) => [p.id, p]));

    setPendingProjects((prev) => {
      const next = prev.filter((p) => {
        const real = realMap.get(p.id) as Project | undefined;
        return !real || !real.projectPath;
      });
      return next.length === prev.length ? prev : next;
    });
  }, [userProjects, setPendingProjects]);

  const mergedMyProjects = useMemo(() => {
    const map = new Map<string, Project>();

    pendingProjects.forEach((p) =>
      map.set(p.id, {
        ...p,
        userId: String(p.userId ?? user?.id),
      })
    );
    userProjects.forEach((p) => map.set(p.id, p));

    return Array.from(map.values());
  }, [pendingProjects, userProjects, user?.id]);

  const displayProjects = view === 'my' ? mergedMyProjects : publicProjects;

  const transformedProjects = displayProjects.map((project) => ({
    id: project.id,
    name: project.projectName || project.title || 'Untitled Project',
    path: project.projectPath ?? '',
    isReady: !!project.projectPath,
    createDate: project.createdAt
      ? new Date(project.createdAt).toISOString().split('T')[0]
      : 'N/A',
    author: project.user?.username || user?.username || 'Unknown',
    forkNum: project.subNumber || 0,
    image: project.projectPath
      ? project.photoUrl || `https://picsum.photos/500/250?random=${project.id}`
      : null,
  }));

  const handleOpenChat = (chatId: string) => {
    redirectChatPage(chatId, setCurrentChatid, setChatId, router);
  };

  const loading = view === 'my' ? userLoading : publicLoading;
  const error = view === 'my' ? userError : publicError;

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
                    image: null,
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

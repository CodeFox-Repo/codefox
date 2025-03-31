'use client';

import { useQuery } from '@apollo/client';
import { FETCH_PUBLIC_PROJECTS } from '@/graphql/request';
import { ExpandableCard } from './expand-card';
import { useContext, useState } from 'react';
import { ProjectContext } from '../chat/code-engine/project-context';
import { redirectChatPage } from '../chat-page-navigation';
import { Button } from '@/components/ui/button';
import { RotateCwIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/providers/AuthProvider';

export function ProjectsSection() {
  const [view, setView] = useState<'my' | 'community'>('my');

  const { user } = useAuthContext();
  const username = user?.username || '';
  const { setChatId } = useContext(ProjectContext);
  const [currentChatid, setCurrentChatid] = useState('');
  const router = useRouter();

  const { data, loading, error } = useQuery(FETCH_PUBLIC_PROJECTS, {
    variables: { input: { size: 100, strategy: 'latest' } },
  });

  const allProjects = data?.fetchPublicProjects || [];

  // 筛选我的项目 vs 社区项目
  const filteredProjects = allProjects.filter((project) => {
    const projectUsername = project.user?.username || '';
    return view === 'my'
      ? projectUsername === username
      : projectUsername !== username;
  });

  const transformedProjects = filteredProjects.map((project) => {
    const isReady = Boolean(project.projectPath);
    return {
      id: project.id,
      name: project.projectName,
      path: project.projectPath,
      isReady,
      createDate: project.createdAt
        ? new Date(project.createdAt).toISOString().split('T')[0]
        : '2025-01-01',
      author: project.user?.username || 'Unknown',
      forkNum: project.subNumber || 0,
      image:
        project.photoUrl ||
        `https://picsum.photos/500/250?random=${project.id}`,
    };
  });

  const handleOpenChat = (chatId: string) => {
    redirectChatPage(chatId, setCurrentChatid, setChatId, router);
  };

  return (
    <section className="w-full max-w-7xl mx-auto px-4">
      <div className="mb-8">
        {/* Header with View Toggle */}
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

        {/* Content */}
        {loading ? (
          <div className="text-center py-10">Loading...</div>
        ) : error ? (
          <div className="text-center py-10 text-red-500">
            Error: {error.message}
          </div>
        ) : (
          <>
            {transformedProjects.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {transformedProjects.map((project) =>
                  view === 'my' && !project.isReady ? (
                    <div
                      key={project.id}
                      className="border border-gray-200 dark:border-zinc-700 rounded-lg p-6 flex flex-col justify-center items-center bg-gray-50 dark:bg-zinc-800 text-center"
                    >
                      <RotateCwIcon className="animate-spin h-6 w-6 text-gray-500 mb-3" />
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        Generating project...
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenChat(project.id)}
                      >
                        Open Chat
                      </Button>
                    </div>
                  ) : (
                    <ExpandableCard key={project.id} projects={[project]} />
                  )
                )}
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

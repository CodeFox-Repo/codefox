// GlobalToastListener.tsx
'use client';
import { useContext, useEffect } from 'react';
import { toast } from 'sonner'; // 或你使用的 toast 库
import { ProjectContext } from './chat/code-engine/project-context';

const GlobalToastListener = () => {
  const { recentlyCompletedProjectId, setRecentlyCompletedProjectId } =
    useContext(ProjectContext);

  useEffect(() => {
    if (recentlyCompletedProjectId) {
      toast.success('Project is ready! 🎉');

      // 可选：重置，避免重复 toast
      setRecentlyCompletedProjectId(null);
    }
  }, [recentlyCompletedProjectId]);

  return null; // 不渲染任何内容，只是监听
};

export default GlobalToastListener;

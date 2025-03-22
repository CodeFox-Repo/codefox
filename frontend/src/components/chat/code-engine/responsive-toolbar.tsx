'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Code as CodeIcon,
  Copy,
  Download,
  Eye,
  GitFork,
  Github,
  Share2,
  Terminal,
  Loader,
} from 'lucide-react';
import { useAuthContext } from '@/providers/AuthProvider';
import { logger } from '@/app/log/logger';
import { useMutation, useQuery, gql } from '@apollo/client';
import { toast } from 'sonner';
import { SYNC_PROJECT_TO_GITHUB, GET_PROJECT } from '../../../graphql/request';

interface ResponsiveToolbarProps {
  isLoading: boolean;
  activeTab: 'preview' | 'code' | 'console';
  setActiveTab: (tab: 'preview' | 'code' | 'console') => void;
  projectId?: string;
}

const ResponsiveToolbar = ({
  isLoading,
  activeTab,
  setActiveTab,
  projectId,
}: ResponsiveToolbarProps) => {
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(700);
  const [visibleTabs, setVisibleTabs] = useState(3);
  const [compactIcons, setCompactIcons] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const { token, user, refreshUserInfo } = useAuthContext();

  // Poll for GitHub installation status when needed
  const [isPollingGitHub, setIsPollingGitHub] = useState(false);

  // Apollo mutations and queries
  const [syncProject, { loading: isPublishingToGitHub }] = useMutation(
    SYNC_PROJECT_TO_GITHUB,
    {
      onCompleted: (data) => {
        const syncResult = data.syncProjectToGitHub;

        toast.success('Successfully published to GitHub!');

        // Offer to open the repo in a new tab
        const repoUrl = syncResult.githubRepoUrl;
        console.log('GitHub repo URL:', repoUrl);
        if (repoUrl) {
          const shouldOpen = window.confirm(
            'Would you like to open the GitHub repository?'
          );
          if (shouldOpen) {
            window.open(repoUrl, '_blank');
          }
        }
      },
      onError: (error) => {
        logger.error('Error publishing to GitHub:', error);
        toast.error(`Error publishing to GitHub: ${error.message}`);
      },
    }
  );

  // Query to check if the project is already synced
  const { data: projectData } = useQuery(GET_PROJECT, {
    variables: { projectId },
    skip: !projectId,
    fetchPolicy: 'cache-and-network',
  });

  // Determine if GitHub sync is complete based on query data
  const isGithubSyncComplete =
    projectData?.getProject?.isSyncedWithGitHub || false;

  const githubRepoUrl = projectData?.getProject?.githubRepoUrl || '';

  // Observe container width changes
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  // Adjust visible tabs and icon style based on container width
  useEffect(() => {
    if (containerWidth > 650) {
      setVisibleTabs(3);
      setCompactIcons(false);
    } else if (containerWidth > 550) {
      setVisibleTabs(2);
      setCompactIcons(false);
    } else if (containerWidth > 450) {
      setVisibleTabs(1);
      setCompactIcons(true);
    } else {
      setVisibleTabs(0);
      setCompactIcons(true);
    }
  }, [containerWidth]);

  // Poll for GitHub installation completion
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;

    if (isPollingGitHub) {
      pollInterval = setInterval(async () => {
        console.log('Polling backend for GitHub installation status...');
        try {
          // Call to refresh user info (from backend)
          await refreshUserInfo();

          // Check if user now has installation ID
          if (user?.githubInstallationId) {
            console.log('GitHub installation complete!');
            setIsPollingGitHub(false);
            clearInterval(pollInterval);
          }
        } catch (error) {
          logger.error('Polling error:', error);
          setIsPollingGitHub(false);
        }
      }, 3000); // Poll every 3s
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [isPollingGitHub, user?.githubInstallationId, refreshUserInfo]);

  const handlePublishToGitHub = async () => {
    // If already publishing, do nothing
    if (isPublishingToGitHub) return;

    // If the user hasn't installed the GitHub App yet
    if (!user?.githubInstallationId) {
      try {
        // Prompt the user to install the GitHub App
        const shouldInstall = window.confirm(
          'You need to install the GitHub App to publish your project. Would you like to do this now?'
        );

        if (shouldInstall) {
          // Start polling for installation completion
          setIsPollingGitHub(true);

          // This format ensures GitHub will prompt the user to choose where to install
          const installUrl = `https://github.com/apps/codefox-project-fork/installations/new`;
          window.open(installUrl, '_blank');
        }
        return;
      } catch (error) {
        logger.error('Error opening GitHub installation:', error);
        setIsPollingGitHub(false);
        toast.error(
          'Error opening GitHub installation page. Please try again.'
        );
        return;
      }
    }

    // Ensure we have a project ID
    if (!projectId) {
      toast.error('Cannot publish: No project ID available');
      return;
    }

    // If already synced and we have the URL, offer to open it
    if (isGithubSyncComplete && githubRepoUrl) {
      const shouldOpen = window.confirm(
        'This project is already published to GitHub. Would you like to open the repository?'
      );
      if (shouldOpen) {
        window.open(projectData.getProject.githubRepoUrl, '_blank');
      }
      return;
    }

    // Execute the mutation
    try {
      await syncProject({
        variables: {
          projectId,
        },
      });
    } catch (error) {
      // Error is handled by the mutation's onError callback
      logger.error('Error in handlePublishToGitHub:', error);
    }
  };

  const handleDownload = async () => {
    // If projectId is available, initiate download
    if (projectId && !isDownloading) {
      setIsDownloading(true);
      try {
        // Create a hidden anchor element for download
        const a = document.createElement('a');

        const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';
        // Set the download URL with credentials included
        const downloadUrl = `${backendUrl}/download/project/${projectId}`;

        const headers = new Headers();
        if (token) {
          headers.append('Authorization', `Bearer ${token}`);
        }

        // Fetch with credentials to ensure auth is included
        const response = await fetch(downloadUrl, {
          method: 'GET',
          headers: headers,
        });

        if (!response.ok) {
          throw new Error(`Download failed: ${response.status}`);
        }

        // Get the blob from the response
        const blob = await response.blob();

        // Create a URL for the blob
        const url = window.URL.createObjectURL(blob);

        // Set the anchor's href to the blob URL
        a.href = url;

        // Set download attribute with filename from Content-Disposition header or default
        const contentDisposition = response.headers.get('Content-Disposition');
        const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
        const matches = filenameRegex.exec(contentDisposition || '');
        const filename =
          matches && matches[1]
            ? matches[1].replace(/['"]/g, '')
            : `project-${projectId}.zip`;

        a.download = filename;

        // Append to the document
        document.body.appendChild(a);

        // Click the anchor to start download
        a.click();

        // Clean up
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (error) {
        console.error('Error downloading project:', error);
        // Could add a toast notification here
      } finally {
        setIsDownloading(false);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className="flex items-center justify-between p-4 border-b w-full bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    >
      <div className="flex items-center space-x-2">
        <Button
          variant={activeTab === 'preview' ? 'default' : 'outline'}
          className="text-sm"
          onClick={() => setActiveTab('preview')}
          disabled={isLoading}
        >
          <Eye className="w-4 h-4 mr-1" />
          Preview
        </Button>
        {visibleTabs >= 2 && (
          <Button
            variant={activeTab === 'code' ? 'default' : 'outline'}
            className="text-sm"
            onClick={() => setActiveTab('code')}
            disabled={isLoading}
          >
            <CodeIcon className="w-4 h-4 mr-1" />
            Code
          </Button>
        )}
        {visibleTabs >= 3 && (
          <Button
            variant={activeTab === 'console' ? 'default' : 'outline'}
            className="text-sm"
            onClick={() => setActiveTab('console')}
            disabled={isLoading}
          >
            <Terminal className="w-4 h-4 mr-1" />
            Console
          </Button>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            className={`p-0 ${compactIcons ? 'hidden' : 'block'}`}
            disabled={isLoading}
          >
            <GitFork className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            className={`p-0 ${compactIcons ? 'hidden' : 'block'}`}
            disabled={isLoading}
          >
            <Share2 className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            className={`p-0 ${compactIcons ? 'hidden' : 'block'}`}
            disabled={isLoading}
          >
            <Copy className="w-5 h-5" />
          </Button>
        </div>
        <div className="flex items-center space-x-2">
          {!compactIcons && (
            <>
              <Button
                variant="outline"
                className="text-sm"
                disabled={isLoading}
              >
                Supabase
              </Button>
              <Button
                variant="outline"
                className="text-sm"
                disabled={isLoading}
              >
                Publish
              </Button>
              <Button
                variant="outline"
                className="text-sm"
                disabled={isLoading || !projectId || isDownloading}
                onClick={handleDownload}
              >
                {isDownloading ? (
                  <Loader className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-1" />
                )}
                Download
              </Button>
              <Button
                variant={isGithubSyncComplete ? 'secondary' : 'outline'}
                className="text-sm"
                disabled={
                  isLoading ||
                  !projectId ||
                  isPublishingToGitHub ||
                  isPollingGitHub
                }
                onClick={handlePublishToGitHub}
              >
                {isPublishingToGitHub ? (
                  <Loader className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Github className="w-4 h-4 mr-1" />
                )}
                {isGithubSyncComplete ? 'View on GitHub' : 'GitHub'}
              </Button>
            </>
          )}
          {compactIcons && (
            <>
              <Button variant="outline" className="p-2" disabled={isLoading}>
                <Share2 className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                className="p-2"
                disabled={isLoading || !projectId || isDownloading}
                onClick={handleDownload}
              >
                {isDownloading ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
              </Button>
              <Button
                variant={isGithubSyncComplete ? 'secondary' : 'outline'}
                className="p-2"
                disabled={
                  isLoading ||
                  !projectId ||
                  isPublishingToGitHub ||
                  isPollingGitHub
                }
                onClick={handlePublishToGitHub}
              >
                {isPublishingToGitHub ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <Github className="w-4 h-4" />
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResponsiveToolbar;

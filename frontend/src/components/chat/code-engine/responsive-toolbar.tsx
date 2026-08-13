'use client';
import { useContext, useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Code as CodeIcon,
  Copy,
  Globe,
  Lock,
  Download,
  Eye,
  GitFork,
  Share2,
  FileText,
  Palette,
  Rocket,
  KeyRound,
  MoreHorizontal,
  Terminal,
  Loader,
} from 'lucide-react';
import { useAuthContext } from '@/providers/AuthProvider';
import { logger } from '@/app/log/logger';
import { useMutation, useQuery, gql } from '@apollo/client';
import { toast } from 'sonner';
import { GET_PROJECT } from '../../../graphql/request';
import { ProjectContext } from './project-context';
import { authenticatedFetch } from '@/lib/authenticatedFetch';
import { shareUrl } from '@/lib/share';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DeployDialog } from './deploy-dialog';
import { KeyDialog } from './key-dialog';
import { Select, SelectContent, SelectTrigger } from '@/components/ui/select';
import {
  DESIGN_SYSTEMS,
  DesignSystemChoice,
  DesignSystemOptions,
  groupByCategory,
  RESTYLE_PROJECT,
  announceRestyled,
} from '@/components/design-systems';

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

  // Apollo mutations and queries
  // Query to check if the project is already synced
  const { setProjectPublicStatus } = useContext(ProjectContext);
  const [togglingVisibility, setTogglingVisibility] = useState(false);
  const { data: projectData, refetch: refetchProject } = useQuery(GET_PROJECT, {
    variables: { projectId },
    skip: !projectId,
    fetchPolicy: 'cache-and-network',
  });

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

  // Undefined until the query resolves. Do NOT default to false: the button
  // toggles to `!isPublic`, so an unknown state would publish the project.
  const isPublic: boolean | undefined = projectData?.getProject?.isPublic;

  // A page anyone can open, once it is public. Private projects and Next apps
  // have no such link — Next has no single file to serve.
  const share = isPublic ? shareUrl(projectData?.getProject ?? {}) : null;

  // A page prints to a PDF; a Next app would print whatever its dev server is
  // serving, which is not a deliverable anyone asked for.
  const isPage = projectData?.getProject?.template === 'html';
  const projectPath: string | undefined = projectData?.getProject?.projectPath;
  const [printing, setPrinting] = useState(false);
  const [deployOpen, setDeployOpen] = useState(false);
  const [keyOpen, setKeyOpen] = useState(false);

  // Restyling swaps the page's token block server-side. The preview polls the
  // file every few seconds, so it picks the new look up on its own — nothing
  // to reload here.
  const { data: styleData } = useQuery<{
    designSystems: DesignSystemChoice[];
  }>(DESIGN_SYSTEMS, { skip: !isPage });
  const styleSystems = styleData?.designSystems ?? [];
  const [restyle, { loading: restyling }] = useMutation(RESTYLE_PROJECT);

  const handleRestyle = async (styleId: string) => {
    if (!projectId || restyling) return;
    try {
      const { data } = await restyle({ variables: { projectId, styleId } });
      const result = data?.restyleProject;
      // `ok: false` is a reason the user needs to read (the agent restructured
      // the styles, say), not a failure to log.
      if (result?.ok) {
        announceRestyled();
        toast.success(result.message);
      } else toast.error(result?.message ?? 'Could not restyle this page');
    } catch (error) {
      logger.error('Restyle failed:', error);
      toast.error('Could not restyle this page');
    }
  };

  const handlePrint = async () => {
    if (!projectPath || printing) return;
    setPrinting(true);
    try {
      const res = await authenticatedFetch(
        `/api/pdf?projectPath=${encodeURIComponent(projectPath)}`
      );
      if (!res.ok) throw new Error(String(res.status));
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(projectData?.getProject?.projectName ?? 'page').replace(/[^a-z0-9]+/gi, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('PDF export failed:', error);
      toast.error('Could not make a PDF of this page');
    } finally {
      setPrinting(false);
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
        // const response = await fetch(downloadUrl, {
        //   method: 'GET',
        //   headers: headers,
        // });

        // Use authenticatedFetch which handles token refresh
        const response = await authenticatedFetch(downloadUrl, {
          method: 'GET',
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
        logger.error('Project download failed:', error);
        toast.error('Could not download this project');
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
          size="sm"
          className="text-sm"
          onClick={() => setActiveTab('preview')}
          disabled={isLoading}
        >
          <Eye className="w-3 h-3 mr-1" />
          Preview
        </Button>
        {visibleTabs >= 2 && (
          <Button
            variant={activeTab === 'code' ? 'default' : 'outline'}
            size="sm"
            className="text-sm"
            onClick={() => setActiveTab('code')}
            disabled={isLoading}
          >
            <CodeIcon className="w-3 h-3 mr-1" />
            Code
          </Button>
        )}
        {visibleTabs >= 3 && (
          <Button
            variant={activeTab === 'console' ? 'default' : 'outline'}
            size="sm"
            className="text-sm"
            onClick={() => setActiveTab('console')}
            disabled={isLoading}
          >
            <Terminal className="w-3 h-3 mr-1" />
            Console
          </Button>
        )}
        {/* Whatever the width gates hid. Without this Code and Console are
            unreachable on a phone — there is no other way to switch tabs. */}
        {(visibleTabs < 3 || compactIcons) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="px-2"
                aria-label="More actions"
              >
                <MoreHorizontal className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {visibleTabs < 2 && (
                <DropdownMenuItem onClick={() => setActiveTab('code')}>
                  <CodeIcon className="w-3 h-3 mr-2" />
                  Code
                </DropdownMenuItem>
              )}
              {visibleTabs < 3 && (
                <DropdownMenuItem onClick={() => setActiveTab('console')}>
                  <Terminal className="w-3 h-3 mr-2" />
                  Console
                </DropdownMenuItem>
              )}
              {compactIcons && (
                <>
                  <DropdownMenuItem
                    disabled={!projectId || isPublic === undefined}
                    onClick={async () => {
                      if (!projectId || isPublic === undefined) return;
                      setTogglingVisibility(true);
                      await setProjectPublicStatus(projectId, !isPublic);
                      await refetchProject();
                      setTogglingVisibility(false);
                    }}
                  >
                    {isPublic ? (
                      <Globe className="w-3 h-3 mr-2" />
                    ) : (
                      <Lock className="w-3 h-3 mr-2" />
                    )}
                    {isPublic ? 'Public' : 'Private'}
                  </DropdownMenuItem>
                  {share && (
                    <DropdownMenuItem
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `${window.location.origin}${share}`
                        );
                        toast.success('Share link copied — anyone can open it');
                      }}
                    >
                      <Share2 className="w-3 h-3 mr-2" />
                      Share
                    </DropdownMenuItem>
                  )}
                  {isPage && styleSystems.length > 0 && (
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <Palette className="w-3 h-3 mr-2" />
                        Style
                      </DropdownMenuSubTrigger>
                      {/* Grouped, like the desktop Select — 155 flat rows in a
                          phone-width menu is a scroll, not a choice. */}
                      <DropdownMenuSubContent className="max-h-80 overflow-y-auto">
                        {groupByCategory(styleSystems).map(([cat, group]) => (
                          /* A bare div is not a group to a screen reader —
                             this menu had no grouping semantics at all, so
                             155 items announced as one list. */
                          <div key={cat} role="group" aria-label={cat}>
                            <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                              {cat}
                            </DropdownMenuLabel>
                            {group.map((sys) => (
                              <DropdownMenuItem
                                key={sys.id}
                                disabled={restyling}
                                onClick={() => handleRestyle(sys.id)}
                              >
                                {sys.name}
                              </DropdownMenuItem>
                            ))}
                          </div>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  )}
                  {isPage && (
                    <DropdownMenuItem
                      disabled={!projectId}
                      onClick={() => setDeployOpen(true)}
                    >
                      <Rocket className="w-3 h-3 mr-2" />
                      Deploy
                    </DropdownMenuItem>
                  )}
                  {/* Not page-only: the key drives every turn. */}
                  <DropdownMenuItem onClick={() => setKeyOpen(true)}>
                    <KeyRound className="w-3 h-3 mr-2" />
                    API key
                  </DropdownMenuItem>
                  {isPage && (
                    <DropdownMenuItem
                      disabled={!projectPath || printing}
                      onClick={handlePrint}
                    >
                      <FileText className="w-3 h-3 mr-2" />
                      PDF
                    </DropdownMenuItem>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            className={`p-0 ${compactIcons ? 'hidden' : 'block'}`}
            disabled={isLoading || !projectId}
            aria-label="Copy project id"
            onClick={() => {
              if (!projectId) return;
              navigator.clipboard.writeText(projectId);
              toast.success('Project id copied');
            }}
          >
            <Copy className="w-3 h-3" />
          </Button>
        </div>
        <div className="flex items-center space-x-2">
          {!compactIcons && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="text-sm"
                disabled={
                  isLoading ||
                  !projectId ||
                  togglingVisibility ||
                  isPublic === undefined
                }
                onClick={async () => {
                  if (!projectId || isPublic === undefined) return;
                  setTogglingVisibility(true);
                  await setProjectPublicStatus(projectId, !isPublic);
                  await refetchProject();
                  setTogglingVisibility(false);
                }}
                title={
                  isPublic
                    ? 'Anyone can see and fork this project'
                    : 'Only you can see this project'
                }
                aria-busy={isPublic === undefined}
              >
                {isPublic ? (
                  <Globe className="w-3 h-3 mr-1" />
                ) : (
                  <Lock className="w-3 h-3 mr-1" />
                )}
                {isPublic === undefined
                  ? 'Visibility'
                  : isPublic
                    ? 'Public'
                    : 'Private'}
              </Button>
              {/* The published page's own url. Only shown when there is one
                  to copy — publishing is what creates it. */}
              {share && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-sm"
                  title="Copy a link anyone can open"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `${window.location.origin}${share}`
                    );
                    toast.success('Share link copied — anyone can open it');
                  }}
                >
                  <Share2 className="w-3 h-3 mr-1" />
                  Share
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="text-sm"
                disabled={isLoading || !projectId || isDownloading}
                onClick={handleDownload}
              >
                {isDownloading ? (
                  <Loader className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <Download className="w-3 h-3 mr-1" />
                )}
                Download
              </Button>
              {/* Pages only, same reason as PDF below: a Next app has no one
                  file whose token block is "the design". Swapping is
                  snapshotted server-side, so History undoes it. */}
              {isPage && styleSystems.length > 0 && (
                <Select
                  value=""
                  onValueChange={handleRestyle}
                  disabled={isLoading || restyling}
                >
                  <SelectTrigger
                    className={cn(
                      'h-8 w-auto gap-1 border border-border bg-background px-3 text-sm',
                      'hover:bg-accent focus:ring-0 focus:ring-offset-0',
                      '[&>svg:last-child]:hidden',
                      (isLoading || restyling) &&
                        'pointer-events-none opacity-50'
                    )}
                    title="Change this page's design system"
                  >
                    {restyling ? (
                      <Loader className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <Palette className="w-3 h-3 mr-1" />
                    )}
                    Style
                  </SelectTrigger>
                  <SelectContent>
                    <DesignSystemOptions systems={styleSystems} />
                  </SelectContent>
                </Select>
              )}
              {/* Pages only, same as PDF: a Next app needs a build, which is
                  a different deploy than posting files to a static host. */}
              {isPage && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-sm"
                  disabled={isLoading || !projectId}
                  onClick={() => setDeployOpen(true)}
                  title="Publish this page to your own Vercel account"
                >
                  <Rocket className="w-3 h-3 mr-1" />
                  Deploy
                </Button>
              )}
              {/* Not page-only: the key drives every turn. It existed only in
                  the ≤450px overflow menu, so desktop could not reach it. */}
              <Button
                variant="outline"
                size="sm"
                className="text-sm"
                onClick={() => setKeyOpen(true)}
                title="Use your own API key for these turns"
              >
                <KeyRound className="w-3 h-3 mr-1" />
                Key
              </Button>
              {isPage && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-sm"
                  disabled={isLoading || !projectPath || printing}
                  onClick={handlePrint}
                  title="Download this page as a PDF"
                >
                  {printing ? (
                    <Loader className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <FileText className="w-3 h-3 mr-1" />
                  )}
                  PDF
                </Button>
              )}
            </>
          )}
          {compactIcons && (
            <>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={isLoading || !projectId || isDownloading}
                onClick={handleDownload}
              >
                {isDownloading ? (
                  <Loader className="w-3 h-3 animate-spin" />
                ) : (
                  <Download className="w-3 h-3" />
                )}
              </Button>
            </>
          )}
        </div>
      </div>
      <DeployDialog
        projectId={projectId}
        open={deployOpen}
        onOpenChange={setDeployOpen}
      />
      <KeyDialog open={keyOpen} onOpenChange={setKeyOpen} />
    </div>
  );
};

export default ResponsiveToolbar;

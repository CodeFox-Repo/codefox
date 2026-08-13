import { useContext, useEffect, useRef, useState } from 'react';
import { ProjectContext } from './project-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ChevronLeft,
  ChevronRight,
  Maximize,
  ExternalLink,
  RefreshCcw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { URL_PROTOCOL_PREFIX } from '@/utils/const';
import { logger } from '@/app/log/logger';
import { authenticatedFetch } from '@/lib/authenticatedFetch';
import { capturePageConsole } from '@/lib/page-console';

/**
 * An html project previews by rendering its file — no dev server, no
 * sandbox, no waiting. Open-design's model: the artifact IS the page.
 */
function HtmlPreview({ project }: { project: any }) {
  const [html, setHtml] = useState('');
  const [loaded, setLoaded] = useState(false);
  // Which page of the site is showing. A site may be several linked .html
  // files — the agent is told to add them — and srcdoc has no base url, so
  // an <a href="about.html"> inside the frame resolves to nothing. The
  // click is caught below and answered by loading that file instead.
  const [page, setPage] = useState('index.html');
  const { takeProjectScreenshot } = useContext(ProjectContext);
  // Covers come from the preview, and this preview never touches the
  // dev-server path that captures them. Shoot whenever the page's contents
  // change — that is what keeps a cover showing the latest version rather
  // than whatever the project looked like the first time it was opened.
  const shotOf = useRef('');

  useEffect(() => {
    if (!html || !project?.id || shotOf.current === html) return;
    shotOf.current = html;
    // A second of quiet first: mid-turn the agent rewrites the file several
    // times, and every intermediate state is not worth a screenshot.
    const timer = setTimeout(
      () =>
        takeProjectScreenshot(project.id, '', project.projectPath)?.catch(
          () => {}
        ),
      1500
    );
    return () => clearTimeout(timer);
  }, [html, project?.id, project?.projectPath, takeProjectScreenshot]);

  const load = async () => {
    try {
      const res = await authenticatedFetch(
        `/api/file?path=${encodeURIComponent(`${project.projectPath}/${page}`)}`
      );
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data.content === 'string') setHtml(data.content);
    } catch (error) {
      logger.warn('html preview load failed:', error);
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    load();
    // Light poll so the page follows the agent's edits without a manual
    // refresh; a file read every few seconds costs nothing.
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.projectPath, page]);

  // A sub-page is the agent's work too, but only the home page is what the
  // project looks like — a cover shot of "About" would be wrong.
  useEffect(() => {
    if (page !== 'index.html') shotOf.current = '';
  }, [page]);

  /**
   * Follow a link the page makes to another page of the same site.
   *
   * The iframe is sandboxed without allow-top-navigation, so a click on a
   * relative href does nothing at all — it used to look like a dead link.
   * Same-document anchors are left to the browser.
   */
  const followLinks = (frame: HTMLIFrameElement | null) => {
    const doc = frame?.contentDocument;
    if (!doc) return;
    // Same-origin, so the page's own console is readable — which is the only
    // console an html project has. Hooked here, on every load, because the
    // errors worth seeing usually happen before anyone opens that tab.
    if (project?.projectPath) capturePageConsole(frame, project.projectPath);
    doc.addEventListener('click', (event) => {
      const anchor = (event.target as HTMLElement | null)?.closest?.('a');
      const href = anchor?.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      // Anything absolute belongs to the wider web, not this project; it has
      // nowhere to go inside the sandbox, so let it be rather than guess.
      if (/^[a-z]+:/i.test(href) || href.startsWith('//')) return;
      const file = href.split(/[?#]/)[0].replace(/^\.?\//, '');
      if (!/\.html?$/i.test(file)) return;
      event.preventDefault();
      setLoaded(false);
      setPage(file);
    });
  };

  const openInTab = () => {
    const blob = new Blob([html], { type: 'text/html' });
    window.open(URL.createObjectURL(blob), '_blank');
  };

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex h-9 items-center justify-between border-b border-border bg-muted px-3">
        <span className="flex min-w-0 items-center gap-1.5">
          {page !== 'index.html' && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 shrink-0"
              onClick={() => {
                setLoaded(false);
                setPage('index.html');
              }}
              aria-label="Back to the home page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
          )}
          <span className="truncate font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
            {page}
          </span>
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={load}
            aria-label="Refresh preview"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={openInTab}
            disabled={!html}
            aria-label="Open in new tab"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {loaded && !html ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="font-mono text-xs text-muted-foreground">
            {page === 'index.html'
              ? 'No index.html yet — ask the agent to build the page.'
              : `${page} is not in this project.`}
          </p>
        </div>
      ) : (
        // Ceiling: srcdoc has no base URL, so a relative style.css/script.js
        // would 404. The agent is instructed (and E2E-checked) to keep pages
        // self-contained; a raw-file route is the upgrade path if that changes.
        // Links between the project's own pages are handled by onLoad.
        <iframe
          title="preview"
          srcDoc={html}
          onLoad={(event) => followLinks(event.currentTarget)}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          className="w-full flex-1 border-none bg-white"
        />
      )}
    </div>
  );
}

function PreviewContent({
  curProject,
  getWebUrl,
}: {
  curProject: any;
  getWebUrl: any;
}) {
  const [baseUrl, setBaseUrl] = useState('');
  const [displayPath, setDisplayPath] = useState('/');
  const [history, setHistory] = useState<string[]>(['/']);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scale, setScale] = useState(0.7);
  const [loadingMessage, setLoadingMessage] = useState('Loading preview…');
  /** Set when the backend refused to start the preview. Its message is the
   *  diagnosis, so it is shown rather than logged. */
  const [failure, setFailure] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const iframeRef = useRef(null);
  const containerRef = useRef<{ projectPath: string; domain: string } | null>(
    null
  );
  const lastProjectPathRef = useRef<string | null>(null);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const attemptsRef = useRef(0);
  /** Reset by the Retry button to re-run the effect below. */
  const [retryToken, setRetryToken] = useState(0);
  const retryPreview = () => {
    lastProjectPathRef.current = null;
    attemptsRef.current = 0;
    setFailure('');
    setRetryToken((n) => n + 1);
  };

  // ponytail: readiness is the /api/preview response, not a second probe.
  // The backend awaits its own waitForPort and throws when the dev server
  // exits or times out, so a returned url already means the port answers —
  // and the browser cannot re-check it anyway (cross-origin, the preflight
  // is refused). What was here polled a function hardcoded to `true`.
  const MAX_ATTEMPTS = 12; // ~1 min at 5s, past a cold `next dev` boot.

  useEffect(() => {
    const initWebUrl = async () => {
      if (!curProject) return;
      const projectPath = curProject.projectPath;

      // Projects created before scaffolding existed have no directory, so
      // there is nothing to serve. Say so instead of spinning forever.
      if (!projectPath) {
        setLoadingMessage('This project has no files to preview yet.');
        return;
      }

      if (lastProjectPathRef.current === projectPath) {
        return;
      }

      lastProjectPathRef.current = projectPath;

      if (containerRef.current?.projectPath === projectPath) {
        const url = `${URL_PROTOCOL_PREFIX}://${containerRef.current.domain}`;
        setBaseUrl(url);
        setDisplayPath('/');
        return;
      }

      try {
        const { domain } = await getWebUrl(projectPath);
        containerRef.current = {
          projectPath,
          domain,
        };

        const baseUrl = `${URL_PROTOCOL_PREFIX}://${domain}`;
        logger.info('baseUrl:', baseUrl);
        setBaseUrl(baseUrl);
        setDisplayPath('/');
        setFailure('');
        attemptsRef.current = 0;
      } catch (error) {
        // A fresh project fails here while it scaffolds and its dev server
        // boots — that is "not yet", not "failed". Retrying forever is what
        // hid a dev server that was never going to come up, so give up after
        // MAX_ATTEMPTS and show what the backend actually said.
        logger.error('Error getting web URL:', error);
        lastProjectPathRef.current = null;
        if (++attemptsRef.current >= MAX_ATTEMPTS) {
          setFailure(
            (error as Error)?.message ?? 'The preview server did not respond.'
          );
          return;
        }
        setLoadingMessage('Preview is not ready yet — waiting for the app…');
        retryTimerRef.current = setTimeout(initWebUrl, 5000);
      }
    };

    initWebUrl();

    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
    // getWebUrl is deliberately not a dep: it re-memoises on every `projects`
    // change, and refreshProjects replaces that array every 60s — so the
    // effect tore down mid-retry, clearing the pending timer while
    // attemptsRef kept counting. A merely-slow dev server hit MAX_ATTEMPTS
    // for reasons that had nothing to do with it. It is called, never
    // rendered, so the latest closure is not needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curProject?.projectPath, retryToken]);

  useEffect(() => {
    if (iframeRef.current && baseUrl) {
      const fullUrl = `${baseUrl}${displayPath}`;
      iframeRef.current.src = fullUrl;
    }
  }, [baseUrl, displayPath]);

  const enterFullScreen = () => {
    if (iframeRef.current) {
      iframeRef.current.requestFullscreen();
    }
  };

  const openInNewTab = () => {
    if (baseUrl) {
      const fullUrl = `${baseUrl}${displayPath}`;
      window.open(fullUrl, '_blank');
    }
  };

  const handlePathChange = (newPath: string) => {
    if (!newPath.startsWith('/')) {
      newPath = '/' + newPath;
    }
    setDisplayPath(newPath);
    // Add new path to history, removing any forward history
    const newHistory = history.slice(0, currentIndex + 1);
    setHistory([...newHistory, newPath]);
    setCurrentIndex(newHistory.length);
  };

  const goBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setDisplayPath(history[currentIndex - 1]);
    }
  };

  const goForward = () => {
    if (currentIndex < history.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setDisplayPath(history[currentIndex + 1]);
    }
  };

  const reloadIframe = () => {
    const iframe = document.getElementById('myIframe') as HTMLIFrameElement;
    if (iframe) {
      const src = iframe.src;
      iframe.src = 'about:blank';
      setTimeout(() => {
        iframe.src = src;
        setScale(0.7);
      }, 50);
    }
  };

  const zoomIn = () => {
    setScale((prevScale) => Math.min(prevScale + 0.1, 2)); // 最大缩放比例为 2
  };

  const zoomOut = () => {
    setScale((prevScale) => Math.max(prevScale - 0.1, 0.5)); // 最小缩放比例为 0.5
  };

  return (
    <div className="flex flex-col w-full h-full">
      {/* URL Bar */}
      <div className="flex h-9 items-center gap-2 border-b border-border bg-muted px-3">
        {/* Navigation Controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={goBack}
            disabled={!baseUrl || currentIndex === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={goForward}
            disabled={!baseUrl || currentIndex >= history.length - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={reloadIframe}
            disabled={!baseUrl}
          >
            <RefreshCcw />
          </Button>
        </div>

        {/* URL Input */}
        <div className="flex-1 flex items-center">
          <Input
            type="text"
            value={displayPath}
            onChange={(e) => handlePathChange(e.target.value)}
            className="h-7 bg-secondary text-xs"
            placeholder="/"
            disabled={!baseUrl}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={zoomOut}
            className="h-8 w-8"
            disabled={!baseUrl}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={zoomIn}
            className="h-8 w-8"
            disabled={!baseUrl}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={openInNewTab}
            className="h-8 w-8"
            disabled={!baseUrl}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={enterFullScreen}
            className="h-8 w-8"
            disabled={!baseUrl}
          >
            <Maximize className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Preview Container */}
      <div className="relative flex-1 w-full h-full">
        {baseUrl ? (
          <iframe
            id="myIframe"
            ref={iframeRef}
            src={`${baseUrl}${displayPath}`}
            className="absolute inset-0 w-full h-80% border-none bg-background"
            style={{
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              width: `calc(100% / ${scale})`,
              height: `calc(100% / ${scale})`,
              border: 'none',
            }}
          />
        ) : (
          <div className="absolute inset-0 flex w-full items-center justify-center bg-background p-6">
            <div className="flex max-w-md flex-col items-center gap-3">
              <div className="flex items-center gap-2">
                {!failure && (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                )}
                <p className="text-sm text-muted-foreground">
                  {failure ? 'The preview could not start.' : loadingMessage}
                </p>
              </div>
              {/* The backend's own message — which dev server died and how. */}
              {failure && (
                <p className="max-h-32 overflow-auto rounded border border-border bg-secondary px-3 py-2 font-mono text-xs text-muted-foreground">
                  {failure}
                </p>
              )}
              {failure && (
                <Button variant="outline" size="sm" onClick={retryPreview}>
                  <RefreshCcw className="mr-1 h-3 w-3" /> Retry
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * `project` comes from CodeEngine, which resolves it from the chat being
 * displayed. Reading `curProject` from context here meant the preview followed
 * whatever project the global context happened to hold — usually the wrong one
 * when a chat is opened by URL rather than by clicking the sidebar.
 */
export default function WebPreview({ project }: { project?: any }) {
  const { curProject, getWebUrl } = useContext(ProjectContext);
  const target = project ?? curProject;

  if (target?.template === 'html') {
    return <HtmlPreview project={target} />;
  }

  if (!target || !getWebUrl) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">Loading project...</p>
      </div>
    );
  }

  return <PreviewContent curProject={target} getWebUrl={getWebUrl} />;
}

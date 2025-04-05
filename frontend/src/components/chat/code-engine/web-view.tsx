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
  Code,
  X,
} from 'lucide-react';
import { URL_PROTOCOL_PREFIX } from '@/utils/const';
import { logger } from '@/app/log/logger';
import { ComponentInspector } from './componentInspector';
import { setupIframeComm, toggleInspectMode as sendToggleInspectMode } from './iframe-click-handler';
import { StyleUpdateService } from './styleUpdateService';

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
  const [isServiceReady, setIsServiceReady] = useState(false);
  const [serviceCheckAttempts, setServiceCheckAttempts] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('Loading preview...');
  const [isInspectMode, setIsInspectMode] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<{ projectPath: string; domain: string } | null>(
    null
  );
  const lastProjectPathRef = useRef<string | null>(null);
  const serviceCheckTimerRef = useRef<NodeJS.Timeout | null>(null);
  const MAX_CHECK_ATTEMPTS = 15;

  // Check if inspect mode was previously enabled
  useEffect(() => {
    const savedInspectMode = localStorage.getItem('inspectModeEnabled') === 'true';
    if (savedInspectMode) {
      setIsInspectMode(true);
    }
  }, []);

  // Function to check if the frontend service is ready
  const checkServiceReady = async (url: string) => {
    try {
      // Create a new AbortController instance
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);

      const response = await fetch(url, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
        headers: { 'Cache-Control': 'no-cache' },
      });

      clearTimeout(timeoutId);

      // Service is ready if we get a successful response (not 404 or 5xx)
      const isReady =
        response.ok || (response.status !== 404 && response.status < 500);
      logger.info(
        `Service check: ${url} - Status: ${response.status} - Ready: ${isReady}`
      );
      return isReady;
    } catch (error) {
      // Don't log abort errors (expected when timeout occurs)
      if (!error.toString().includes('abort')) {
        logger.info(`Service check attempt failed: ${error}`);
      }
      return false;
    }
  };

  // Function to periodically check service readiness
  const startServiceReadyCheck = async (url: string) => {
    // Clear any existing timer
    if (serviceCheckTimerRef.current) {
      clearInterval(serviceCheckTimerRef.current);
    }

    setServiceCheckAttempts(0);
    setIsServiceReady(false);
    setLoadingMessage('Loading preview...');

    // Try immediately first (don't wait for interval)
    const initialReady = await checkServiceReady(url);
    if (initialReady) {
      logger.info('Frontend service is ready immediately!');
      setIsServiceReady(true);
      return; // Exit early if service is ready immediately
    }

    // Progressive check intervals (check more frequently at first)
    const checkIntervals = [500, 1000, 1000, 1500, 1500]; // First few checks are faster
    let checkIndex = 0;

    // Set a fallback timer - show preview after 45 seconds no matter what
    const fallbackTimer = setTimeout(() => {
      logger.info('Fallback timer triggered - showing preview anyway');
      setIsServiceReady(true);
      if (serviceCheckTimerRef.current) {
        clearInterval(serviceCheckTimerRef.current);
        serviceCheckTimerRef.current = null;
      }
    }, 45000);

    const runServiceCheck = async () => {
      setServiceCheckAttempts((prev) => prev + 1);

      // Update loading message with attempts
      if (serviceCheckAttempts > 3) {
        setLoadingMessage(
          `Starting frontend service... (${serviceCheckAttempts}/${MAX_CHECK_ATTEMPTS})`
        );
      }

      const ready = await checkServiceReady(url);

      if (ready) {
        logger.info('Frontend service is ready!');
        setIsServiceReady(true);
        clearTimeout(fallbackTimer);
        if (serviceCheckTimerRef.current) {
          clearInterval(serviceCheckTimerRef.current);
          serviceCheckTimerRef.current = null;
        }
      } else if (serviceCheckAttempts >= MAX_CHECK_ATTEMPTS) {
        // Service didn't become ready after max attempts
        logger.info(
          'Max attempts reached. Service might still be initializing.'
        );
        setLoadingMessage(
          'Preview might not be fully loaded. Click refresh to try again.'
        );

        // Show the preview anyway after max attempts
        setIsServiceReady(true);
        clearTimeout(fallbackTimer);

        if (serviceCheckTimerRef.current) {
          clearInterval(serviceCheckTimerRef.current);
          serviceCheckTimerRef.current = null;
        }
      } else {
        // Schedule next check with dynamic interval
        const nextInterval =
          checkIndex < checkIntervals.length
            ? checkIntervals[checkIndex++]
            : 2000; // Default to 2000ms after initial fast checks

        setTimeout(runServiceCheck, nextInterval);
      }
    };

    // Start the first check
    setTimeout(runServiceCheck, 500);
  };

  useEffect(() => {
    // Cleanup interval on component unmount
    return () => {
      if (serviceCheckTimerRef.current) {
        clearInterval(serviceCheckTimerRef.current);
        serviceCheckTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const initWebUrl = async () => {
      if (!curProject) return;
      const projectPath = curProject.projectPath;

      // Set the project path in StyleUpdateService for file operations
      StyleUpdateService.setProjectPath(projectPath);
      
      if (lastProjectPathRef.current === projectPath) {
        return;
      }

      lastProjectPathRef.current = projectPath;

      // Reset service ready state for new project
      setIsServiceReady(false);

      if (containerRef.current?.projectPath === projectPath) {
        const url = `${URL_PROTOCOL_PREFIX}://${containerRef.current.domain}`;
        setBaseUrl(url);
        setDisplayPath('/');
        startServiceReadyCheck(url);
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

        // Start checking if the service is ready
        startServiceReadyCheck(baseUrl);
      } catch (error) {
        logger.error('Error getting web URL:', error);
        setLoadingMessage('Error initializing preview.');
      }
    };

    initWebUrl();
  }, [curProject, getWebUrl]);

  useEffect(() => {
    if (iframeRef.current && baseUrl && isServiceReady) {
      // Update the iframe src to the target URL
      const fullUrl = `${baseUrl}${displayPath}`;
      iframeRef.current.src = fullUrl;
      
      // Setup communication with the iframe using our custom inspector
      if (iframeRef.current) {
        setupIframeComm(iframeRef.current);
      }
    }
  }, [baseUrl, displayPath, isServiceReady]);

  // Re-enable inspector mode when inspector is toggled on
  useEffect(() => {
    if (isInspectMode && iframeRef.current && isServiceReady) {
      sendToggleInspectMode(iframeRef.current, true);
    }
  }, [isInspectMode, isServiceReady]);

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
    // Reset service ready check when manually reloading
    if (baseUrl) {
      setIsServiceReady(false);
      startServiceReadyCheck(baseUrl);
    }

    if (iframeRef.current) {
      const src = iframeRef.current.src;
      iframeRef.current.src = 'about:blank';
      setTimeout(() => {
        if (iframeRef.current) {
          iframeRef.current.src = src;
          setScale(0.7);
        }
      }, 50);
    }
  };

  const zoomIn = () => {
    setScale((prevScale) => Math.min(prevScale + 0.1, 2)); // Max zoom 2x
  };

  const zoomOut = () => {
    setScale((prevScale) => Math.max(prevScale - 0.1, 0.5)); // Min zoom 0.5x
  };

  const toggleInspectMode = () => {
    const newInspectMode = !isInspectMode;
    setIsInspectMode(newInspectMode);
    
    // Use custom inspector mode
    if (iframeRef.current) {
      sendToggleInspectMode(iframeRef.current, newInspectMode);
    }
  };

  return (
    <div className="flex flex-col w-full h-full">
      {/* URL Bar */}
      <div className="flex items-center gap-2 px-3 h-11 border-b bg-muted">
        {/* Navigation Controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={goBack}
            disabled={!baseUrl || currentIndex === 0 || !isServiceReady}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={goForward}
            disabled={
              !baseUrl || currentIndex >= history.length - 1 || !isServiceReady
            }
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
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>

        {/* URL Input */}
        <div className="flex-1 flex items-center">
          <Input
            type="text"
            value={displayPath}
            onChange={(e) => handlePathChange(e.target.value)}
            className="h-8 bg-secondary"
            placeholder="/"
            disabled={!baseUrl || !isServiceReady}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Button
            variant={isInspectMode ? "default" : "ghost"}
            size="icon"
            onClick={toggleInspectMode}
            className="h-8 w-8"
            disabled={!baseUrl || !isServiceReady}
            title="Toggle Component Inspector"
          >
            <Code className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={zoomOut}
            className="h-8 w-8"
            disabled={!baseUrl || !isServiceReady}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={zoomIn}
            className="h-8 w-8"
            disabled={!baseUrl || !isServiceReady}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={openInNewTab}
            className="h-8 w-8"
            disabled={!baseUrl || !isServiceReady}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={enterFullScreen}
            className="h-8 w-8"
            disabled={!baseUrl || !isServiceReady}
          >
            <Maximize className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Preview Container */}
      <div className="relative flex-1 w-full h-full flex">
        {/* Preview Area */}
        <div className={`relative ${isInspectMode ? "w-2/3" : "w-full"} h-full transition-all duration-200`}>
          {baseUrl && isServiceReady ? (
            <iframe
              id="myIframe"
              ref={iframeRef}
              src={`${baseUrl}${displayPath}`}
              className="absolute inset-0 w-full h-full border-none bg-background"
              style={{
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                width: `calc(100% / ${scale})`,
                height: `calc(100% / ${scale})`,
                border: 'none',
              }}
            />
          ) : (
            <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-background">
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2">
                  <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full"></div>
                  <p className="text-sm text-muted-foreground">
                    {loadingMessage}
                  </p>
                </div>
                {serviceCheckAttempts > 5 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (baseUrl) {
                        startServiceReadyCheck(baseUrl);
                      }
                    }}
                  >
                    <RefreshCcw className="h-3 w-3 mr-1" /> Retry Check
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Component Inspector Panel */}
        {isInspectMode && (
          <div className="w-1/3 h-full border-l bg-background">
            <ComponentInspector />
          </div>
        )}
      </div>
    </div>
  );
}

export default function WebPreview() {
  const { curProject, getWebUrl } = useContext(ProjectContext);

  if (!curProject || !getWebUrl) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">Loading project...</p>
      </div>
    );
  }

  return <PreviewContent curProject={curProject} getWebUrl={getWebUrl} />;
}
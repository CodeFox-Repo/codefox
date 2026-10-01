'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@apollo/client';
import { Check, Copy, Loader, Rocket } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DEPLOY_PROJECT } from '@/components/design-systems';
import { logger } from '@/app/log/logger';

/** Where the token is remembered, when the user asks for that. */
const TOKEN_KEY = 'codefox-vercel-token';

/**
 * Publish a page to the user's own Vercel account.
 *
 * The token goes to our backend and straight on to Vercel — nothing stores it
 * server-side. Remembering it is opt-in and local to this browser, which the
 * checkbox says out loud rather than burying in a tooltip.
 */
export function DeployDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [token, setToken] = useState(
    () =>
      (typeof window !== 'undefined' && localStorage.getItem(TOKEN_KEY)) || ''
  );
  const [remember, setRemember] = useState(
    () => typeof window !== 'undefined' && !!localStorage.getItem(TOKEN_KEY)
  );
  const [result, setResult] = useState<{ url: string; message: string } | null>(
    null
  );
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const copyRequest = useRef(0);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setCopied(false);
    setCopying(false);
    setCopyError(false);
    return () => {
      // A late clipboard result must not mark a different URL or a reopened
      // dialog as copied. Also stop the previous success timer on dismissal.
      // Invalidate the latest request, not a captured generation.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      copyRequest.current++;
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    };
  }, [open, result?.url]);

  const copyUrl = async () => {
    if (!result?.url || copying) return;
    const request = ++copyRequest.current;
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    setCopied(false);
    setCopyError(false);
    setCopying(true);
    try {
      await navigator.clipboard.writeText(result.url);
      if (request !== copyRequest.current) return;
      setCopied(true);
      copiedTimer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      if (request === copyRequest.current) setCopyError(true);
    } finally {
      if (request === copyRequest.current) setCopying(false);
    }
  };
  const [deploy, { loading }] = useMutation(DEPLOY_PROJECT);

  const run = async () => {
    if (!projectId || !token.trim() || loading) return;
    setResult(null);
    try {
      const { data } = await deploy({
        variables: { projectId, provider: 'vercel', token: token.trim() },
      });
      const res = data?.deployProject;
      setResult({ url: res?.url ?? '', message: res?.message ?? '' });
      if (res?.ok && remember) localStorage.setItem(TOKEN_KEY, token.trim());
      if (!remember) localStorage.removeItem(TOKEN_KEY);
    } catch (error) {
      logger.error('Deploy failed:', error);
      setResult({ url: '', message: 'Could not reach the server.' });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Closing drops a token the user did not ask us to remember. The
        // dialog is never unmounted, so without this a typed credential sat
        // in component state for the rest of the session — and reopening
        // showed it pre-filled as if it had been saved.
        if (!next && !remember) setToken('');
        if (!next) setResult(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Deploy to Vercel</DialogTitle>
          <DialogDescription>
            Publishes this page to your own Vercel account. The token is used
            for this deploy and never stored on our servers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="vercel-token">Vercel token</Label>
            <Input
              id="vercel-token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="vercel_xxx"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Create one at vercel.com/account/tokens
            </p>
          </div>

          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            Remember it in this browser (localStorage, not our servers)
          </label>

          {/* The provider's own words, verbatim — "missing scope" and "name
              taken" are both 403 and only the body tells them apart. */}
          {result?.message && (
            <p className="max-h-32 overflow-auto rounded border border-border bg-secondary px-3 py-2 font-mono text-xs text-muted-foreground">
              {result.message}
            </p>
          )}

          {result?.url && (
            <div className="flex items-center gap-2 rounded border border-border bg-secondary px-3 py-2">
              <a
                href={result.url}
                target="_blank"
                rel="noreferrer"
                className="flex-1 truncate font-mono text-xs text-foreground hover:underline"
              >
                {result.url}
              </a>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                aria-label={
                  copied ? 'Deployment URL copied' : 'Copy deployment URL'
                }
                disabled={copying}
                onClick={() => void copyUrl()}
              >
                {copied ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>
          )}

          {copied && (
            <p role="status" className="text-xs">
              Deployment URL copied
            </p>
          )}
          {copyError && result?.url && (
            <div className="space-y-2">
              <p role="status" className="text-xs text-muted-foreground">
                {"Couldn't copy the link. Select and copy it manually."}
              </p>
              <Input
                aria-label="Deployment URL"
                readOnly
                value={result.url}
                onFocus={(event) => event.currentTarget.select()}
              />
            </div>
          )}

          <Button
            className="w-full"
            disabled={!projectId || !token.trim() || loading}
            onClick={run}
          >
            {loading ? (
              <Loader className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Rocket className="mr-1 h-3 w-3" />
            )}
            {loading ? 'Deploying…' : 'Deploy'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { useState } from 'react';
import { KeyRound } from 'lucide-react';
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
import { LocalStore } from '@/lib/storage';
import { isRemembered, readUserKey, writeUserKey } from '@/lib/user-key';

/**
 * Point the agent at your own OpenAI-compatible endpoint.
 *
 * Same deal as the Vercel deploy token: the key rides along with each turn and
 * nothing stores it server-side. Remembering it is opt-in and local to this
 * browser, which the checkbox says out loud.
 */
export function KeyDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const existing = readUserKey();
  const [apiKey, setApiKey] = useState(existing?.apiKey ?? '');
  const [baseUrl, setBaseUrl] = useState(
    existing?.baseUrl ?? 'https://openrouter.ai/api/v1'
  );
  const [model, setModel] = useState(existing?.model ?? '');
  const [remember, setRemember] = useState(isRemembered);

  const save = () => {
    const key = apiKey.trim();
    const url = baseUrl.trim();
    writeUserKey(
      key && url ? { apiKey: key, baseUrl: url, model: model.trim() } : null,
      remember
    );
    // The model list is cached per session and would not show a model the
    // user just named until the cache aged out.
    sessionStorage.removeItem(LocalStore.models);
    onOpenChange(false);
  };

  const clear = () => {
    writeUserKey(null, false);
    sessionStorage.removeItem(LocalStore.models);
    setApiKey('');
    setModel('');
    setBaseUrl('https://openrouter.ai/api/v1');
    setRemember(false);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Same as DeployDialog: closing drops a key the user did not ask us
        // to remember. The dialog is never unmounted, so without this a typed
        // credential sat in component state for the rest of the session — and
        // reopening showed it pre-filled as if it had been saved.
        if (!next && !remember) setApiKey('');
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Use your own API key</DialogTitle>
          <DialogDescription>
            Runs your turns against your own OpenAI-compatible endpoint, billed
            to you. The key is sent with each turn and never stored on our
            servers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="byok-key">API key</Label>
            <Input
              id="byok-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="byok-url">Base URL</Label>
            <Input
              id="byok-url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://openrouter.ai/api/v1"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Must be https. OpenAI-compatible endpoints only — these turns run
              on the Codex runtime whatever this deployment otherwise uses.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="byok-model">Model (optional)</Label>
            <Input
              id="byok-model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="openai/gpt-5"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Added to the model picker. Leave blank to use the default.
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

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={clear}
              disabled={!existing}
            >
              Use ours
            </Button>
            <Button
              className="flex-1"
              disabled={!apiKey.trim() || !baseUrl.trim()}
              onClick={save}
            >
              <KeyRound className="mr-1 h-3 w-3" />
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

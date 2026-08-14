'use client';

import { useEffect, useState } from 'react';
import { NotebookPen, Loader } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { authenticatedFetch } from '@/lib/authenticatedFetch';
import { toast } from 'sonner';
import { logger } from '@/app/log/logger';

/**
 * What this project has already decided — NOTES.md, made visible.
 *
 * The agent has been keeping this file since the memory work: it records the
 * audience, the brand colour the user insisted on, "no pricing section until
 * we have real numbers", and it is read back into EVERY turn's prompt. So it
 * is already the project's design contract in the open-design sense — it was
 * just invisible. The user could not see what the agent believed, and could
 * not correct a wrong line except by asking in prose and hoping.
 *
 * No new API: `/api/file` already reads and writes any file in the project,
 * guarded and ownership-checked, and creates the file on write. This dialog is
 * that endpoint pointed at one well-known path.
 *
 * ponytail: a plain textarea, not the Monaco editor the Code tab uses — this
 * is a dozen lines of prose, and Monaco is already mounted next door for
 * anyone who wants it.
 */
const NOTES_PATH = 'NOTES.md';

/** What a project that has not decided anything yet gets to start from. */
const TEMPLATE = `# Notes
- `;

export function NotesDialog({
  projectPath,
  open,
  onOpenChange,
}: {
  projectPath?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [text, setText] = useState('');
  // What the server last confirmed, so Save can tell a real edit from a
  // reopened dialog and the button can honestly disable itself.
  const [saved, setSaved] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  // A failed load must not present an empty box: saving that would erase
  // whatever the agent had recorded.
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open || !projectPath) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setFailed(false);
      try {
        const res = await authenticatedFetch(
          `/api/file?path=${encodeURIComponent(`${projectPath}/${NOTES_PATH}`)}`
        );
        // A project whose agent has not written notes yet has no such file.
        // That is the empty contract, not a failure — the endpoint 404s and
        // the user should get a starting point rather than an error.
        if (res.status === 404) {
          if (!cancelled) {
            setText(TEMPLATE);
            setSaved('');
          }
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (cancelled) return;
        setText(data.content ?? '');
        setSaved(data.content ?? '');
      } catch (error) {
        if (cancelled) return;
        logger.error('Could not read NOTES.md:', error);
        setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, projectPath]);

  const save = async () => {
    if (!projectPath || saving || failed) return;
    setSaving(true);
    try {
      const res = await authenticatedFetch('/api/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: `${projectPath}/${NOTES_PATH}`,
          newContent: text,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setSaved(text);
      toast.success('Saved — the agent reads this on its next turn');
      onOpenChange(false);
    } catch (error) {
      logger.error('Could not save NOTES.md:', error);
      // The dialog stays open with the text intact: a failed save that closed
      // would throw away what the user just wrote.
      toast.error('Could not save these notes — your text is still here');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>What this project has decided</DialogTitle>
          <DialogDescription>
            The agent keeps these notes and reads them at the start of every
            turn, so anything here outlives the conversation. Correct a line it
            got wrong, or add a rule it should follow.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="px-1 py-8 text-center font-mono text-xs text-muted-foreground">
            Reading notes…
          </p>
        ) : failed ? (
          <p className="px-1 py-8 text-center text-sm text-muted-foreground">
            Could not read this project&apos;s notes. Close and try again —
            nothing has been changed.
          </p>
        ) : (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            rows={14}
            aria-label="Project notes"
            placeholder={TEMPLATE}
            className={
              'w-full resize-y rounded-md border border-border bg-background ' +
              'px-3 py-2 font-mono text-xs leading-relaxed text-foreground ' +
              'placeholder:text-muted-foreground focus-visible:outline-none ' +
              'focus-visible:ring-1 focus-visible:ring-ring'
            }
          />
        )}

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            One line per decision. Short — it rides along with every turn.
          </p>
          <Button
            size="sm"
            disabled={loading || saving || failed || text === saved}
            onClick={save}
          >
            {saving ? (
              <Loader className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <NotebookPen className="mr-1 h-3 w-3" />
            )}
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

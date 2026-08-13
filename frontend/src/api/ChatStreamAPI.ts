import { ChatInputType } from '@/graphql/type';
import authenticatedFetch from '@/lib/authenticatedFetch';

/** One thing the page the turn produced gets wrong, worst first. */
export interface LintFinding {
  severity: 'P0' | 'P1' | 'P2';
  id: string;
  message: string;
  fix: string;
  snippet?: string;
}

export interface ChatStreamHandlers {
  /** Assistant text as it arrives. */
  onText?: (delta: string) => void;
  /** A tool the agent just invoked, with what it is acting on when known. */
  onTool?: (name: string, target?: string) => void;
  /** Turn-level failure reported by the backend. */
  onError?: (message: string) => void;
  /** Design findings for the finished page. Sent once, at the end of a turn. */
  onLint?: (findings: LintFinding[]) => void;
}

export interface ChatStreamOptions extends ChatStreamHandlers {
  /** Aborts the request; the backend stops the agent when the client hangs up. */
  signal?: AbortSignal;
  /** Attached images as `data:<mime>;base64,<data>` URLs. */
  images?: string[];
}

/**
 * Runs one agent turn and returns the assembled assistant text.
 *
 * The backend streams newline-delimited JSON events rather than raw text, so
 * the caller can show which tool is running and which files changed while the
 * turn is still in flight.
 */
export const startChatStream = async (
  input: ChatInputType,
  token: string,
  { onText, onTool, onError, onLint, signal, images }: ChatStreamOptions = {}
): Promise<string> => {
  if (!token) {
    throw new Error('Not authenticated');
  }

  const { chatId, message, model } = input;
  const response = await authenticatedFetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ chatId, message, model, images }),
    signal,
  });

  if (!response.ok) {
    throw new Error(
      `Network response was not ok: ${response.status} ${response.statusText}`
    );
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body to read');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';

  const handle = (line: string) => {
    if (!line.trim()) return;
    // `v` is the finding list on a lint event and a string everywhere else.
    let event: { t?: string; v?: string | LintFinding[]; arg?: string };
    try {
      event = JSON.parse(line);
    } catch {
      return; // a torn frame; the next read completes it
    }
    switch (event.t) {
      case 'text':
        content += (event.v as string) ?? '';
        onText?.((event.v as string) ?? '');
        break;
      case 'tool':
        onTool?.((event.v as string) ?? '', event.arg);
        break;
      case 'error':
        onError?.((event.v as string) ?? 'The agent failed.');
        break;
      case 'lint':
        if (Array.isArray(event.v)) onLint?.(event.v);
        break;
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Only whole lines are complete events; keep the tail for the next read.
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      lines.forEach(handle);
    }
    handle(buffer + decoder.decode());
  } catch (error) {
    // An abort is the user pressing stop, not a failure — keep what streamed.
    if ((error as Error)?.name !== 'AbortError') throw error;
  }

  return content;
};

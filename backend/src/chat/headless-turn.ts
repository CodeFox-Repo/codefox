import type { TurnStep } from './message.model';

/**
 * A turn with nobody watching it.
 *
 * `ChatController.runTurn` writes newline-delimited JSON into an express
 * `Response` and leaves the *browser* to save the finished reply into the
 * chat — the backend only rescues one when the client hangs up mid-turn. A
 * local coding agent calling `/api/agent` is not a browser: there is no
 * client on the other end to persist anything, and the turn has to run
 * anyway.
 *
 * So this stands in for the response. It eats the event stream, folds it back
 * into the `reply` and `steps` the browser would have posted, and resolves
 * `done` when the turn ends. The caller saves the message afterwards, which
 * is the same write the browser makes.
 *
 * Deliberately NOT an express `Response` subclass or a socket: it implements
 * exactly the members `chat()` / `pipeAgent` / `runTurn` touch —
 * setHeader, headersSent, write, end, on, status().json(), writableEnded,
 * destroyed — and nothing else. If one of those grows a new call, this fails
 * loudly at the type cast rather than silently dropping a turn.
 *
 * ponytail: a shim over the real controller, not a second turn runner. The
 * queue, the snapshot, the AgentTurn record, the stall watchdog and the error
 * explanations are all several hundred lines of hard-won behaviour that only
 * exist in that one path.
 */
export class HeadlessResponse {
  /** Everything the model said, in order — what gets saved as the reply. */
  reply = '';

  /** The same working-notes shape the browser saves alongside the text. */
  steps: TurnStep[] = [];

  /** `t: 'error'` frames. The turn record holds the authoritative version. */
  errors: string[] = [];

  /** Set when the controller refuses the turn outright (429, 500). */
  statusCode = 200;
  body: unknown;

  headersSent = false;
  writableEnded = false;
  destroyed = false;

  /** Resolves when the turn has ended, however it ended. */
  readonly done: Promise<void>;
  private settle!: () => void;

  /** Partial line left over from the last `write`. */
  private pending = '';

  constructor() {
    this.done = new Promise<void>((resolve) => {
      this.settle = resolve;
    });
  }

  setHeader(): this {
    return this;
  }

  /** `close` is the only event registered, and nothing here ever hangs up. */
  on(): this {
    return this;
  }

  status(code: number): this {
    this.statusCode = code;
    return this;
  }

  json(body: unknown): this {
    this.body = body;
    return this.end();
  }

  write(chunk: string | Buffer): boolean {
    this.headersSent = true;
    this.pending += chunk.toString();
    const lines = this.pending.split('\n');
    // The last piece is whatever came after the final newline — usually '',
    // but a write can split an event in half.
    this.pending = lines.pop() ?? '';
    for (const line of lines) {
      if (line.trim()) this.consume(line);
    }
    return true;
  }

  end(): this {
    if (this.pending.trim()) this.consume(this.pending);
    this.pending = '';
    if (!this.writableEnded) {
      this.writableEnded = true;
      this.settle();
    }
    return this;
  }

  private consume(line: string) {
    let event: { t?: string; v?: unknown; arg?: unknown };
    try {
      event = JSON.parse(line);
    } catch {
      // The stream is ours and is always one JSON object per line; a line that
      // does not parse is not worth failing a turn the files already own.
      return;
    }

    switch (event.t) {
      case 'text': {
        const text = String(event.v ?? '');
        this.reply += text;
        const last = this.steps[this.steps.length - 1];
        if (last?.kind === 'text') last.text += text;
        else this.steps.push({ kind: 'text', text });
        break;
      }
      case 'tool':
        this.steps.push({
          kind: 'tool',
          tool: String(event.v ?? ''),
          ...(event.arg ? { file: String(event.arg) } : {}),
        });
        break;
      case 'error':
        this.errors.push(String(event.v ?? ''));
        break;
      // 'lint' is advice for the editor's design panel; a remote agent reads
      // the files themselves.
    }
  }
}

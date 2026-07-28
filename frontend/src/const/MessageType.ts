/**
 * One thing the agent did on the way to an answer.
 *
 * A turn is not a single reply: the agent narrates, runs a tool, narrates
 * again, and only the last thing it says is the answer. Flattening that into
 * one string — which is what the stream used to become — left the reader with
 * "let me check X… now I'll update Y…" glued to the result, and lost every
 * tool call.
 */
export type TurnStep =
  | { kind: 'text'; text: string }
  | { kind: 'tool'; tool: string; file?: string };

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
  /**
   * Present only while a turn streams and for the rest of that session. Chats
   * loaded from history have the answer in `content` and no trail.
   */
  steps?: TurnStep[];
}

/**
 * Split a turn into the work and the answer.
 *
 * The agent finishes by summarising what it changed — the backend's
 * instructions ask for exactly that — so the last thing it says is the answer
 * and everything before it is how it got there. Anything after the final tool
 * call belongs to the answer; if the turn ended on a tool (aborted, or a
 * failure), there is no answer yet and the whole thing is still work.
 */
export const splitTurn = (steps: TurnStep[]) => {
  let cut = steps.length;
  while (cut > 0 && steps[cut - 1].kind === 'text') cut--;
  return { work: steps.slice(0, cut), answer: steps.slice(cut) };
};

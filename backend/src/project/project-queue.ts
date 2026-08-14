/**
 * One writer at a time per project.
 *
 * Turns already queued against each other; restyle did not, so a style swap
 * could land between the agent reading index.html and writing it back — the
 * exact "both wrote, one won, no error anywhere" the turn queue exists to
 * stop. Lifted out of ChatController so anything that writes a project's
 * files can join the same line without the project module importing the chat
 * module.
 *
 * ponytail: a Map of promises, in process. Correct for one backend; a second
 * instance would need a real lock (advisory lock in postgres, or redis).
 */
const queues = new Map<string, Promise<unknown>>();

/** True when something is already writing this project — the caller can say
 *  so rather than leave the user watching a silent stream. */
export function busy(projectPath: string): boolean {
  return queues.has(projectPath);
}

export function queueForProject<T>(
  projectPath: string,
  work: () => Promise<T>,
): Promise<T> {
  return queueOn(queues, projectPath, work);
}

/**
 * One creation at a time per account, so the project cap cannot be raced.
 *
 * `assertCanCreateProject` is a COUNT, and the row it is deciding about is
 * INSERTed several awaits later — a model call for the generated title in
 * create's case, seconds wide. Two requests in that window both counted 19 of
 * 20 and both created, so N concurrent requests put a user N-1 over the cap.
 * Serialising create and fork per user closes it: the second caller counts
 * after the first has saved.
 *
 * ponytail: in-process, same ceiling as every other queue here — a second
 * backend instance needs a real lock (postgres advisory lock, or a unique
 * partial index if the cap ever has to be enforced by the database).
 */
const creations = new Map<string, Promise<unknown>>();

export function queueForUser<T>(
  userId: string,
  work: () => Promise<T>,
): Promise<T> {
  return queueOn(creations, userId, work);
}

/** Run `work` after whatever is already queued under `key`. */
function queueOn<T>(
  queue: Map<string, Promise<unknown>>,
  key: string,
  work: () => Promise<T>,
): Promise<T> {
  const ahead = queue.get(key) ?? Promise.resolve();
  // The stored promise never rejects, so one failed job cannot wedge the
  // key's queue.
  const mine = ahead.then(work);
  const tail = mine.catch(() => undefined);
  queue.set(key, tail);
  void tail.then(() => {
    if (queue.get(key) === tail) queue.delete(key);
  });
  return mine;
}

/**
 * How many turns one account may have running at once.
 *
 * The queue above is per PROJECT, so a user with ten projects could run ten
 * agent turns in parallel — each one a model session against the shared
 * credit. Nothing bounded that. Three is generous for a person and cheap for
 * an abuser.
 *
 * ponytail: a counter in the same map-of-promises module, not a new table.
 * In-process like the project queue, and correct for the single backend this
 * runs as; a second instance would need the same real lock that one does.
 */
const MAX_TURNS_PER_USER =
  Number(process.env.MAX_TURNS_PER_USER) > 0
    ? Math.floor(Number(process.env.MAX_TURNS_PER_USER))
    : 3;

const active = new Map<string, number>();

/** True when the user already has the most turns we allow in flight. */
export function atTurnLimit(userId: string): boolean {
  return (active.get(userId) ?? 0) >= MAX_TURNS_PER_USER;
}

export const turnLimit = (): number => MAX_TURNS_PER_USER;

/** Count a turn while `work` runs. Always decrements, however it ends. */
export async function withUserTurn<T>(
  userId: string,
  work: () => Promise<T>,
): Promise<T> {
  active.set(userId, (active.get(userId) ?? 0) + 1);
  try {
    return await work();
  } finally {
    const left = (active.get(userId) ?? 1) - 1;
    if (left > 0) active.set(userId, left);
    else active.delete(userId);
  }
}

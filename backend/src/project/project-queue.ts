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
  const ahead = queues.get(projectPath) ?? Promise.resolve();
  // The stored promise never rejects, so one failed job cannot wedge the
  // project's queue.
  const mine = ahead.then(work);
  const tail = mine.catch(() => undefined);
  queues.set(projectPath, tail);
  void tail.then(() => {
    if (queues.get(projectPath) === tail) queues.delete(projectPath);
  });
  return mine;
}

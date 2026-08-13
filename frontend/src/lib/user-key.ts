/**
 * The user's own OpenAI-compatible endpoint, kept in this browser only.
 *
 * Sent with each turn and never stored server-side — same deal as the Vercel
 * deploy token. "Remember on this device" is opt-in; without it the key lives
 * in memory for the session and is gone on reload.
 */
export interface UserKey {
  apiKey: string;
  baseUrl: string;
  model?: string;
}

const KEY = 'codefox-byok';

/** Set when the user declined "remember", so it dies with the tab. */
let session: UserKey | null = null;

export const readUserKey = (): UserKey | null => {
  if (session) return session;
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as UserKey) : null;
  } catch {
    return null;
  }
};

/** Fired on every write. useModels reads this module from another subtree, so
 *  nothing would re-render it — the saved model stayed out of the picker until
 *  some unrelated render happened to pick it up. */
export const USER_KEY_CHANGED = 'codefox-byok-changed';

export const writeUserKey = (value: UserKey | null, remember: boolean) => {
  session = remember ? null : value;
  if (typeof window === 'undefined') return;
  if (value && remember) localStorage.setItem(KEY, JSON.stringify(value));
  else localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(USER_KEY_CHANGED));
};

export const isRemembered = () =>
  typeof window !== 'undefined' && !!localStorage.getItem(KEY);

/** The fields a turn sends. Empty when the user has not set one up. */
export const userKey = (): { apiKey?: string; baseUrl?: string } => {
  const k = readUserKey();
  return k?.apiKey && k?.baseUrl
    ? { apiKey: k.apiKey, baseUrl: k.baseUrl }
    : {};
};

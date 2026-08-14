import { useEffect, useRef } from 'react';

/**
 * setInterval that stops while the tab is in the background.
 *
 * Every poll in this app ran forever: leave a project open in a background
 * tab and it kept asking the backend for the page source every 5s and the dev
 * server log every 2s, for as long as the tab existed. Nothing rendered — the
 * tab was not visible — so the only thing it produced was load.
 *
 * Fires once on becoming visible again, so a tab you come back to is current
 * rather than up to one interval stale.
 *
 * ponytail: no options object. Every caller wants exactly this.
 */
export function useVisibleInterval(fn: () => void, ms: number) {
  // The callback changes identity every render; the interval must not.
  const saved = useRef(fn);
  saved.current = fn;

  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;

    const stop = () => {
      if (id !== null) clearInterval(id);
      id = null;
    };
    const start = () => {
      if (id === null) id = setInterval(() => saved.current(), ms);
    };

    const sync = () => {
      if (document.hidden) stop();
      else {
        saved.current();
        start();
      }
    };

    if (!document.hidden) start();
    document.addEventListener('visibilitychange', sync);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', sync);
    };
  }, [ms]);
}

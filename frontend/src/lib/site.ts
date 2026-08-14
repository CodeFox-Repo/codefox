/**
 * Where this deployment is reachable, for links that must be absolute
 * (sitemap, canonical, og:url).
 *
 * ponytail: one env var with a localhost default, not a config object. Vercel
 * sets VERCEL_URL on its own, so a preview deploy gets the right host without
 * anyone configuring anything.
 */
export const siteUrl = (): string => {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const vercel = process.env.NEXT_PUBLIC_VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, '')}`;
  return 'http://localhost:3000';
};

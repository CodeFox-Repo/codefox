import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

/**
 * Generated per request, not at build time.
 *
 * With `revalidate` alone Next PRERENDERS this during the build — and the
 * build runs where no backend is reachable (Vercel has no DATABASE_URL and
 * no API host), so the fetch below always failed and the sitemap shipped
 * frozen with the home page only. Forcing dynamic moves it to request time,
 * where the backend exists. The catch still covers a backend that is down;
 * a sitemap is not worth a 500.
 */
export const dynamic = 'force-dynamic';

/**
 * The landing page and the explore wall, plus every shared page in the gallery.
 *
 * The share links come from `fetchPublicProjects`, which is already public
 * and already the gallery's own query — no new endpoint, no enumeration of
 * anything a visitor cannot see. Pages only: a Next project has no single
 * file to serve, so /share/<id> would 404 for one.
 *
 * ponytail: one request, capped at 200, and the whole thing degrades to the
 * static entry if the backend is down — a sitemap is not worth failing a
 * build over.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const home: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/explore`, changeFrequency: 'daily', priority: 0.8 },
  ];

  const api = process.env.NEXT_PUBLIC_GRAPHQL_URL;
  if (!api) return home;

  try {
    const res = await fetch(api, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{fetchPublicProjects(input:{size:200,strategy:"latest"}){uniqueProjectId template updatedAt}}`,
      }),
      // The sitemap is regenerated hourly; a stuck backend must not hang it.
      signal: AbortSignal.timeout(5000),
    });
    const { data } = await res.json();
    const shared = (data?.fetchPublicProjects ?? [])
      .filter((p: { template?: string }) => p.template === 'html')
      .map((p: { uniqueProjectId: string; updatedAt?: string }) => ({
        url: `${base}/share/${p.uniqueProjectId}`,
        lastModified: p.updatedAt ? new Date(p.updatedAt) : undefined,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }));
    return [...home, ...shared];
  } catch {
    return home;
  }
}

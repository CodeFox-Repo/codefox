import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

/**
 * `/` is the only page worth indexing: it is the landing page AND the gallery
 * (the wall renders below the composer). Everything else is either someone's
 * workspace or a one-time auth link.
 *
 * `/share/*` is served by the backend, not Next, so it is allowed here and
 * listed in the sitemap rather than generated as a route.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/share/'],
      // A reset link in a search result is worse than useless — it is a
      // credential in public. /chat and /settings are per-user, /admin is
      // role-gated, and none of them render anything without a session.
      disallow: ['/chat', '/settings', '/admin', '/auth/', '/reset-password'],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}

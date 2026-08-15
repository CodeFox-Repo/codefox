/**
 * Where a published page is readable by anyone.
 *
 * Relative on purpose: next.config rewrites `/share` to the backend, so the
 * link wears the product's own domain rather than the API host's — a link
 * pointing at a Railway subdomain is not one anybody would send.
 */
export function shareUrl(project: {
  uniqueProjectId?: string | null;
  template?: string | null;
}): string | null {
  if (!project.uniqueProjectId) return null;
  // Pages are served as files; apps boot their sandbox on demand and the
  // visitor is redirected once it answers — both behind the same route.
  return `/share/${project.uniqueProjectId}`;
}

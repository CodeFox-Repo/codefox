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
  // Pages only. A Next app has no single file to serve, so a share link for
  // one could only ever 404; rows predating the column are Next apps.
  if (project.template !== 'html' || !project.uniqueProjectId) return null;
  return `/share/${project.uniqueProjectId}`;
}

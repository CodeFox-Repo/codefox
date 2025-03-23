/**
 * Validate if the current environment is using TLS
 */
export const TLS =
  (typeof window !== 'undefined' && window.location.protocol === 'https:') ||
  process.env.TLS === 'true';

/**
 * Always use HTTPS when the page is loaded over HTTPS
 */
export const URL_PROTOCOL_PREFIX = TLS ? 'https' : 'http';

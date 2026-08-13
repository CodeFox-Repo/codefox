import { BadRequestException } from '@nestjs/common';
import { isIP } from 'node:net';

/**
 * Is this a base url we are willing to point the agent's CLI at?
 *
 * The caller hands us a url and we make requests to it with their key — which
 * is exactly the shape of an SSRF: "https://api.example.com" is the intent,
 * "http://169.254.169.254/latest/meta-data/" is the cloud metadata service and
 * "http://localhost:8080/graphql" is us. Literal-address checks only; a
 * hostname that resolves to a private address still gets through, and closing
 * that needs a resolve-then-pin at connect time the CLI does not expose.
 *
 * ponytail: literal + DNS-resolution check, no connect-time pinning — that
 * needs a custom agent the harness does not let us pass. Revisit if this
 * becomes reachable by untrusted signups.
 */
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata',
  'metadata.google.internal',
  'metadata.goog',
]);

/** "7f00:1" or "127.0.0.1" (both spellings are legal) as dotted quad. */
const mappedV4 = (tail: string): string => {
  if (tail.includes('.')) return tail;
  const [hi, lo] = tail.split(':');
  if (hi === undefined || lo === undefined) return tail;
  const n = (parseInt(hi, 16) << 16) | parseInt(lo, 16);
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(
    '.',
  );
};

/** Ranges no user-supplied endpoint has a legitimate reason to name. */
const isPrivateAddress = (raw: string): boolean => {
  // URL.hostname keeps the brackets on an IPv6 literal, and isIP() rejects
  // anything bracketed — so every v6 address read as "not an IP" and sailed
  // past every check below.
  const host = raw.replace(/^\[|\]$/g, '');
  const v = isIP(host);
  if (v === 4) {
    const [a, b] = host.split('.').map(Number);
    return (
      a === 0 || // this network
      a === 10 || // private
      a === 127 || // loopback
      (a === 100 && b >= 64 && b <= 127) || // CGNAT
      (a === 169 && b === 254) || // link-local, incl. cloud metadata
      (a === 172 && b >= 16 && b <= 31) || // private
      (a === 192 && b === 168) || // private
      a >= 224 // multicast + reserved
    );
  }
  if (v === 6) {
    const h = host.toLowerCase();
    return (
      h === '::' ||
      h === '::1' || // loopback
      h.startsWith('fe80') || // link-local
      h.startsWith('fc') || // unique-local
      h.startsWith('fd') ||
      // IPv4-mapped. URL normalises ::ffff:127.0.0.1 to ::ffff:7f00:1, so the
      // dotted form is only half of it — unpack the hex pair back to v4.
      (h.startsWith('::ffff:') && isPrivateAddress(mappedV4(h.slice(7))))
    );
  }
  return false;
};

export const validateExternalApiBaseUrl = (raw: string): string => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BadRequestException('That base URL is not a valid URL.');
  }

  // https only: the key travels on this connection, and http would put it on
  // the wire in clear. Loopback is not an exception — it is the SSRF target.
  if (url.protocol !== 'https:') {
    throw new BadRequestException('The base URL must start with https://.');
  }

  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith('.localhost')) {
    throw new BadRequestException('That base URL points at this machine.');
  }
  if (isPrivateAddress(host)) {
    throw new BadRequestException('That base URL points at a private address.');
  }

  return url.toString().replace(/\/$/, '');
};

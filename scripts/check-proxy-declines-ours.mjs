import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The preview proxy must decline every route this server answers itself.
 *
 * It runs BEFORE Nest's router (Nest 404s unmatched paths instead of calling
 * next(), so a proxy mounted after it never runs), which means it has to know
 * our own routes by hand. Anything it fails to recognise is forwarded verbatim
 * — method, headers, `Authorization`, body — into the project's dev server,
 * which runs model-written code with this process's privileges.
 *
 * Two ways that went wrong, both fixed and both pinned here:
 *   1. The pattern was case-sensitive while Express 4 routes case-INsensitively
 *      by default, so `/API/chat` and `/GraphQL` reached Nest's handlers while
 *      the proxy did not recognise them as ours and claimed them first.
 *   2. `auth` and `api/test` were simply absent from the list.
 */
const source = readFileSync('backend/src/project/preview-proxy.ts', 'utf8');

const literal = source.match(/const OURS =\s*(\/.*\/[a-z]*);/)?.[1];
assert.ok(literal, 'cannot find the OURS pattern in preview-proxy.ts');

const body = literal.slice(1, literal.lastIndexOf('/'));
const flags = literal.slice(literal.lastIndexOf('/') + 1);
assert.ok(
  flags.includes('i'),
  'OURS lost its `i` flag — Express routes case-insensitively, so /API/chat ' +
    'would reach Nest while the proxy forwards it to the dev server instead'
);
const OURS = new RegExp(body, flags);

// Every route actually mounted in the backend, derived from the
// @Controller prefix plus each method decorator on it — so a new controller
// or a new route that nobody adds to OURS fails here rather than silently
// becoming proxyable. A bare `@Controller('api')` contributes nothing on its
// own; its real paths come from the @Get('project/changes') under it.
const routes = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (entry.endsWith('.ts') && !full.includes('__tests__')) {
      const text = readFileSync(full, 'utf8');
      const prefix = text.match(/^@Controller\((['"])(.*?)\1\)/m)?.[2];
      if (prefix === undefined) continue;
      const methods = [
        ...text.matchAll(/^\s*@(?:Get|Post|Put|Patch|Delete|All)\(([^)]*)\)/gm),
      ];
      // A controller with no argument-less route still owns its prefix.
      const suffixes = methods.length
        ? methods.map((m) => m[1].match(/(['"])(.*?)\1/)?.[2] ?? '')
        : [''];
      for (const suffix of suffixes) {
        routes.push({
          path: `/${[prefix, suffix].filter(Boolean).join('/').replace(/^\/+/, '')}`,
          file: full,
        });
      }
    }
  }
};
walk('backend/src');
assert.ok(
  routes.length >= 12,
  `found suspiciously few routes: ${routes.length}`
);

for (const { path, file } of routes) {
  // Wildcards and :params stand in for any concrete value.
  const concrete = path.replace(/[:*][^/]*/g, 'x');
  assert.ok(
    OURS.test(`${concrete}/`),
    `${file} mounts ${concrete} but the proxy does not claim it — a request ` +
      `carrying the preview cookie is forwarded into the dev server instead`
  );
}

// Casing, because that was the live bug. Express treats these as the same
// route, so the proxy must too.
for (const path of [
  '/API/chat',
  '/Api/Chat',
  '/GraphQL',
  '/GRAPHQL',
  '/Share/x',
]) {
  assert.ok(
    OURS.test(path),
    `the proxy does not claim ${path}, but Express routes it to our handler`
  );
}

// It must still decline what genuinely belongs to the generated app — the
// whole reason this is a route list and not a blanket /api rule.
for (const path of ['/', '/_next/static/x.js', '/api/hello', '/graphqlx']) {
  assert.ok(
    !OURS.test(path),
    `the proxy claims ${path}, which belongs to the project's own app`
  );
}

console.log('ok — the proxy declines every route we answer, in any casing');

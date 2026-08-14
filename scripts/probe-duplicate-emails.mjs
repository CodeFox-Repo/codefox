#!/usr/bin/env node
/**
 * READ ONLY. Lists accounts whose emails differ only by case.
 *
 * Before normalisation `Foo@x.com` and `foo@x.com` could both register. This
 * says whether any such pair actually exists, so the decision about what to
 * do with one is the owner's, made on real data. It merges nothing, deletes
 * nothing, writes nothing.
 *
 *   node scripts/probe-duplicate-emails.mjs                 # local sqlite
 *   DATABASE_URL=postgres://… node scripts/probe-duplicate-emails.mjs
 *
 * For production: Railway's `DATABASE_URL` points at
 * `postgres.railway.internal`, which only resolves INSIDE the Railway
 * network — `railway run` does not help, it runs locally with prod env. Use
 * the Postgres service's public proxy URL from the dashboard
 * (`DATABASE_PUBLIC_URL`, or Connect → Public Network), or run this from a
 * shell in the container.
 *
 * ponytail: one GROUP BY through the driver already installed. No ORM, no
 * Nest bootstrap — this must be runnable against production without loading
 * the app.
 */
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(
  join(dirname(fileURLToPath(import.meta.url)), '../backend/package.json'),
);

const SQL = `
  SELECT LOWER(email) AS normalised, COUNT(*) AS n,
         GROUP_CONCAT(email) AS variants
  FROM user
  GROUP BY LOWER(email)
  HAVING COUNT(*) > 1
`;

const url = process.env.DATABASE_URL;

if (url) {
  const { Client } = require('pg');
  const client = new Client({ connectionString: url });
  await client.connect();
  // string_agg, not GROUP_CONCAT: same query, postgres spelling.
  const { rows } = await client.query(
    SQL.replace('GROUP_CONCAT(email)', "string_agg(email, ',')"),
  );
  report(rows.map((r) => ({ ...r, n: Number(r.n) })));
  await client.end();
} else {
  const sqlite3 = require('sqlite3');
  const path =
    process.env.SQLITE_PATH ??
    join(
      dirname(fileURLToPath(import.meta.url)),
      '../.codefox/data/codefox.db',
    );
  const db = new sqlite3.Database(path, sqlite3.OPEN_READONLY);
  await new Promise((resolve, reject) =>
    db.all(SQL, (err, rows) => {
      if (err) reject(err);
      else {
        report(rows);
        resolve();
      }
    }),
  );
  db.close();
}

function report(rows) {
  if (!rows.length) {
    console.log('ok — no accounts differ only by email case');
    return;
  }
  console.log(`${rows.length} duplicate pair(s) — NOT merged, decide per row:`);
  for (const row of rows) {
    console.log(`  ${row.normalised}  ×${row.n}  [${row.variants}]`);
  }
  console.log(
    '\nLookups now prefer an exact match, then the oldest row, so behaviour is\n' +
      'deterministic either way. Merging or deleting one is a decision for the\n' +
      'account owner, not this script.',
  );
}

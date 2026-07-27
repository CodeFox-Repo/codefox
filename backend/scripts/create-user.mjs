#!/usr/bin/env node
/**
 * Create an account directly, for deployments where sign-up is closed.
 *
 *   node scripts/create-user.mjs <email> <password> [username]
 *
 * Goes through the same bcrypt hashing the login path verifies against, which
 * is why this exists rather than a plain SQL INSERT — a hand-written row would
 * have to reproduce the hash format exactly or the account simply cannot log
 * in. Reads DATABASE_URL the same way the server does: a postgres URL uses
 * PostgreSQL, anything else falls back to the SQLite file.
 */
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(here, '..', '.env') });

const [email, password, username] = process.argv.slice(2);
if (!email || !password) {
  console.error('usage: node scripts/create-user.mjs <email> <password> [username]');
  process.exit(1);
}

const url = process.env.DATABASE_URL;
const isPostgres = url && /^postgres(ql)?:\/\//.test(url);

const dataSource = new DataSource(
  isPostgres
    ? { type: 'postgres', url }
    : {
        type: 'sqlite',
        // Same resolution the server uses, so this writes to the database it
        // actually reads. A hardcoded path silently created the account in a
        // different file.
        database:
          url?.replace(/^sqlite:(\/\/)?/, '') ||
          path.join(
            process.env.CODEFOX_DATA_DIR
              ? path.resolve(process.env.CODEFOX_DATA_DIR)
              : path.join(here, '..', '..', '.codefox'),
            'data',
            'codefox.db',
          ),
      },
);

await dataSource.initialize();

const table = isPostgres ? '"user"' : '`user`';
const [existing] = await dataSource.query(
  `SELECT id FROM ${table} WHERE email = ${isPostgres ? '$1' : '?'}`,
  [email],
);

if (existing) {
  console.error(`A user with ${email} already exists (${existing.id}).`);
  await dataSource.destroy();
  process.exit(1);
}

const id = randomUUID();
const now = new Date().toISOString();
const hashed = await bcrypt.hash(password, 10);

await dataSource.query(
  `INSERT INTO ${table}
     (id, username, email, password, "isEmailConfirmed", "isActive", "isDeleted", "createdAt", "updatedAt")
   VALUES (${isPostgres ? '$1, $2, $3, $4, true, true, false, $5, $6' : '?, ?, ?, ?, 1, 1, 0, ?, ?'})`.replace(
    /"/g,
    isPostgres ? '"' : '`',
  ),
  [id, username || email.split('@')[0], email, hashed, now, now],
);

console.log(`Created ${email} (${id}).`);
await dataSource.destroy();

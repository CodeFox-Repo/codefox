import { Repository } from 'typeorm';
import { User } from '../user/user.model';

/**
 * Look an account up by email, case-insensitively.
 *
 * Email domains are case-insensitive in practice, but only one of the six
 * lookups in this service lowercased its input. So `Foo@x.com` could
 * register, and then "forgot password" — the one that DID lowercase —
 * looked up `foo@x.com`, found nothing, and returned the same
 * "if that address has an account…" line it returns on success. The user
 * waited for an email that was never sent, with nothing logged anywhere.
 * The same gap let `Foo@x.com` and `foo@x.com` become two accounts.
 *
 * Compared with LOWER on BOTH sides rather than normalising the column:
 * production already holds mixed-case rows, and a write-side-only fix would
 * make every one of those accounts unfindable — i.e. unable to log in. This
 * way old rows keep working and new duplicates cannot be created, with no
 * migration.
 *
 * ponytail: LOWER() on a column means no index on it. Fine at 127 users; if
 * this ever shows up in a slow query log, add a generated lowercase column
 * with an index and point this one function at it.
 */
export function findUserByEmail(
  users: Repository<User>,
  email: string,
): Promise<User | null> {
  const wanted = email?.trim().toLowerCase();
  if (!wanted) return Promise.resolve(null);

  const query = users
    .createQueryBuilder('user')
    .where('LOWER(user.email) = :email', { email: wanted })
    // A database that already holds `Foo@x.com` AND `foo@x.com` matches both.
    // Without an order, which one you log into is whatever the planner felt
    // like — so exact match wins, then oldest. Deterministic beats clever:
    // nothing here merges or deletes an account, that is the owner's call.
    .orderBy('CASE WHEN user.email = :exact THEN 0 ELSE 1 END', 'ASC')
    .addOrderBy('user.createdAt', 'ASC')
    .setParameter('exact', email.trim());
  return query.getOne();
}

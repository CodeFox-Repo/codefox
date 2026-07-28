import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a GraphQL operation as reachable without a token.
 *
 * The global guard denies every GraphQL operation by default; this is the
 * explicit, greppable list of exceptions (login, registration, the public
 * gallery, …). Forgetting a guard used to mean an open endpoint — now it
 * means a closed feature, which is the failure direction we can live with.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

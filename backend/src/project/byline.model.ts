import { Field, ID, ObjectType } from '@nestjs/graphql';

/**
 * Who published a project, as a gallery card shows them — and nothing else.
 *
 * `Project.user` hangs off the @Public `fetchPublicProjects`, and nothing
 * guards a GraphQL field resolver: APP_GUARD does not reach them unless
 * `fieldResolverEnhancers` is set, and it is not. So every field the returned
 * TYPE advertises is anonymously readable regardless of what the resolver
 * returns. Typed as `User`, that meant `user { email }` handed a stranger
 * every publisher's address — and isEmailConfirmed, lastEmailSendTime and
 * githubInstallationId with it.
 *
 * Narrowing the resolver to a projection was not enough on its own: the
 * schema still offered the fields, and GraphQL resolved them straight off the
 * entity. The type is the boundary, so the type is what had to shrink. There
 * is deliberately nothing here to leak.
 *
 * The guarded `me` query is how a signed-in user reads their own account, and
 * the admin console has its own `AdminUser` type.
 */
@ObjectType()
export class Byline {
  @Field(() => ID) id: string;
  @Field() username: string;
  @Field({ nullable: true }) avatarUrl?: string;
}

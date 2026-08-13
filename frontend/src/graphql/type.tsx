import {
  GraphQLResolveInfo,
  GraphQLScalarType,
  GraphQLScalarTypeConfig,
} from 'graphql';
import { gql } from '@apollo/client';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = {
  [K in keyof T]: T[K];
};
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]?: Maybe<T[SubKey]>;
};
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]: Maybe<T[SubKey]>;
};
export type MakeEmpty<
  T extends { [key: string]: unknown },
  K extends keyof T,
> = { [_ in K]?: never };
export type Incremental<T> =
  | T
  | {
      [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never;
    };
export type RequireFields<T, K extends keyof T> = Omit<T, K> & {
  [P in K]-?: NonNullable<T[P]>;
};
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string };
  String: { input: string; output: string };
  Boolean: { input: boolean; output: boolean };
  Int: { input: number; output: number };
  Float: { input: number; output: number };
  /** Date custom scalar type */
  Date: { input: Date; output: Date };
  /** The `Upload` scalar type represents a file upload. */
  Upload: { input: any; output: any };
};

export type AdminCounts = {
  __typename: 'AdminCounts';
  chats: Scalars['Int']['output'];
  deletedProjects: Scalars['Int']['output'];
  projects: Scalars['Int']['output'];
  users: Scalars['Int']['output'];
};

export type AdminDisk = {
  __typename: 'AdminDisk';
  orphanDirs: Scalars['Int']['output'];
  projectBytes: Scalars['Float']['output'];
  projectDirs: Scalars['Int']['output'];
};

export type AdminOverview = {
  __typename: 'AdminOverview';
  counts: AdminCounts;
  disk: AdminDisk;
  previews: Array<AdminPreview>;
  runtime: AdminRuntime;
};

export type AdminPreview = {
  __typename: 'AdminPreview';
  pid: Scalars['Int']['output'];
  port: Scalars['Int']['output'];
  projectPath: Scalars['String']['output'];
};

export type AdminProject = {
  __typename: 'AdminProject';
  chats: Scalars['Int']['output'];
  createdAt: Scalars['Date']['output'];
  id: Scalars['String']['output'];
  isPublic: Scalars['Boolean']['output'];
  onDisk: Scalars['Boolean']['output'];
  ownerEmail: Scalars['String']['output'];
  projectName: Scalars['String']['output'];
  projectPath: Scalars['String']['output'];
};

export type AdminRuntime = {
  __typename: 'AdminRuntime';
  model: Scalars['String']['output'];
  nodeEnv: Scalars['String']['output'];
  provider: Scalars['String']['output'];
  registrationOpen: Scalars['Boolean']['output'];
  sandbox: Scalars['String']['output'];
  uptime: Scalars['Int']['output'];
};

export type AdminUser = {
  __typename: 'AdminUser';
  chats: Scalars['Int']['output'];
  createdAt: Scalars['Date']['output'];
  email: Scalars['String']['output'];
  id: Scalars['String']['output'];
  isActive: Scalars['Boolean']['output'];
  projects: Scalars['Int']['output'];
  roles: Array<Scalars['String']['output']>;
  username: Scalars['String']['output'];
};

export type AvatarUploadResponse = {
  __typename: 'AvatarUploadResponse';
  avatarUrl: Scalars['String']['output'];
  success: Scalars['Boolean']['output'];
};

export type Chat = {
  __typename: 'Chat';
  createdAt: Scalars['Date']['output'];
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  isDeleted: Scalars['Boolean']['output'];
  messages?: Maybe<Array<Message>>;
  model?: Maybe<Scalars['String']['output']>;
  project?: Maybe<Project>;
  title?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['Date']['output'];
  user: User;
  userId: Scalars['ID']['output'];
};

export type ChatCompletionChoiceType = {
  __typename: 'ChatCompletionChoiceType';
  delta?: Maybe<ChatCompletionDeltaType>;
  finishReason?: Maybe<Scalars['String']['output']>;
  index?: Maybe<Scalars['Float']['output']>;
};

export type ChatCompletionDeltaType = {
  __typename: 'ChatCompletionDeltaType';
  content?: Maybe<Scalars['String']['output']>;
};

export type ChatInputType = {
  chatId: Scalars['String']['input'];
  message: Scalars['String']['input'];
  model: Scalars['String']['input'];
  role: Scalars['String']['input'];
  steps?: InputMaybe<Array<TurnStepInput>>;
};

export type CheckTokenInput = {
  token: Scalars['String']['input'];
};

export type CreateProjectInput = {
  databaseType?: InputMaybe<Scalars['String']['input']>;
  description: Scalars['String']['input'];
  model?: InputMaybe<Scalars['String']['input']>;
  projectName?: InputMaybe<Scalars['String']['input']>;
  public?: InputMaybe<Scalars['Boolean']['input']>;
  style?: InputMaybe<Scalars['String']['input']>;
  template?: InputMaybe<Scalars['String']['input']>;
};

export type DesignSystemChoice = {
  __typename: 'DesignSystemChoice';
  accent: Scalars['String']['output'];
  bg: Scalars['String']['output'];
  blurb: Scalars['String']['output'];
  category: Scalars['String']['output'];
  fg: Scalars['String']['output'];
  id: Scalars['String']['output'];
  name: Scalars['String']['output'];
  surface: Scalars['String']['output'];
};

export type EmailConfirmationResponse = {
  __typename: 'EmailConfirmationResponse';
  message: Scalars['String']['output'];
  success?: Maybe<Scalars['Boolean']['output']>;
};

export type FetchPublicProjectsInputs = {
  size: Scalars['Float']['input'];
  strategy: Scalars['String']['input'];
};

export type LoginResponse = {
  __typename: 'LoginResponse';
  accessToken: Scalars['String']['output'];
  refreshToken: Scalars['String']['output'];
};

export type LoginUserInput = {
  email: Scalars['String']['input'];
  password: Scalars['String']['input'];
};

export type Menu = {
  __typename: 'Menu';
  createdAt: Scalars['Date']['output'];
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  isDeleted: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  path: Scalars['String']['output'];
  permission: Scalars['String']['output'];
  updatedAt: Scalars['Date']['output'];
};

export type Message = {
  __typename: 'Message';
  content: Scalars['String']['output'];
  createdAt: Scalars['Date']['output'];
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  isDeleted: Scalars['Boolean']['output'];
  modelId?: Maybe<Scalars['String']['output']>;
  role: Role;
  steps?: Maybe<Array<TurnStepType>>;
  updatedAt: Scalars['Date']['output'];
};

export type Mutation = {
  __typename: 'Mutation';
  adminDeleteProject: Scalars['Boolean']['output'];
  adminSetProjectPublic: Scalars['Boolean']['output'];
  adminSetUserActive: Scalars['Boolean']['output'];
  adminStopPreview: Scalars['Boolean']['output'];
  adminSweepOrphans: Scalars['Int']['output'];
  clearChatHistory: Scalars['Boolean']['output'];
  confirmEmail: EmailConfirmationResponse;
  createChat: Chat;
  createProject: Chat;
  deleteChat: Scalars['Boolean']['output'];
  deleteProject: Scalars['Boolean']['output'];
  dropLastAssistantReply: Scalars['Boolean']['output'];
  forkProject: Chat;
  login: LoginResponse;
  refreshToken: RefreshTokenResponse;
  regenerateDescription: Scalars['String']['output'];
  registerUser: User;
  resendConfirmationEmail: EmailConfirmationResponse;
  restyleProject: RestyleResult;
  saveMessage: Scalars['Boolean']['output'];
  updateChatModel?: Maybe<Chat>;
  updateChatTitle?: Maybe<Chat>;
  updateProjectPhoto: Project;
  updateProjectPublicStatus: Project;
  updateUsername: User;
  uploadAvatar: AvatarUploadResponse;
};

export type MutationAdminDeleteProjectArgs = {
  projectId: Scalars['String']['input'];
};

export type MutationAdminSetProjectPublicArgs = {
  isPublic: Scalars['Boolean']['input'];
  projectId: Scalars['String']['input'];
};

export type MutationAdminSetUserActiveArgs = {
  isActive: Scalars['Boolean']['input'];
  userId: Scalars['String']['input'];
};

export type MutationAdminStopPreviewArgs = {
  projectPath: Scalars['String']['input'];
};

export type MutationClearChatHistoryArgs = {
  chatId: Scalars['String']['input'];
};

export type MutationConfirmEmailArgs = {
  token: Scalars['String']['input'];
};

export type MutationCreateChatArgs = {
  newChatInput: NewChatInput;
};

export type MutationCreateProjectArgs = {
  createProjectInput: CreateProjectInput;
};

export type MutationDeleteChatArgs = {
  chatId: Scalars['String']['input'];
};

export type MutationDeleteProjectArgs = {
  projectId: Scalars['String']['input'];
};

export type MutationDropLastAssistantReplyArgs = {
  chatId: Scalars['String']['input'];
};

export type MutationForkProjectArgs = {
  projectId: Scalars['ID']['input'];
};

export type MutationLoginArgs = {
  input: LoginUserInput;
};

export type MutationRefreshTokenArgs = {
  refreshToken: Scalars['String']['input'];
};

export type MutationRegenerateDescriptionArgs = {
  input: Scalars['String']['input'];
};

export type MutationRegisterUserArgs = {
  input: RegisterUserInput;
};

export type MutationResendConfirmationEmailArgs = {
  input: ResendEmailInput;
};

export type MutationRestyleProjectArgs = {
  projectId: Scalars['ID']['input'];
  styleId: Scalars['String']['input'];
};

export type MutationSaveMessageArgs = {
  input: ChatInputType;
};

export type MutationUpdateChatModelArgs = {
  chatId: Scalars['String']['input'];
  model: Scalars['String']['input'];
};

export type MutationUpdateChatTitleArgs = {
  updateChatTitleInput: UpdateChatTitleInput;
};

export type MutationUpdateProjectPhotoArgs = {
  input: UpdateProjectPhotoInput;
};

export type MutationUpdateProjectPublicStatusArgs = {
  isPublic: Scalars['Boolean']['input'];
  projectId: Scalars['ID']['input'];
};

export type MutationUpdateUsernameArgs = {
  username: Scalars['String']['input'];
};

export type MutationUploadAvatarArgs = {
  file: Scalars['Upload']['input'];
};

export type NewChatInput = {
  title?: InputMaybe<Scalars['String']['input']>;
};

export type Project = {
  __typename: 'Project';
  chats: Array<Chat>;
  createdAt: Scalars['Date']['output'];
  forkedFrom?: Maybe<Project>;
  forkedFromId?: Maybe<Scalars['String']['output']>;
  forks?: Maybe<Array<Project>>;
  githubOwner?: Maybe<Scalars['String']['output']>;
  githubRepoName?: Maybe<Scalars['String']['output']>;
  githubRepoUrl?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  isDeleted: Scalars['Boolean']['output'];
  isPublic: Scalars['Boolean']['output'];
  isSyncedWithGitHub: Scalars['Boolean']['output'];
  photoUrl?: Maybe<Scalars['String']['output']>;
  projectName: Scalars['String']['output'];
  projectPath: Scalars['String']['output'];
  subNumber: Scalars['Float']['output'];
  /** Projects that are copies of this project */
  subscribers?: Maybe<Array<Project>>;
  template?: Maybe<Scalars['String']['output']>;
  uniqueProjectId: Scalars['String']['output'];
  updatedAt: Scalars['Date']['output'];
  user: User;
  userId: Scalars['ID']['output'];
};

export type Query = {
  __typename: 'Query';
  adminOverview: AdminOverview;
  adminProjects: Array<AdminProject>;
  adminUsers: Array<AdminUser>;
  checkToken: Scalars['Boolean']['output'];
  designSystems: Array<DesignSystemChoice>;
  emailVerificationRequired: Scalars['Boolean']['output'];
  fetchPublicProjects: Array<Project>;
  getAvailableModelTags?: Maybe<Array<Scalars['String']['output']>>;
  getChatDetails?: Maybe<Chat>;
  getChatHistory: Array<Message>;
  getProject: Project;
  getUserChats?: Maybe<Array<Chat>>;
  getUserProjects: Array<Project>;
  googleAuthAvailable: Scalars['Boolean']['output'];
  logout: Scalars['Boolean']['output'];
  me: User;
  registrationOpen: Scalars['Boolean']['output'];
};

export type QueryCheckTokenArgs = {
  input: CheckTokenInput;
};

export type QueryFetchPublicProjectsArgs = {
  input: FetchPublicProjectsInputs;
};

export type QueryGetChatDetailsArgs = {
  chatId: Scalars['String']['input'];
};

export type QueryGetChatHistoryArgs = {
  chatId: Scalars['String']['input'];
};

export type QueryGetProjectArgs = {
  projectId: Scalars['String']['input'];
};

export type RefreshTokenResponse = {
  __typename: 'RefreshTokenResponse';
  accessToken: Scalars['String']['output'];
  refreshToken: Scalars['String']['output'];
};

export type RegisterUserInput = {
  confirmPassword: Scalars['String']['input'];
  email: Scalars['String']['input'];
  password: Scalars['String']['input'];
  username: Scalars['String']['input'];
};

export type ResendEmailInput = {
  email: Scalars['String']['input'];
};

export type RestyleResult = {
  __typename: 'RestyleResult';
  message: Scalars['String']['output'];
  ok: Scalars['Boolean']['output'];
};

export type Role = 'Assistant' | 'System' | 'User';

export type TurnStepInput = {
  file?: InputMaybe<Scalars['String']['input']>;
  kind: Scalars['String']['input'];
  text?: InputMaybe<Scalars['String']['input']>;
  tool?: InputMaybe<Scalars['String']['input']>;
};

export type TurnStepType = {
  __typename: 'TurnStepType';
  file?: Maybe<Scalars['String']['output']>;
  kind: Scalars['String']['output'];
  text?: Maybe<Scalars['String']['output']>;
  tool?: Maybe<Scalars['String']['output']>;
};

export type UpdateChatTitleInput = {
  chatId: Scalars['String']['input'];
  title?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateProjectPhotoInput = {
  file: Scalars['Upload']['input'];
  projectId: Scalars['ID']['input'];
};

export type User = {
  __typename: 'User';
  avatarUrl?: Maybe<Scalars['String']['output']>;
  chats: Array<Chat>;
  createdAt: Scalars['Date']['output'];
  email: Scalars['String']['output'];
  githubInstallationId?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  isDeleted: Scalars['Boolean']['output'];
  isEmailConfirmed: Scalars['Boolean']['output'];
  lastEmailSendTime: Scalars['Date']['output'];
  projects: Array<Project>;
  roles: Array<Scalars['String']['output']>;
  /** @deprecated Use projects with forkedFromId instead */
  subscribedProjects?: Maybe<Array<Project>>;
  updatedAt: Scalars['Date']['output'];
  username: Scalars['String']['output'];
};

export type WithIndex<TObject> = TObject & Record<string, any>;
export type ResolversObject<TObject> = WithIndex<TObject>;

export type ResolverTypeWrapper<T> = Promise<T> | T;

export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<TResult, TParent = {}, TContext = {}, TArgs = {}> =
  | ResolverFn<TResult, TParent, TContext, TArgs>
  | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<
  TResult,
  TKey extends string,
  TParent,
  TContext,
  TArgs,
> {
  subscribe: SubscriptionSubscribeFn<
    { [key in TKey]: TResult },
    TParent,
    TContext,
    TArgs
  >;
  resolve?: SubscriptionResolveFn<
    TResult,
    { [key in TKey]: TResult },
    TContext,
    TArgs
  >;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<
  TResult,
  TKey extends string,
  TParent,
  TContext,
  TArgs,
> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<
  TResult,
  TKey extends string,
  TParent = {},
  TContext = {},
  TArgs = {},
> =
  | ((
      ...args: any[]
    ) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = {}, TContext = {}> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = {}, TContext = {}> = (
  obj: T,
  context: TContext,
  info: GraphQLResolveInfo
) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<
  TResult = {},
  TParent = {},
  TContext = {},
  TArgs = {},
> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = ResolversObject<{
  AdminCounts: ResolverTypeWrapper<AdminCounts>;
  AdminDisk: ResolverTypeWrapper<AdminDisk>;
  AdminOverview: ResolverTypeWrapper<AdminOverview>;
  AdminPreview: ResolverTypeWrapper<AdminPreview>;
  AdminProject: ResolverTypeWrapper<AdminProject>;
  AdminRuntime: ResolverTypeWrapper<AdminRuntime>;
  AdminUser: ResolverTypeWrapper<AdminUser>;
  AvatarUploadResponse: ResolverTypeWrapper<AvatarUploadResponse>;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  Chat: ResolverTypeWrapper<Chat>;
  ChatCompletionChoiceType: ResolverTypeWrapper<ChatCompletionChoiceType>;
  ChatCompletionDeltaType: ResolverTypeWrapper<ChatCompletionDeltaType>;
  ChatInputType: ChatInputType;
  CheckTokenInput: CheckTokenInput;
  CreateProjectInput: CreateProjectInput;
  Date: ResolverTypeWrapper<Scalars['Date']['output']>;
  DesignSystemChoice: ResolverTypeWrapper<DesignSystemChoice>;
  EmailConfirmationResponse: ResolverTypeWrapper<EmailConfirmationResponse>;
  FetchPublicProjectsInputs: FetchPublicProjectsInputs;
  Float: ResolverTypeWrapper<Scalars['Float']['output']>;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  LoginResponse: ResolverTypeWrapper<LoginResponse>;
  LoginUserInput: LoginUserInput;
  Menu: ResolverTypeWrapper<Menu>;
  Message: ResolverTypeWrapper<Message>;
  Mutation: ResolverTypeWrapper<{}>;
  NewChatInput: NewChatInput;
  Project: ResolverTypeWrapper<Project>;
  Query: ResolverTypeWrapper<{}>;
  RefreshTokenResponse: ResolverTypeWrapper<RefreshTokenResponse>;
  RegisterUserInput: RegisterUserInput;
  ResendEmailInput: ResendEmailInput;
  RestyleResult: ResolverTypeWrapper<RestyleResult>;
  Role: Role;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  TurnStepInput: TurnStepInput;
  TurnStepType: ResolverTypeWrapper<TurnStepType>;
  UpdateChatTitleInput: UpdateChatTitleInput;
  UpdateProjectPhotoInput: UpdateProjectPhotoInput;
  Upload: ResolverTypeWrapper<Scalars['Upload']['output']>;
  User: ResolverTypeWrapper<User>;
}>;

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = ResolversObject<{
  AdminCounts: AdminCounts;
  AdminDisk: AdminDisk;
  AdminOverview: AdminOverview;
  AdminPreview: AdminPreview;
  AdminProject: AdminProject;
  AdminRuntime: AdminRuntime;
  AdminUser: AdminUser;
  AvatarUploadResponse: AvatarUploadResponse;
  Boolean: Scalars['Boolean']['output'];
  Chat: Chat;
  ChatCompletionChoiceType: ChatCompletionChoiceType;
  ChatCompletionDeltaType: ChatCompletionDeltaType;
  ChatInputType: ChatInputType;
  CheckTokenInput: CheckTokenInput;
  CreateProjectInput: CreateProjectInput;
  Date: Scalars['Date']['output'];
  DesignSystemChoice: DesignSystemChoice;
  EmailConfirmationResponse: EmailConfirmationResponse;
  FetchPublicProjectsInputs: FetchPublicProjectsInputs;
  Float: Scalars['Float']['output'];
  ID: Scalars['ID']['output'];
  Int: Scalars['Int']['output'];
  LoginResponse: LoginResponse;
  LoginUserInput: LoginUserInput;
  Menu: Menu;
  Message: Message;
  Mutation: {};
  NewChatInput: NewChatInput;
  Project: Project;
  Query: {};
  RefreshTokenResponse: RefreshTokenResponse;
  RegisterUserInput: RegisterUserInput;
  ResendEmailInput: ResendEmailInput;
  RestyleResult: RestyleResult;
  String: Scalars['String']['output'];
  TurnStepInput: TurnStepInput;
  TurnStepType: TurnStepType;
  UpdateChatTitleInput: UpdateChatTitleInput;
  UpdateProjectPhotoInput: UpdateProjectPhotoInput;
  Upload: Scalars['Upload']['output'];
  User: User;
}>;

export type AdminCountsResolvers<
  ContextType = any,
  ParentType extends
    ResolversParentTypes['AdminCounts'] = ResolversParentTypes['AdminCounts'],
> = ResolversObject<{
  chats?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  deletedProjects?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  projects?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  users?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type AdminDiskResolvers<
  ContextType = any,
  ParentType extends
    ResolversParentTypes['AdminDisk'] = ResolversParentTypes['AdminDisk'],
> = ResolversObject<{
  orphanDirs?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  projectBytes?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  projectDirs?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type AdminOverviewResolvers<
  ContextType = any,
  ParentType extends
    ResolversParentTypes['AdminOverview'] = ResolversParentTypes['AdminOverview'],
> = ResolversObject<{
  counts?: Resolver<ResolversTypes['AdminCounts'], ParentType, ContextType>;
  disk?: Resolver<ResolversTypes['AdminDisk'], ParentType, ContextType>;
  previews?: Resolver<
    Array<ResolversTypes['AdminPreview']>,
    ParentType,
    ContextType
  >;
  runtime?: Resolver<ResolversTypes['AdminRuntime'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type AdminPreviewResolvers<
  ContextType = any,
  ParentType extends
    ResolversParentTypes['AdminPreview'] = ResolversParentTypes['AdminPreview'],
> = ResolversObject<{
  pid?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  port?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  projectPath?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type AdminProjectResolvers<
  ContextType = any,
  ParentType extends
    ResolversParentTypes['AdminProject'] = ResolversParentTypes['AdminProject'],
> = ResolversObject<{
  chats?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  isPublic?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  onDisk?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  ownerEmail?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  projectName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  projectPath?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type AdminRuntimeResolvers<
  ContextType = any,
  ParentType extends
    ResolversParentTypes['AdminRuntime'] = ResolversParentTypes['AdminRuntime'],
> = ResolversObject<{
  model?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  nodeEnv?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  provider?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  registrationOpen?: Resolver<
    ResolversTypes['Boolean'],
    ParentType,
    ContextType
  >;
  sandbox?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  uptime?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type AdminUserResolvers<
  ContextType = any,
  ParentType extends
    ResolversParentTypes['AdminUser'] = ResolversParentTypes['AdminUser'],
> = ResolversObject<{
  chats?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  email?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  isActive?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  projects?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  roles?: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  username?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type AvatarUploadResponseResolvers<
  ContextType = any,
  ParentType extends
    ResolversParentTypes['AvatarUploadResponse'] = ResolversParentTypes['AvatarUploadResponse'],
> = ResolversObject<{
  avatarUrl?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  success?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type ChatResolvers<
  ContextType = any,
  ParentType extends
    ResolversParentTypes['Chat'] = ResolversParentTypes['Chat'],
> = ResolversObject<{
  createdAt?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  isActive?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isDeleted?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  messages?: Resolver<
    Maybe<Array<ResolversTypes['Message']>>,
    ParentType,
    ContextType
  >;
  model?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  project?: Resolver<Maybe<ResolversTypes['Project']>, ParentType, ContextType>;
  title?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  user?: Resolver<ResolversTypes['User'], ParentType, ContextType>;
  userId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type ChatCompletionChoiceTypeResolvers<
  ContextType = any,
  ParentType extends
    ResolversParentTypes['ChatCompletionChoiceType'] = ResolversParentTypes['ChatCompletionChoiceType'],
> = ResolversObject<{
  delta?: Resolver<
    Maybe<ResolversTypes['ChatCompletionDeltaType']>,
    ParentType,
    ContextType
  >;
  finishReason?: Resolver<
    Maybe<ResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  index?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type ChatCompletionDeltaTypeResolvers<
  ContextType = any,
  ParentType extends
    ResolversParentTypes['ChatCompletionDeltaType'] = ResolversParentTypes['ChatCompletionDeltaType'],
> = ResolversObject<{
  content?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export interface DateScalarConfig
  extends GraphQLScalarTypeConfig<ResolversTypes['Date'], any> {
  name: 'Date';
}

export type DesignSystemChoiceResolvers<
  ContextType = any,
  ParentType extends
    ResolversParentTypes['DesignSystemChoice'] = ResolversParentTypes['DesignSystemChoice'],
> = ResolversObject<{
  accent?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  bg?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  blurb?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  category?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  fg?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  surface?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type EmailConfirmationResponseResolvers<
  ContextType = any,
  ParentType extends
    ResolversParentTypes['EmailConfirmationResponse'] = ResolversParentTypes['EmailConfirmationResponse'],
> = ResolversObject<{
  message?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  success?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type LoginResponseResolvers<
  ContextType = any,
  ParentType extends
    ResolversParentTypes['LoginResponse'] = ResolversParentTypes['LoginResponse'],
> = ResolversObject<{
  accessToken?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  refreshToken?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type MenuResolvers<
  ContextType = any,
  ParentType extends
    ResolversParentTypes['Menu'] = ResolversParentTypes['Menu'],
> = ResolversObject<{
  createdAt?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  isActive?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isDeleted?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  path?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  permission?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type MessageResolvers<
  ContextType = any,
  ParentType extends
    ResolversParentTypes['Message'] = ResolversParentTypes['Message'],
> = ResolversObject<{
  content?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  isActive?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isDeleted?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  modelId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  role?: Resolver<ResolversTypes['Role'], ParentType, ContextType>;
  steps?: Resolver<
    Maybe<Array<ResolversTypes['TurnStepType']>>,
    ParentType,
    ContextType
  >;
  updatedAt?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type MutationResolvers<
  ContextType = any,
  ParentType extends
    ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation'],
> = ResolversObject<{
  adminDeleteProject?: Resolver<
    ResolversTypes['Boolean'],
    ParentType,
    ContextType,
    RequireFields<MutationAdminDeleteProjectArgs, 'projectId'>
  >;
  adminSetProjectPublic?: Resolver<
    ResolversTypes['Boolean'],
    ParentType,
    ContextType,
    RequireFields<MutationAdminSetProjectPublicArgs, 'isPublic' | 'projectId'>
  >;
  adminSetUserActive?: Resolver<
    ResolversTypes['Boolean'],
    ParentType,
    ContextType,
    RequireFields<MutationAdminSetUserActiveArgs, 'isActive' | 'userId'>
  >;
  adminStopPreview?: Resolver<
    ResolversTypes['Boolean'],
    ParentType,
    ContextType,
    RequireFields<MutationAdminStopPreviewArgs, 'projectPath'>
  >;
  adminSweepOrphans?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  clearChatHistory?: Resolver<
    ResolversTypes['Boolean'],
    ParentType,
    ContextType,
    RequireFields<MutationClearChatHistoryArgs, 'chatId'>
  >;
  confirmEmail?: Resolver<
    ResolversTypes['EmailConfirmationResponse'],
    ParentType,
    ContextType,
    RequireFields<MutationConfirmEmailArgs, 'token'>
  >;
  createChat?: Resolver<
    ResolversTypes['Chat'],
    ParentType,
    ContextType,
    RequireFields<MutationCreateChatArgs, 'newChatInput'>
  >;
  createProject?: Resolver<
    ResolversTypes['Chat'],
    ParentType,
    ContextType,
    RequireFields<MutationCreateProjectArgs, 'createProjectInput'>
  >;
  deleteChat?: Resolver<
    ResolversTypes['Boolean'],
    ParentType,
    ContextType,
    RequireFields<MutationDeleteChatArgs, 'chatId'>
  >;
  deleteProject?: Resolver<
    ResolversTypes['Boolean'],
    ParentType,
    ContextType,
    RequireFields<MutationDeleteProjectArgs, 'projectId'>
  >;
  dropLastAssistantReply?: Resolver<
    ResolversTypes['Boolean'],
    ParentType,
    ContextType,
    RequireFields<MutationDropLastAssistantReplyArgs, 'chatId'>
  >;
  forkProject?: Resolver<
    ResolversTypes['Chat'],
    ParentType,
    ContextType,
    RequireFields<MutationForkProjectArgs, 'projectId'>
  >;
  login?: Resolver<
    ResolversTypes['LoginResponse'],
    ParentType,
    ContextType,
    RequireFields<MutationLoginArgs, 'input'>
  >;
  refreshToken?: Resolver<
    ResolversTypes['RefreshTokenResponse'],
    ParentType,
    ContextType,
    RequireFields<MutationRefreshTokenArgs, 'refreshToken'>
  >;
  regenerateDescription?: Resolver<
    ResolversTypes['String'],
    ParentType,
    ContextType,
    RequireFields<MutationRegenerateDescriptionArgs, 'input'>
  >;
  registerUser?: Resolver<
    ResolversTypes['User'],
    ParentType,
    ContextType,
    RequireFields<MutationRegisterUserArgs, 'input'>
  >;
  resendConfirmationEmail?: Resolver<
    ResolversTypes['EmailConfirmationResponse'],
    ParentType,
    ContextType,
    RequireFields<MutationResendConfirmationEmailArgs, 'input'>
  >;
  restyleProject?: Resolver<
    ResolversTypes['RestyleResult'],
    ParentType,
    ContextType,
    RequireFields<MutationRestyleProjectArgs, 'projectId' | 'styleId'>
  >;
  saveMessage?: Resolver<
    ResolversTypes['Boolean'],
    ParentType,
    ContextType,
    RequireFields<MutationSaveMessageArgs, 'input'>
  >;
  updateChatModel?: Resolver<
    Maybe<ResolversTypes['Chat']>,
    ParentType,
    ContextType,
    RequireFields<MutationUpdateChatModelArgs, 'chatId' | 'model'>
  >;
  updateChatTitle?: Resolver<
    Maybe<ResolversTypes['Chat']>,
    ParentType,
    ContextType,
    RequireFields<MutationUpdateChatTitleArgs, 'updateChatTitleInput'>
  >;
  updateProjectPhoto?: Resolver<
    ResolversTypes['Project'],
    ParentType,
    ContextType,
    RequireFields<MutationUpdateProjectPhotoArgs, 'input'>
  >;
  updateProjectPublicStatus?: Resolver<
    ResolversTypes['Project'],
    ParentType,
    ContextType,
    RequireFields<
      MutationUpdateProjectPublicStatusArgs,
      'isPublic' | 'projectId'
    >
  >;
  updateUsername?: Resolver<
    ResolversTypes['User'],
    ParentType,
    ContextType,
    RequireFields<MutationUpdateUsernameArgs, 'username'>
  >;
  uploadAvatar?: Resolver<
    ResolversTypes['AvatarUploadResponse'],
    ParentType,
    ContextType,
    RequireFields<MutationUploadAvatarArgs, 'file'>
  >;
}>;

export type ProjectResolvers<
  ContextType = any,
  ParentType extends
    ResolversParentTypes['Project'] = ResolversParentTypes['Project'],
> = ResolversObject<{
  chats?: Resolver<Array<ResolversTypes['Chat']>, ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  forkedFrom?: Resolver<
    Maybe<ResolversTypes['Project']>,
    ParentType,
    ContextType
  >;
  forkedFromId?: Resolver<
    Maybe<ResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  forks?: Resolver<
    Maybe<Array<ResolversTypes['Project']>>,
    ParentType,
    ContextType
  >;
  githubOwner?: Resolver<
    Maybe<ResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  githubRepoName?: Resolver<
    Maybe<ResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  githubRepoUrl?: Resolver<
    Maybe<ResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  isActive?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isDeleted?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isPublic?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isSyncedWithGitHub?: Resolver<
    ResolversTypes['Boolean'],
    ParentType,
    ContextType
  >;
  photoUrl?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  projectName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  projectPath?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  subNumber?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  subscribers?: Resolver<
    Maybe<Array<ResolversTypes['Project']>>,
    ParentType,
    ContextType
  >;
  template?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  uniqueProjectId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  user?: Resolver<ResolversTypes['User'], ParentType, ContextType>;
  userId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type QueryResolvers<
  ContextType = any,
  ParentType extends
    ResolversParentTypes['Query'] = ResolversParentTypes['Query'],
> = ResolversObject<{
  adminOverview?: Resolver<
    ResolversTypes['AdminOverview'],
    ParentType,
    ContextType
  >;
  adminProjects?: Resolver<
    Array<ResolversTypes['AdminProject']>,
    ParentType,
    ContextType
  >;
  adminUsers?: Resolver<
    Array<ResolversTypes['AdminUser']>,
    ParentType,
    ContextType
  >;
  checkToken?: Resolver<
    ResolversTypes['Boolean'],
    ParentType,
    ContextType,
    RequireFields<QueryCheckTokenArgs, 'input'>
  >;
  designSystems?: Resolver<
    Array<ResolversTypes['DesignSystemChoice']>,
    ParentType,
    ContextType
  >;
  emailVerificationRequired?: Resolver<
    ResolversTypes['Boolean'],
    ParentType,
    ContextType
  >;
  fetchPublicProjects?: Resolver<
    Array<ResolversTypes['Project']>,
    ParentType,
    ContextType,
    RequireFields<QueryFetchPublicProjectsArgs, 'input'>
  >;
  getAvailableModelTags?: Resolver<
    Maybe<Array<ResolversTypes['String']>>,
    ParentType,
    ContextType
  >;
  getChatDetails?: Resolver<
    Maybe<ResolversTypes['Chat']>,
    ParentType,
    ContextType,
    RequireFields<QueryGetChatDetailsArgs, 'chatId'>
  >;
  getChatHistory?: Resolver<
    Array<ResolversTypes['Message']>,
    ParentType,
    ContextType,
    RequireFields<QueryGetChatHistoryArgs, 'chatId'>
  >;
  getProject?: Resolver<
    ResolversTypes['Project'],
    ParentType,
    ContextType,
    RequireFields<QueryGetProjectArgs, 'projectId'>
  >;
  getUserChats?: Resolver<
    Maybe<Array<ResolversTypes['Chat']>>,
    ParentType,
    ContextType
  >;
  getUserProjects?: Resolver<
    Array<ResolversTypes['Project']>,
    ParentType,
    ContextType
  >;
  googleAuthAvailable?: Resolver<
    ResolversTypes['Boolean'],
    ParentType,
    ContextType
  >;
  logout?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  me?: Resolver<ResolversTypes['User'], ParentType, ContextType>;
  registrationOpen?: Resolver<
    ResolversTypes['Boolean'],
    ParentType,
    ContextType
  >;
}>;

export type RefreshTokenResponseResolvers<
  ContextType = any,
  ParentType extends
    ResolversParentTypes['RefreshTokenResponse'] = ResolversParentTypes['RefreshTokenResponse'],
> = ResolversObject<{
  accessToken?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  refreshToken?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type RestyleResultResolvers<
  ContextType = any,
  ParentType extends
    ResolversParentTypes['RestyleResult'] = ResolversParentTypes['RestyleResult'],
> = ResolversObject<{
  message?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  ok?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type TurnStepTypeResolvers<
  ContextType = any,
  ParentType extends
    ResolversParentTypes['TurnStepType'] = ResolversParentTypes['TurnStepType'],
> = ResolversObject<{
  file?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  kind?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  text?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  tool?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export interface UploadScalarConfig
  extends GraphQLScalarTypeConfig<ResolversTypes['Upload'], any> {
  name: 'Upload';
}

export type UserResolvers<
  ContextType = any,
  ParentType extends
    ResolversParentTypes['User'] = ResolversParentTypes['User'],
> = ResolversObject<{
  avatarUrl?: Resolver<
    Maybe<ResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  chats?: Resolver<Array<ResolversTypes['Chat']>, ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  email?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  githubInstallationId?: Resolver<
    Maybe<ResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  isActive?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isDeleted?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isEmailConfirmed?: Resolver<
    ResolversTypes['Boolean'],
    ParentType,
    ContextType
  >;
  lastEmailSendTime?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  projects?: Resolver<
    Array<ResolversTypes['Project']>,
    ParentType,
    ContextType
  >;
  roles?: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  subscribedProjects?: Resolver<
    Maybe<Array<ResolversTypes['Project']>>,
    ParentType,
    ContextType
  >;
  updatedAt?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  username?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type Resolvers<ContextType = any> = ResolversObject<{
  AdminCounts?: AdminCountsResolvers<ContextType>;
  AdminDisk?: AdminDiskResolvers<ContextType>;
  AdminOverview?: AdminOverviewResolvers<ContextType>;
  AdminPreview?: AdminPreviewResolvers<ContextType>;
  AdminProject?: AdminProjectResolvers<ContextType>;
  AdminRuntime?: AdminRuntimeResolvers<ContextType>;
  AdminUser?: AdminUserResolvers<ContextType>;
  AvatarUploadResponse?: AvatarUploadResponseResolvers<ContextType>;
  Chat?: ChatResolvers<ContextType>;
  ChatCompletionChoiceType?: ChatCompletionChoiceTypeResolvers<ContextType>;
  ChatCompletionDeltaType?: ChatCompletionDeltaTypeResolvers<ContextType>;
  Date?: GraphQLScalarType;
  DesignSystemChoice?: DesignSystemChoiceResolvers<ContextType>;
  EmailConfirmationResponse?: EmailConfirmationResponseResolvers<ContextType>;
  LoginResponse?: LoginResponseResolvers<ContextType>;
  Menu?: MenuResolvers<ContextType>;
  Message?: MessageResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  Project?: ProjectResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  RefreshTokenResponse?: RefreshTokenResponseResolvers<ContextType>;
  RestyleResult?: RestyleResultResolvers<ContextType>;
  TurnStepType?: TurnStepTypeResolvers<ContextType>;
  Upload?: GraphQLScalarType;
  User?: UserResolvers<ContextType>;
}>;

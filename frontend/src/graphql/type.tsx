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

export type ChatCompletionChunkType = {
  __typename: 'ChatCompletionChunkType';
  choices: Array<ChatCompletionChoiceType>;
  created?: Maybe<Scalars['Float']['output']>;
  id: Scalars['String']['output'];
  model?: Maybe<Scalars['String']['output']>;
  object?: Maybe<Scalars['String']['output']>;
  status: StreamStatus;
  systemFingerprint?: Maybe<Scalars['String']['output']>;
};

export type ChatCompletionDeltaType = {
  __typename: 'ChatCompletionDeltaType';
  content?: Maybe<Scalars['String']['output']>;
};

export type ChatFilterInput = {
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  isDeleted?: InputMaybe<Scalars['Boolean']['input']>;
  projectId?: InputMaybe<Scalars['String']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type ChatInputType = {
  chatId: Scalars['String']['input'];
  message: Scalars['String']['input'];
  model: Scalars['String']['input'];
  role: Scalars['String']['input'];
};

export type CheckTokenInput = {
  token: Scalars['String']['input'];
};

export type CreateChatInput = {
  projectId?: InputMaybe<Scalars['ID']['input']>;
  title: Scalars['String']['input'];
};

export type CreateMenuInput = {
  name: Scalars['String']['input'];
  path: Scalars['String']['input'];
  permission: Scalars['String']['input'];
  roleIds?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type CreateProjectInput = {
  databaseType?: InputMaybe<Scalars['String']['input']>;
  description: Scalars['String']['input'];
  model?: InputMaybe<Scalars['String']['input']>;
  packages?: InputMaybe<Array<ProjectPackage>>;
  projectName?: InputMaybe<Scalars['String']['input']>;
  public?: InputMaybe<Scalars['Boolean']['input']>;
};

export type CreateRoleInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  menuIds?: InputMaybe<Array<Scalars['String']['input']>>;
  name: Scalars['String']['input'];
};

export type CreateUserInput = {
  email: Scalars['String']['input'];
  password: Scalars['String']['input'];
  roleIds?: Array<Scalars['String']['input']>;
  username: Scalars['String']['input'];
};

export type DashboardStats = {
  __typename: 'DashboardStats';
  activeChats: Scalars['Int']['output'];
  activeProjects: Scalars['Int']['output'];
  activeUsers: Scalars['Int']['output'];
  totalChats: Scalars['Int']['output'];
  totalMenus: Scalars['Int']['output'];
  totalProjects: Scalars['Int']['output'];
  totalRoles: Scalars['Int']['output'];
  totalUsers: Scalars['Int']['output'];
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

export type IsValidProjectInput = {
  projectId: Scalars['ID']['input'];
  projectPath?: InputMaybe<Scalars['String']['input']>;
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
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  isDeleted: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  path: Scalars['String']['output'];
  permission: Scalars['String']['output'];
  roles?: Maybe<Array<SystemRole>>;
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
  updatedAt: Scalars['Date']['output'];
};

export type Mutation = {
  __typename: 'Mutation';
  clearChatHistory: Scalars['Boolean']['output'];
  confirmEmail: EmailConfirmationResponse;
  createChat: Chat;
  createDashboardChat: Chat;
  createDashboardProject: Chat;
  createDashboardRole: SystemRole;
  createDashboardUser: User;
  createMenu: Menu;
  createProject: Chat;
  createRole: SystemRole;
  deleteChat: Scalars['Boolean']['output'];
  deleteDashboardChat: Scalars['Boolean']['output'];
  deleteDashboardProject: Scalars['Boolean']['output'];
  deleteDashboardRole: Scalars['Boolean']['output'];
  deleteDashboardUser: Scalars['Boolean']['output'];
  deleteProject: Scalars['Boolean']['output'];
  forkProject: Chat;
  login: LoginResponse;
  refreshToken: RefreshTokenResponse;
  regenerateDescription: Scalars['String']['output'];
  registerUser: User;
  removeMenu: Scalars['Boolean']['output'];
  removeRole: Scalars['Boolean']['output'];
  resendConfirmationEmail: EmailConfirmationResponse;
  saveMessage: Scalars['Boolean']['output'];
  subscribeToProject: Project;
  syncProjectToGitHub: Project;
  triggerChatStream: Scalars['Boolean']['output'];
  updateChatTitle?: Maybe<Chat>;
  updateDashboardChat: Chat;
  updateDashboardProject: Project;
  updateDashboardRole: SystemRole;
  updateDashboardUser: User;
  updateMenu: Menu;
  updateProjectPhoto: Project;
  updateProjectPublicStatus: Project;
  updateRole: SystemRole;
  uploadAvatar: AvatarUploadResponse;
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

export type MutationCreateDashboardChatArgs = {
  input: CreateChatInput;
};

export type MutationCreateDashboardProjectArgs = {
  input: CreateProjectInput;
};

export type MutationCreateDashboardRoleArgs = {
  input: CreateRoleInput;
};

export type MutationCreateDashboardUserArgs = {
  input: CreateUserInput;
};

export type MutationCreateMenuArgs = {
  createMenuInput: CreateMenuInput;
};

export type MutationCreateProjectArgs = {
  createProjectInput: CreateProjectInput;
};

export type MutationCreateRoleArgs = {
  createRoleInput: CreateRoleInput;
};

export type MutationDeleteChatArgs = {
  chatId: Scalars['String']['input'];
};

export type MutationDeleteDashboardChatArgs = {
  id: Scalars['ID']['input'];
};

export type MutationDeleteDashboardProjectArgs = {
  id: Scalars['ID']['input'];
};

export type MutationDeleteDashboardRoleArgs = {
  id: Scalars['ID']['input'];
};

export type MutationDeleteDashboardUserArgs = {
  id: Scalars['ID']['input'];
};

export type MutationDeleteProjectArgs = {
  projectId: Scalars['String']['input'];
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

export type MutationRemoveMenuArgs = {
  id: Scalars['ID']['input'];
};

export type MutationRemoveRoleArgs = {
  id: Scalars['ID']['input'];
};

export type MutationResendConfirmationEmailArgs = {
  input: ResendEmailInput;
};

export type MutationSaveMessageArgs = {
  input: ChatInputType;
};

export type MutationSubscribeToProjectArgs = {
  projectId: Scalars['ID']['input'];
};

export type MutationSyncProjectToGitHubArgs = {
  projectId: Scalars['String']['input'];
};

export type MutationTriggerChatStreamArgs = {
  input: ChatInputType;
};

export type MutationUpdateChatTitleArgs = {
  updateChatTitleInput: UpdateChatTitleInput;
};

export type MutationUpdateDashboardChatArgs = {
  id: Scalars['ID']['input'];
  input: UpdateChatInput;
};

export type MutationUpdateDashboardProjectArgs = {
  id: Scalars['ID']['input'];
  input: UpdateProjectInput;
};

export type MutationUpdateDashboardRoleArgs = {
  id: Scalars['ID']['input'];
  input: UpdateRoleInput;
};

export type MutationUpdateDashboardUserArgs = {
  id: Scalars['ID']['input'];
  input: UpdateUserInput;
};

export type MutationUpdateMenuArgs = {
  updateMenuInput: UpdateMenuInput;
};

export type MutationUpdateProjectPhotoArgs = {
  input: UpdateProjectPhotoInput;
};

export type MutationUpdateProjectPublicStatusArgs = {
  isPublic: Scalars['Boolean']['input'];
  projectId: Scalars['ID']['input'];
};

export type MutationUpdateRoleArgs = {
  updateRoleInput: UpdateRoleInput;
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
  projectPackages?: Maybe<Array<ProjectPackages>>;
  projectPath: Scalars['String']['output'];
  subNumber: Scalars['Float']['output'];
  /** Projects that are copies of this project */
  subscribers?: Maybe<Array<Project>>;
  uniqueProjectId: Scalars['String']['output'];
  updatedAt: Scalars['Date']['output'];
  user: User;
  userId: Scalars['ID']['output'];
};

export type ProjectFilterInput = {
  createdAfter?: InputMaybe<Scalars['Date']['input']>;
  createdBefore?: InputMaybe<Scalars['Date']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  isDeleted?: InputMaybe<Scalars['Boolean']['input']>;
  isPublic?: InputMaybe<Scalars['Boolean']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['String']['input']>;
};

export type ProjectPackage = {
  name: Scalars['String']['input'];
  version: Scalars['String']['input'];
};

export type ProjectPackages = {
  __typename: 'ProjectPackages';
  content: Scalars['String']['output'];
  createdAt: Scalars['Date']['output'];
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  isDeleted: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  updatedAt: Scalars['Date']['output'];
  version: Scalars['String']['output'];
};

export type Query = {
  __typename: 'Query';
  checkToken: Scalars['Boolean']['output'];
  dashboardChat: Chat;
  dashboardChats: Array<Chat>;
  dashboardProject: Project;
  dashboardProjects: Array<Project>;
  dashboardRole: SystemRole;
  dashboardRoles: Array<SystemRole>;
  dashboardStats: DashboardStats;
  dashboardTelemetryLog: TelemetryLog;
  dashboardTelemetryLogs: Array<TelemetryLog>;
  dashboardTelemetryLogsCount: Scalars['Float']['output'];
  dashboardUser: User;
  dashboardUsers: Array<User>;
  fetchPublicProjects: Array<Project>;
  getAvailableModelTags?: Maybe<Array<Scalars['String']['output']>>;
  getChatDetails?: Maybe<Chat>;
  getChatHistory: Array<Message>;
  getCurProject?: Maybe<Project>;
  getHello: Scalars['String']['output'];
  getProject: Project;
  getRemainingProjectLimit: Scalars['Int']['output'];
  getSubscribedProjects: Array<Project>;
  getUserAvatar?: Maybe<Scalars['String']['output']>;
  getUserChats?: Maybe<Array<Chat>>;
  getUserProjects: Array<Project>;
  isValidateProject: Scalars['Boolean']['output'];
  logout: Scalars['Boolean']['output'];
  me: User;
  menu: Menu;
  menus: Array<Menu>;
  role: SystemRole;
  roles: Array<SystemRole>;
};

export type QueryCheckTokenArgs = {
  input: CheckTokenInput;
};

export type QueryDashboardChatArgs = {
  id: Scalars['ID']['input'];
};

export type QueryDashboardChatsArgs = {
  filter?: InputMaybe<ChatFilterInput>;
};

export type QueryDashboardProjectArgs = {
  id: Scalars['ID']['input'];
};

export type QueryDashboardProjectsArgs = {
  filter?: InputMaybe<ProjectFilterInput>;
};

export type QueryDashboardRoleArgs = {
  id: Scalars['ID']['input'];
};

export type QueryDashboardTelemetryLogArgs = {
  id: Scalars['ID']['input'];
};

export type QueryDashboardTelemetryLogsArgs = {
  filter?: InputMaybe<TelemetryLogFilterInput>;
};

export type QueryDashboardTelemetryLogsCountArgs = {
  filter?: InputMaybe<TelemetryLogFilterInput>;
};

export type QueryDashboardUserArgs = {
  id: Scalars['ID']['input'];
};

export type QueryDashboardUsersArgs = {
  filter?: InputMaybe<UserFilterInput>;
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

export type QueryGetCurProjectArgs = {
  chatId: Scalars['String']['input'];
};

export type QueryGetProjectArgs = {
  projectId: Scalars['String']['input'];
};

export type QueryGetUserAvatarArgs = {
  userId: Scalars['String']['input'];
};

export type QueryIsValidateProjectArgs = {
  isValidProject: IsValidProjectInput;
};

export type QueryMenuArgs = {
  id: Scalars['ID']['input'];
};

export type QueryRoleArgs = {
  id: Scalars['ID']['input'];
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

export type Role = 'Assistant' | 'System' | 'User';

export type StreamStatus = 'DONE' | 'STREAMING';

export type Subscription = {
  __typename: 'Subscription';
  chatStream?: Maybe<ChatCompletionChunkType>;
};

export type SubscriptionChatStreamArgs = {
  input: ChatInputType;
};

export type SystemRole = {
  __typename: 'SystemRole';
  createdAt: Scalars['Date']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  isDeleted: Scalars['Boolean']['output'];
  menus?: Maybe<Array<Menu>>;
  name: Scalars['String']['output'];
  updatedAt: Scalars['Date']['output'];
  users?: Maybe<Array<User>>;
};

export type TelemetryLog = {
  __typename: 'TelemetryLog';
  email?: Maybe<Scalars['String']['output']>;
  endpoint: Scalars['String']['output'];
  handler?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  input?: Maybe<Scalars['String']['output']>;
  inputToken?: Maybe<Scalars['String']['output']>;
  output?: Maybe<Scalars['String']['output']>;
  outputToken?: Maybe<Scalars['String']['output']>;
  requestMethod: Scalars['String']['output'];
  timeConsumed: Scalars['Float']['output'];
  timestamp: Scalars['Date']['output'];
  userId?: Maybe<Scalars['String']['output']>;
};

export type TelemetryLogFilterInput = {
  email?: InputMaybe<Scalars['String']['input']>;
  endDate?: InputMaybe<Scalars['Date']['input']>;
  endpoint?: InputMaybe<Scalars['String']['input']>;
  handler?: InputMaybe<Scalars['String']['input']>;
  maxTimeConsumed?: InputMaybe<Scalars['Float']['input']>;
  minTimeConsumed?: InputMaybe<Scalars['Float']['input']>;
  requestMethod?: InputMaybe<Scalars['String']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  startDate?: InputMaybe<Scalars['Date']['input']>;
};

export type UpdateChatInput = {
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateChatTitleInput = {
  chatId: Scalars['String']['input'];
  title?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateMenuInput = {
  id: Scalars['ID']['input'];
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  path?: InputMaybe<Scalars['String']['input']>;
  permission?: InputMaybe<Scalars['String']['input']>;
  roleIds?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type UpdateProjectInput = {
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  isPublic?: InputMaybe<Scalars['Boolean']['input']>;
  packageIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  projectName?: InputMaybe<Scalars['String']['input']>;
  projectPath?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateProjectPhotoInput = {
  file: Scalars['Upload']['input'];
  projectId: Scalars['ID']['input'];
};

export type UpdateRoleInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  menuIds?: InputMaybe<Array<Scalars['String']['input']>>;
  name?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateUserInput = {
  email?: InputMaybe<Scalars['String']['input']>;
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  password?: InputMaybe<Scalars['String']['input']>;
  roleIds?: InputMaybe<Array<Scalars['String']['input']>>;
  username?: InputMaybe<Scalars['String']['input']>;
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
  roles: Array<SystemRole>;
  /** @deprecated Use projects with forkedFromId instead */
  subscribedProjects?: Maybe<Array<Project>>;
  updatedAt: Scalars['Date']['output'];
  username: Scalars['String']['output'];
};

export type UserFilterInput = {
  isActive?: InputMaybe<Scalars['Boolean']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
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
  AvatarUploadResponse: ResolverTypeWrapper<AvatarUploadResponse>;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  Chat: ResolverTypeWrapper<Chat>;
  ChatCompletionChoiceType: ResolverTypeWrapper<ChatCompletionChoiceType>;
  ChatCompletionChunkType: ResolverTypeWrapper<ChatCompletionChunkType>;
  ChatCompletionDeltaType: ResolverTypeWrapper<ChatCompletionDeltaType>;
  ChatFilterInput: ChatFilterInput;
  ChatInputType: ChatInputType;
  CheckTokenInput: CheckTokenInput;
  CreateChatInput: CreateChatInput;
  CreateMenuInput: CreateMenuInput;
  CreateProjectInput: CreateProjectInput;
  CreateRoleInput: CreateRoleInput;
  CreateUserInput: CreateUserInput;
  DashboardStats: ResolverTypeWrapper<DashboardStats>;
  Date: ResolverTypeWrapper<Scalars['Date']['output']>;
  EmailConfirmationResponse: ResolverTypeWrapper<EmailConfirmationResponse>;
  FetchPublicProjectsInputs: FetchPublicProjectsInputs;
  Float: ResolverTypeWrapper<Scalars['Float']['output']>;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  IsValidProjectInput: IsValidProjectInput;
  LoginResponse: ResolverTypeWrapper<LoginResponse>;
  LoginUserInput: LoginUserInput;
  Menu: ResolverTypeWrapper<Menu>;
  Message: ResolverTypeWrapper<Message>;
  Mutation: ResolverTypeWrapper<{}>;
  NewChatInput: NewChatInput;
  Project: ResolverTypeWrapper<Project>;
  ProjectFilterInput: ProjectFilterInput;
  ProjectPackage: ProjectPackage;
  ProjectPackages: ResolverTypeWrapper<ProjectPackages>;
  Query: ResolverTypeWrapper<{}>;
  RefreshTokenResponse: ResolverTypeWrapper<RefreshTokenResponse>;
  RegisterUserInput: RegisterUserInput;
  ResendEmailInput: ResendEmailInput;
  Role: Role;
  StreamStatus: StreamStatus;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  Subscription: ResolverTypeWrapper<{}>;
  SystemRole: ResolverTypeWrapper<SystemRole>;
  TelemetryLog: ResolverTypeWrapper<TelemetryLog>;
  TelemetryLogFilterInput: TelemetryLogFilterInput;
  UpdateChatInput: UpdateChatInput;
  UpdateChatTitleInput: UpdateChatTitleInput;
  UpdateMenuInput: UpdateMenuInput;
  UpdateProjectInput: UpdateProjectInput;
  UpdateProjectPhotoInput: UpdateProjectPhotoInput;
  UpdateRoleInput: UpdateRoleInput;
  UpdateUserInput: UpdateUserInput;
  Upload: ResolverTypeWrapper<Scalars['Upload']['output']>;
  User: ResolverTypeWrapper<User>;
  UserFilterInput: UserFilterInput;
}>;

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = ResolversObject<{
  AvatarUploadResponse: AvatarUploadResponse;
  Boolean: Scalars['Boolean']['output'];
  Chat: Chat;
  ChatCompletionChoiceType: ChatCompletionChoiceType;
  ChatCompletionChunkType: ChatCompletionChunkType;
  ChatCompletionDeltaType: ChatCompletionDeltaType;
  ChatFilterInput: ChatFilterInput;
  ChatInputType: ChatInputType;
  CheckTokenInput: CheckTokenInput;
  CreateChatInput: CreateChatInput;
  CreateMenuInput: CreateMenuInput;
  CreateProjectInput: CreateProjectInput;
  CreateRoleInput: CreateRoleInput;
  CreateUserInput: CreateUserInput;
  DashboardStats: DashboardStats;
  Date: Scalars['Date']['output'];
  EmailConfirmationResponse: EmailConfirmationResponse;
  FetchPublicProjectsInputs: FetchPublicProjectsInputs;
  Float: Scalars['Float']['output'];
  ID: Scalars['ID']['output'];
  Int: Scalars['Int']['output'];
  IsValidProjectInput: IsValidProjectInput;
  LoginResponse: LoginResponse;
  LoginUserInput: LoginUserInput;
  Menu: Menu;
  Message: Message;
  Mutation: {};
  NewChatInput: NewChatInput;
  Project: Project;
  ProjectFilterInput: ProjectFilterInput;
  ProjectPackage: ProjectPackage;
  ProjectPackages: ProjectPackages;
  Query: {};
  RefreshTokenResponse: RefreshTokenResponse;
  RegisterUserInput: RegisterUserInput;
  ResendEmailInput: ResendEmailInput;
  String: Scalars['String']['output'];
  Subscription: {};
  SystemRole: SystemRole;
  TelemetryLog: TelemetryLog;
  TelemetryLogFilterInput: TelemetryLogFilterInput;
  UpdateChatInput: UpdateChatInput;
  UpdateChatTitleInput: UpdateChatTitleInput;
  UpdateMenuInput: UpdateMenuInput;
  UpdateProjectInput: UpdateProjectInput;
  UpdateProjectPhotoInput: UpdateProjectPhotoInput;
  UpdateRoleInput: UpdateRoleInput;
  UpdateUserInput: UpdateUserInput;
  Upload: Scalars['Upload']['output'];
  User: User;
  UserFilterInput: UserFilterInput;
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

export type ChatCompletionChunkTypeResolvers<
  ContextType = any,
  ParentType extends
    ResolversParentTypes['ChatCompletionChunkType'] = ResolversParentTypes['ChatCompletionChunkType'],
> = ResolversObject<{
  choices?: Resolver<
    Array<ResolversTypes['ChatCompletionChoiceType']>,
    ParentType,
    ContextType
  >;
  created?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  model?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  object?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  status?: Resolver<ResolversTypes['StreamStatus'], ParentType, ContextType>;
  systemFingerprint?: Resolver<
    Maybe<ResolversTypes['String']>,
    ParentType,
    ContextType
  >;
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

export type DashboardStatsResolvers<
  ContextType = any,
  ParentType extends
    ResolversParentTypes['DashboardStats'] = ResolversParentTypes['DashboardStats'],
> = ResolversObject<{
  activeChats?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  activeProjects?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  activeUsers?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  totalChats?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  totalMenus?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  totalProjects?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  totalRoles?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  totalUsers?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export interface DateScalarConfig
  extends GraphQLScalarTypeConfig<ResolversTypes['Date'], any> {
  name: 'Date';
}

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
  description?: Resolver<
    Maybe<ResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  isActive?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isDeleted?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  path?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  permission?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  roles?: Resolver<
    Maybe<Array<ResolversTypes['SystemRole']>>,
    ParentType,
    ContextType
  >;
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
  updatedAt?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type MutationResolvers<
  ContextType = any,
  ParentType extends
    ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation'],
> = ResolversObject<{
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
  createDashboardChat?: Resolver<
    ResolversTypes['Chat'],
    ParentType,
    ContextType,
    RequireFields<MutationCreateDashboardChatArgs, 'input'>
  >;
  createDashboardProject?: Resolver<
    ResolversTypes['Chat'],
    ParentType,
    ContextType,
    RequireFields<MutationCreateDashboardProjectArgs, 'input'>
  >;
  createDashboardRole?: Resolver<
    ResolversTypes['SystemRole'],
    ParentType,
    ContextType,
    RequireFields<MutationCreateDashboardRoleArgs, 'input'>
  >;
  createDashboardUser?: Resolver<
    ResolversTypes['User'],
    ParentType,
    ContextType,
    RequireFields<MutationCreateDashboardUserArgs, 'input'>
  >;
  createMenu?: Resolver<
    ResolversTypes['Menu'],
    ParentType,
    ContextType,
    RequireFields<MutationCreateMenuArgs, 'createMenuInput'>
  >;
  createProject?: Resolver<
    ResolversTypes['Chat'],
    ParentType,
    ContextType,
    RequireFields<MutationCreateProjectArgs, 'createProjectInput'>
  >;
  createRole?: Resolver<
    ResolversTypes['SystemRole'],
    ParentType,
    ContextType,
    RequireFields<MutationCreateRoleArgs, 'createRoleInput'>
  >;
  deleteChat?: Resolver<
    ResolversTypes['Boolean'],
    ParentType,
    ContextType,
    RequireFields<MutationDeleteChatArgs, 'chatId'>
  >;
  deleteDashboardChat?: Resolver<
    ResolversTypes['Boolean'],
    ParentType,
    ContextType,
    RequireFields<MutationDeleteDashboardChatArgs, 'id'>
  >;
  deleteDashboardProject?: Resolver<
    ResolversTypes['Boolean'],
    ParentType,
    ContextType,
    RequireFields<MutationDeleteDashboardProjectArgs, 'id'>
  >;
  deleteDashboardRole?: Resolver<
    ResolversTypes['Boolean'],
    ParentType,
    ContextType,
    RequireFields<MutationDeleteDashboardRoleArgs, 'id'>
  >;
  deleteDashboardUser?: Resolver<
    ResolversTypes['Boolean'],
    ParentType,
    ContextType,
    RequireFields<MutationDeleteDashboardUserArgs, 'id'>
  >;
  deleteProject?: Resolver<
    ResolversTypes['Boolean'],
    ParentType,
    ContextType,
    RequireFields<MutationDeleteProjectArgs, 'projectId'>
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
  removeMenu?: Resolver<
    ResolversTypes['Boolean'],
    ParentType,
    ContextType,
    RequireFields<MutationRemoveMenuArgs, 'id'>
  >;
  removeRole?: Resolver<
    ResolversTypes['Boolean'],
    ParentType,
    ContextType,
    RequireFields<MutationRemoveRoleArgs, 'id'>
  >;
  resendConfirmationEmail?: Resolver<
    ResolversTypes['EmailConfirmationResponse'],
    ParentType,
    ContextType,
    RequireFields<MutationResendConfirmationEmailArgs, 'input'>
  >;
  saveMessage?: Resolver<
    ResolversTypes['Boolean'],
    ParentType,
    ContextType,
    RequireFields<MutationSaveMessageArgs, 'input'>
  >;
  subscribeToProject?: Resolver<
    ResolversTypes['Project'],
    ParentType,
    ContextType,
    RequireFields<MutationSubscribeToProjectArgs, 'projectId'>
  >;
  syncProjectToGitHub?: Resolver<
    ResolversTypes['Project'],
    ParentType,
    ContextType,
    RequireFields<MutationSyncProjectToGitHubArgs, 'projectId'>
  >;
  triggerChatStream?: Resolver<
    ResolversTypes['Boolean'],
    ParentType,
    ContextType,
    RequireFields<MutationTriggerChatStreamArgs, 'input'>
  >;
  updateChatTitle?: Resolver<
    Maybe<ResolversTypes['Chat']>,
    ParentType,
    ContextType,
    RequireFields<MutationUpdateChatTitleArgs, 'updateChatTitleInput'>
  >;
  updateDashboardChat?: Resolver<
    ResolversTypes['Chat'],
    ParentType,
    ContextType,
    RequireFields<MutationUpdateDashboardChatArgs, 'id' | 'input'>
  >;
  updateDashboardProject?: Resolver<
    ResolversTypes['Project'],
    ParentType,
    ContextType,
    RequireFields<MutationUpdateDashboardProjectArgs, 'id' | 'input'>
  >;
  updateDashboardRole?: Resolver<
    ResolversTypes['SystemRole'],
    ParentType,
    ContextType,
    RequireFields<MutationUpdateDashboardRoleArgs, 'id' | 'input'>
  >;
  updateDashboardUser?: Resolver<
    ResolversTypes['User'],
    ParentType,
    ContextType,
    RequireFields<MutationUpdateDashboardUserArgs, 'id' | 'input'>
  >;
  updateMenu?: Resolver<
    ResolversTypes['Menu'],
    ParentType,
    ContextType,
    RequireFields<MutationUpdateMenuArgs, 'updateMenuInput'>
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
  updateRole?: Resolver<
    ResolversTypes['SystemRole'],
    ParentType,
    ContextType,
    RequireFields<MutationUpdateRoleArgs, 'updateRoleInput'>
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
  projectPackages?: Resolver<
    Maybe<Array<ResolversTypes['ProjectPackages']>>,
    ParentType,
    ContextType
  >;
  projectPath?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  subNumber?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  subscribers?: Resolver<
    Maybe<Array<ResolversTypes['Project']>>,
    ParentType,
    ContextType
  >;
  uniqueProjectId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  user?: Resolver<ResolversTypes['User'], ParentType, ContextType>;
  userId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type ProjectPackagesResolvers<
  ContextType = any,
  ParentType extends
    ResolversParentTypes['ProjectPackages'] = ResolversParentTypes['ProjectPackages'],
> = ResolversObject<{
  content?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  isActive?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isDeleted?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  version?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type QueryResolvers<
  ContextType = any,
  ParentType extends
    ResolversParentTypes['Query'] = ResolversParentTypes['Query'],
> = ResolversObject<{
  checkToken?: Resolver<
    ResolversTypes['Boolean'],
    ParentType,
    ContextType,
    RequireFields<QueryCheckTokenArgs, 'input'>
  >;
  dashboardChat?: Resolver<
    ResolversTypes['Chat'],
    ParentType,
    ContextType,
    RequireFields<QueryDashboardChatArgs, 'id'>
  >;
  dashboardChats?: Resolver<
    Array<ResolversTypes['Chat']>,
    ParentType,
    ContextType,
    Partial<QueryDashboardChatsArgs>
  >;
  dashboardProject?: Resolver<
    ResolversTypes['Project'],
    ParentType,
    ContextType,
    RequireFields<QueryDashboardProjectArgs, 'id'>
  >;
  dashboardProjects?: Resolver<
    Array<ResolversTypes['Project']>,
    ParentType,
    ContextType,
    Partial<QueryDashboardProjectsArgs>
  >;
  dashboardRole?: Resolver<
    ResolversTypes['SystemRole'],
    ParentType,
    ContextType,
    RequireFields<QueryDashboardRoleArgs, 'id'>
  >;
  dashboardRoles?: Resolver<
    Array<ResolversTypes['SystemRole']>,
    ParentType,
    ContextType
  >;
  dashboardStats?: Resolver<
    ResolversTypes['DashboardStats'],
    ParentType,
    ContextType
  >;
  dashboardTelemetryLog?: Resolver<
    ResolversTypes['TelemetryLog'],
    ParentType,
    ContextType,
    RequireFields<QueryDashboardTelemetryLogArgs, 'id'>
  >;
  dashboardTelemetryLogs?: Resolver<
    Array<ResolversTypes['TelemetryLog']>,
    ParentType,
    ContextType,
    Partial<QueryDashboardTelemetryLogsArgs>
  >;
  dashboardTelemetryLogsCount?: Resolver<
    ResolversTypes['Float'],
    ParentType,
    ContextType,
    Partial<QueryDashboardTelemetryLogsCountArgs>
  >;
  dashboardUser?: Resolver<
    ResolversTypes['User'],
    ParentType,
    ContextType,
    RequireFields<QueryDashboardUserArgs, 'id'>
  >;
  dashboardUsers?: Resolver<
    Array<ResolversTypes['User']>,
    ParentType,
    ContextType,
    Partial<QueryDashboardUsersArgs>
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
  getCurProject?: Resolver<
    Maybe<ResolversTypes['Project']>,
    ParentType,
    ContextType,
    RequireFields<QueryGetCurProjectArgs, 'chatId'>
  >;
  getHello?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  getProject?: Resolver<
    ResolversTypes['Project'],
    ParentType,
    ContextType,
    RequireFields<QueryGetProjectArgs, 'projectId'>
  >;
  getRemainingProjectLimit?: Resolver<
    ResolversTypes['Int'],
    ParentType,
    ContextType
  >;
  getSubscribedProjects?: Resolver<
    Array<ResolversTypes['Project']>,
    ParentType,
    ContextType
  >;
  getUserAvatar?: Resolver<
    Maybe<ResolversTypes['String']>,
    ParentType,
    ContextType,
    RequireFields<QueryGetUserAvatarArgs, 'userId'>
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
  isValidateProject?: Resolver<
    ResolversTypes['Boolean'],
    ParentType,
    ContextType,
    RequireFields<QueryIsValidateProjectArgs, 'isValidProject'>
  >;
  logout?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  me?: Resolver<ResolversTypes['User'], ParentType, ContextType>;
  menu?: Resolver<
    ResolversTypes['Menu'],
    ParentType,
    ContextType,
    RequireFields<QueryMenuArgs, 'id'>
  >;
  menus?: Resolver<Array<ResolversTypes['Menu']>, ParentType, ContextType>;
  role?: Resolver<
    ResolversTypes['SystemRole'],
    ParentType,
    ContextType,
    RequireFields<QueryRoleArgs, 'id'>
  >;
  roles?: Resolver<
    Array<ResolversTypes['SystemRole']>,
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

export type SubscriptionResolvers<
  ContextType = any,
  ParentType extends
    ResolversParentTypes['Subscription'] = ResolversParentTypes['Subscription'],
> = ResolversObject<{
  chatStream?: SubscriptionResolver<
    Maybe<ResolversTypes['ChatCompletionChunkType']>,
    'chatStream',
    ParentType,
    ContextType,
    RequireFields<SubscriptionChatStreamArgs, 'input'>
  >;
}>;

export type SystemRoleResolvers<
  ContextType = any,
  ParentType extends
    ResolversParentTypes['SystemRole'] = ResolversParentTypes['SystemRole'],
> = ResolversObject<{
  createdAt?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  description?: Resolver<
    Maybe<ResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  isActive?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isDeleted?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  menus?: Resolver<
    Maybe<Array<ResolversTypes['Menu']>>,
    ParentType,
    ContextType
  >;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  users?: Resolver<
    Maybe<Array<ResolversTypes['User']>>,
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type TelemetryLogResolvers<
  ContextType = any,
  ParentType extends
    ResolversParentTypes['TelemetryLog'] = ResolversParentTypes['TelemetryLog'],
> = ResolversObject<{
  email?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  endpoint?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  handler?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  input?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  inputToken?: Resolver<
    Maybe<ResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  output?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  outputToken?: Resolver<
    Maybe<ResolversTypes['String']>,
    ParentType,
    ContextType
  >;
  requestMethod?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  timeConsumed?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  timestamp?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  userId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
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
  roles?: Resolver<
    Array<ResolversTypes['SystemRole']>,
    ParentType,
    ContextType
  >;
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
  AvatarUploadResponse?: AvatarUploadResponseResolvers<ContextType>;
  Chat?: ChatResolvers<ContextType>;
  ChatCompletionChoiceType?: ChatCompletionChoiceTypeResolvers<ContextType>;
  ChatCompletionChunkType?: ChatCompletionChunkTypeResolvers<ContextType>;
  ChatCompletionDeltaType?: ChatCompletionDeltaTypeResolvers<ContextType>;
  DashboardStats?: DashboardStatsResolvers<ContextType>;
  Date?: GraphQLScalarType;
  EmailConfirmationResponse?: EmailConfirmationResponseResolvers<ContextType>;
  LoginResponse?: LoginResponseResolvers<ContextType>;
  Menu?: MenuResolvers<ContextType>;
  Message?: MessageResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  Project?: ProjectResolvers<ContextType>;
  ProjectPackages?: ProjectPackagesResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  RefreshTokenResponse?: RefreshTokenResponseResolvers<ContextType>;
  Subscription?: SubscriptionResolvers<ContextType>;
  SystemRole?: SystemRoleResolvers<ContextType>;
  TelemetryLog?: TelemetryLogResolvers<ContextType>;
  Upload?: GraphQLScalarType;
  User?: UserResolvers<ContextType>;
}>;

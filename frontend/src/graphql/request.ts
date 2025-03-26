import { ApolloClient, gql, TypedDocumentNode } from '@apollo/client';
import type { DocumentNode } from 'graphql';

export const CHECK_TOKEN_QUERY = gql`
  query CheckToken($input: CheckTokenInput!) {
    checkToken(input: $input)
  }
`;

export const GET_MODEL_TAGS = gql`
  query GetAvailableModelTags {
    getAvailableModelTags
  }
`;

export interface ModelTagsData {
  getAvailableModelTags: string[];
}

export const FETCH_PUBLIC_PROJECTS = gql`
  query FetchPublicProjects($input: FetchPublicProjectsInputs!) {
    fetchPublicProjects(input: $input) {
      id
      projectName
      projectPath
      createdAt
      user {
        username
      }
      photoUrl
      subNumber
    }
  }
`;

export const CREATE_CHAT = gql`
  mutation CreateChat($input: NewChatInput!) {
    createChat(newChatInput: $input) {
      id
      title
      isActive
      createdAt
    }
  }
`;

export const GET_CHAT_HISTORY = gql`
  query GetChatHistory($chatId: String!) {
    getChatHistory(chatId: $chatId) {
      id
      content
      role
      createdAt
    }
  }
`;

export const CHAT_STREAM = gql`
  subscription ChatStream($input: ChatInputType!) {
    chatStream(input: $input) {
      id
      created
      choices {
        delta {
          content
        }
        finishReason
        index
      }
      model
      object
      status
    }
  }
`;

export const GET_USER_CHATS = gql`
  query GetUserChats {
    getUserChats {
      id
      title
      createdAt
      messages {
        id
        content
        role
        createdAt
      }
    }
  }
`;

export const DELETE_CHAT = gql`
  mutation DeleteChat($chatId: String!) {
    deleteChat(chatId: $chatId)
  }
`;

export const GET_USER_INFO = gql`
  query me {
    me {
      username
      email
      avatarUrl
      githubInstallationId
    }
  }
`;

export const TRIGGER_CHAT = gql`
  mutation TriggerChatStream($input: ChatInputType!) {
    triggerChatStream(input: $input)
  }
`;

// Query to get user projects
export const GET_USER_PROJECTS = gql`
  query GetUserProjects {
    getUserProjects {
      id
      projectName
      projectPath
      isPublic
      photoUrl
      subNumber
      userId
      forkedFromId
      isDeleted
      projectPackages {
        id
        content
        version
      }
    }
  }
`;

// export const CREATE_PROJECT = gql`
//   mutation CreateProject($createProjectInput: CreateProjectInput!) {
//     createProject(createProjectInput: $createProjectInput) {
//       id
//       title
//       createdAt
//       updatedAt
//     }
//   }
// `;

export const getUserProjects = async (client: ApolloClient<unknown>) => {
  const response = await client.query({ query: GET_USER_PROJECTS });
  return response.data.getUserProjects;
};

// Query to get chat details
export const GET_CHAT_DETAILS = gql`
  query GetChatDetails($chatId: String!) {
    getChatDetails(chatId: $chatId) {
      id
      title
      userId
      messages {
        id
        content
        role
        createdAt
      }
      project {
        id
        projectName
        projectPath
        isPublic
        photoUrl
      }
    }
  }
`;
export const GET_CUR_PROJECT = gql`
  query GetCurProject($chatId: String!) {
    getCurProject(chatId: $chatId) {
      id
      projectName
      projectPath
    }
  }
`;
export const SAVE_MESSAGE = gql`
  mutation SaveMessage($input: ChatInputType!) {
    saveMessage(input: $input)
  }
`;
// Mutation to create a new project
export const CREATE_PROJECT = gql`
  mutation CreateProject($createProjectInput: CreateProjectInput!) {
    createProject(createProjectInput: $createProjectInput) {
      id
      title
      createdAt
      updatedAt
      project {
        id
        projectName
        projectPath
        isPublic
        photoUrl
        userId
        subNumber
      }
    }
  }
`;

// Mutation to fork an existing project
export const FORK_PROJECT = gql`
  mutation ForkProject($projectId: ID!) {
    forkProject(projectId: $projectId) {
      id
      title
      project {
        id
        projectName
        projectPath
        isPublic
        photoUrl
        userId
        forkedFromId
        subNumber
      }
    }
  }
`;

// Mutation to update project public status
export const UPDATE_PROJECT_PUBLIC_STATUS = gql`
  mutation UpdateProjectPublicStatus($projectId: ID!, $isPublic: Boolean!) {
    updateProjectPublicStatus(projectId: $projectId, isPublic: $isPublic) {
      id
      projectName
      path
      projectPackages {
        id
        content
      }
    }
  }
`;

// Mutation to update project photo url
export const UPDATE_PROJECT_PHOTO_URL = gql`
  mutation UpdateProjectPhoto($input: UpdateProjectPhotoInput!) {
    updateProjectPhoto(input: $input) {
      id
      photoUrl
    }
  }
`;

// Query to get subscribed/forked projects
export const GET_SUBSCRIBED_PROJECTS = gql`
  query GetSubscribedProjects {
    getSubscribedProjects {
      id
      projectName
      projectPath
      isPublic
      photoUrl
      userId
      forkedFromId
      subNumber
    }
  }
`;

// mutation to upload a user avatar
export const UPLOAD_AVATAR = gql`
  mutation UploadAvatar($file: Upload!) {
    uploadAvatar(file: $file) {
      success
      avatarUrl
    }
  }
`;

//query to get user avatar
export const GET_USER_AVATAR = gql`
  query GetUserAvatar($userId: String!) {
    getUserAvatar(userId: $userId)
  }
`;

// sync project with github
export const SYNC_PROJECT_TO_GITHUB = gql`
  mutation SyncProjectToGitHub($projectId: String!) {
    syncProjectToGitHub(projectId: $projectId) {
      id
      projectName
      isSyncedWithGitHub
      githubOwner
      githubRepoName
      githubRepoUrl
    }
  }
`;

export const GET_PROJECT = gql`
  query GetProject($projectId: String!) {
    getProject(projectId: $projectId) {
      id
      isSyncedWithGitHub
      githubRepoUrl
    }
  }
`;

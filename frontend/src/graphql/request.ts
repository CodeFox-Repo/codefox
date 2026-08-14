import { ApolloClient, gql, TypedDocumentNode } from '@apollo/client';
import type { DocumentNode } from 'graphql';

export const REGISTRATION_OPEN = gql`
  query RegistrationOpen {
    registrationOpen
  }
`;

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
      # The share id, not projectPath: this query is public, and projectPath
      # is the directory name every authenticated file route keys on. Nothing
      # here used it.
      uniqueProjectId
      template
      userId
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
      steps {
        kind
        text
        tool
        file
      }
    }
  }
`;

// Deliberately no `messages`: this drives a list of titles, and pulling every
// message of every chat to render them grew the payload with the user's whole
// history.
export const GET_USER_CHATS = gql`
  query GetUserChats {
    getUserChats {
      id
      title
      createdAt
      project {
        id
        template
        isPublic
      }
    }
  }
`;

export const DUPLICATE_PROJECT = gql`
  mutation DuplicateProject($projectId: ID!) {
    duplicateProject(projectId: $projectId) {
      id
    }
  }
`;

export const UPDATE_CHAT_TITLE = gql`
  mutation UpdateChatTitle($input: UpdateChatTitleInput!) {
    updateChatTitle(updateChatTitleInput: $input) {
      id
      title
    }
  }
`;

export const CLEAR_CHAT_HISTORY = gql`
  mutation ClearChatHistory($chatId: String!) {
    clearChatHistory(chatId: $chatId)
  }
`;

export const DELETE_CHAT = gql`
  mutation DeleteChat($chatId: String!) {
    deleteChat(chatId: $chatId)
  }
`;

// Deleting the project is what reclaims the workspace and the cover image;
// deleteChat only hides one conversation and leaves the files behind.
export const DELETE_PROJECT = gql`
  mutation DeleteProject($projectId: String!) {
    deleteProject(projectId: $projectId)
  }
`;

export const GET_USER_INFO = gql`
  query me {
    me {
      id
      username
      email
      avatarUrl
      githubInstallationId
    }
  }
`;

/** Separate from `me` because it is guarded on its own; a field on User was
 *  reachable through any public query that returns a User. */
export const GET_MY_ROLES = gql`
  query MyRoles {
    myRoles
  }
`;

// Query to get user projects
export const GET_USER_PROJECTS = gql`
  query GetUserProjects {
    getUserProjects {
      id
      projectName
      projectPath
      template
      isPublic
      photoUrl
      subNumber
      userId
      forkedFromId
      isDeleted
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
export const DROP_LAST_ASSISTANT_REPLY = gql`
  mutation DropLastAssistantReply($chatId: String!) {
    dropLastAssistantReply(chatId: $chatId)
  }
`;

export const UPDATE_CHAT_MODEL = gql`
  mutation UpdateChatModel($chatId: String!, $model: String!) {
    updateChatModel(chatId: $chatId, model: $model) {
      id
      model
    }
  }
`;

export const GET_CHAT_DETAILS = gql`
  query GetChatDetails($chatId: String!) {
    getChatDetails(chatId: $chatId) {
      id
      title
      model
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
        template
        isPublic
        photoUrl
      }
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
      isPublic
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

// mutation to upload a user avatar
export const UPLOAD_AVATAR = gql`
  mutation UploadAvatar($file: Upload!) {
    uploadAvatar(file: $file) {
      success
      avatarUrl
    }
  }
`;

// sync project with github
export const GET_PROJECT = gql`
  query GetProject($projectId: String!) {
    getProject(projectId: $projectId) {
      id
      projectName
      isPublic
      # For the share link: /share/<uniqueProjectId>, pages only.
      uniqueProjectId
      template
      # The PDF route renders the project by its directory name.
      projectPath
    }
  }
`;

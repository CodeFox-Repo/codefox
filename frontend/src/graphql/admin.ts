import { gql } from '@apollo/client';

export const ADMIN_OVERVIEW = gql`
  query AdminOverview {
    adminOverview {
      counts {
        users
        projects
        chats
        deletedProjects
      }
      runtime {
        nodeEnv
        model
        provider
        sandbox
        registrationOpen
        uptime
      }
      disk {
        projectBytes
        projectDirs
        orphanDirs
      }
      previews {
        projectPath
        port
        pid
      }
    }
  }
`;

export const ADMIN_PROJECTS = gql`
  query AdminProjects {
    adminProjects {
      id
      projectName
      projectPath
      isPublic
      ownerEmail
      chats
      onDisk
      createdAt
    }
  }
`;

export const ADMIN_USERS = gql`
  query AdminUsers {
    adminUsers {
      id
      email
      username
      isActive
      roles
      projects
      chats
      createdAt
    }
  }
`;

export const ADMIN_DELETE_PROJECT = gql`
  mutation AdminDeleteProject($projectId: String!) {
    adminDeleteProject(projectId: $projectId)
  }
`;

export const ADMIN_SET_USER_ACTIVE = gql`
  mutation AdminSetUserActive($userId: String!, $isActive: Boolean!) {
    adminSetUserActive(userId: $userId, isActive: $isActive)
  }
`;

export const ADMIN_STOP_PREVIEW = gql`
  mutation AdminStopPreview($projectPath: String!) {
    adminStopPreview(projectPath: $projectPath)
  }
`;

export const ADMIN_SWEEP_ORPHANS = gql`
  mutation AdminSweepOrphans {
    adminSweepOrphans
  }
`;

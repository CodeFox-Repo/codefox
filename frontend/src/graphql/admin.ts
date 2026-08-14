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
  query AdminProjects($search: String, $offset: Int, $limit: Int) {
    adminProjects(search: $search, offset: $offset, limit: $limit) {
      total
      items {
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
  }
`;

export const ADMIN_USERS = gql`
  query AdminUsers($search: String, $offset: Int, $limit: Int) {
    adminUsers(search: $search, offset: $offset, limit: $limit) {
      total
      items {
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
  }
`;

export const ADMIN_ROLES = gql`
  query AdminRoles {
    adminRoles
  }
`;

export const ADMIN_DELETE_PROJECT = gql`
  mutation AdminDeleteProject($projectId: String!) {
    adminDeleteProject(projectId: $projectId)
  }
`;

export const ADMIN_SET_PROJECT_PUBLIC = gql`
  mutation AdminSetProjectPublic($projectId: String!, $isPublic: Boolean!) {
    adminSetProjectPublic(projectId: $projectId, isPublic: $isPublic)
  }
`;

export const ADMIN_SET_USER_ACTIVE = gql`
  mutation AdminSetUserActive($userId: String!, $isActive: Boolean!) {
    adminSetUserActive(userId: $userId, isActive: $isActive)
  }
`;

export const ADMIN_SET_USER_ROLE = gql`
  mutation AdminSetUserRole(
    $userId: String!
    $role: String!
    $granted: Boolean!
  ) {
    adminSetUserRole(userId: $userId, role: $role, granted: $granted)
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

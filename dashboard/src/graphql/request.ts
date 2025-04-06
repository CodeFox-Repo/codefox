import { ApolloClient, gql, TypedDocumentNode } from '@apollo/client';
export const LOGIN = gql`
  mutation Login($input: LoginUserInput!) {
    login(input: $input) {
      accessToken
      refreshToken
    }
  }
`;

export const CHECK_TOKEN_QUERY = gql`
  query CheckToken($input: CheckTokenInput!) {
    checkToken(input: $input)
  }
`;

export const GET_USER_INFO = gql`
  query Me {
    me {
      username
      email
      avatarUrl
    }
  }
`;

export const REFRESH_TOKEN_MUTATION = gql`
  mutation RefreshToken($refreshToken: String!) {
    refreshToken(refreshToken: $refreshToken) {
      accessToken
      refreshToken
    }
  }
`;

export const ROLES_QUERY = gql`
  query Roles {
    roles {
      id
      name
      description
      menus {
        id
        name
        path
        permission
      }
    }
  }
`;

export const ROLE_QUERY = gql`
  query Role($id: ID!) {
    role(id: $id) {
      id
      name
      description
      menus {
        id
        name
        path
        permission
      }
    }
  }
`;

export const CREATE_ROLE = gql`
  mutation CreateRole($createRoleInput: CreateRoleInput!) {
    createRole(createRoleInput: $createRoleInput) {
      id
      name
      description
      menus {
        id
        name
        path
        permission
      }
    }
  }
`;

export const UPDATE_ROLE = gql`
  mutation UpdateRole($updateRoleInput: UpdateRoleInput!) {
    updateRole(updateRoleInput: $updateRoleInput) {
      id
      name
      description
      menus {
        id
        name
        path
        permission
      }
    }
  }
`;

export const DELETE_ROLE = gql`
  mutation DeleteRole($id: ID!) {
    removeRole(id: $id)
  }
`;

export const MENUS_QUERY = gql`
  query Menus {
    menus {
      id
      name
      path
      permission
      description
      isActive
      createdAt
      roles {
        id
        name
      }
    }
  }
`;

export const MENU_QUERY = gql`
  query Menu($id: ID!) {
    menu(id: $id) {
      id
      name
      path
      permission
      roles {
        id
        name
      }
    }
  }
`;

export const CREATE_MENU = gql`
  mutation CreateMenu($createMenuInput: CreateMenuInput!) {
    createMenu(createMenuInput: $createMenuInput) {
      id
      name
      path
      permission
      roles {
        id
        name
      }
    }
  }
`;

export const UPDATE_MENU = gql`
  mutation UpdateMenu($updateMenuInput: UpdateMenuInput!) {
    updateMenu(updateMenuInput: $updateMenuInput) {
      id
      name
      path
      permission
      isActive
      roles {
        id
        name
      }
    }
  }
`;

export const DELETE_MENU = gql`
  mutation DeleteMenu($id: ID!) {
    removeMenu(id: $id)
  }
`;

export const GET_MENUS_BY_PERMISSION = gql`
  query MenusByPermission($permission: String!) {
    menusByPermission(permission: $permission) {
      id
      name
      path
      permission
      roles {
        id
        name
      }
    }
  }
`;

export const GET_DASHBOARD_USERS = gql`
  query DashboardUsers($filter: UserFilterInput) {
    dashboardUsers(filter: $filter) {
      id
      username
      email
      avatarUrl
      isActive
      createdAt
      roles {
        id
        name
      }
    }
  }
`;

export const GET_DASHBOARD_USER = gql`
  query DashboardUser($id: ID!) {
    dashboardUser(id: $id) {
      id
      username
      email
      avatarUrl
      isActive
      roles {
        id
        name
      }
    }
  }
`;

export const CREATE_DASHBOARD_USER = gql`
  mutation CreateDashboardUser($input: CreateUserInput!) {
    createDashboardUser(input: $input) {
      id
      username
      email
    }
  }
`;

export const UPDATE_DASHBOARD_USER = gql`
  mutation UpdateDashboardUser($id: ID!, $input: UpdateUserInput!) {
    updateDashboardUser(id: $id, input: $input) {
      id
      username
      email
    }
  }
`;

export const DELETE_DASHBOARD_USER = gql`
  mutation DeleteDashboardUser($id: ID!) {
    deleteDashboardUser(id: $id)
  }
`;
export const GET_DASHBOARD_ROLES = gql`
  query DashboardRoles {
    dashboardRoles {
      id
      name
      menus {
        id
        name
      }
      users {
        id
        username
      }
      isActive
      createdAt
      updatedAt
    }
  }
`;

export const GET_DASHBOARD_ROLE = gql`
  query DashboardRole($id: ID!) {
    dashboardRole(id: $id) {
      id
      name
      menus {
        id
        name
      }
      users {
        id
        username
      }
    }
  }
`;

export const CREATE_DASHBOARD_ROLE = gql`
  mutation CreateDashboardRole($input: CreateRoleInput!) {
    createDashboardRole(input: $input) {
      id
      name
    }
  }
`;

export const UPDATE_DASHBOARD_ROLE = gql`
  mutation UpdateDashboardRole($id: ID!, $input: UpdateRoleInput!) {
    updateDashboardRole(id: $id, input: $input) {
      id
      name
    }
  }
`;

export const DELETE_DASHBOARD_ROLE = gql`
  mutation DeleteDashboardRole($id: ID!) {
    deleteDashboardRole(id: $id)
  }
`;
export const GET_DASHBOARD_CHATS = gql`
  query DashboardChats($filter: ChatFilterInput) {
    dashboardChats(filter: $filter) {
      id
      title
      isActive
      user {
        id
        username
      }
      project {
        id
        projectName
      }
    }
  }
`;

export const GET_DASHBOARD_CHAT = gql`
  query DashboardChat($id: ID!) {
    dashboardChat(id: $id) {
      id
      title
      isActive
      user {
        id
        username
      }
      project {
        id
        projectName
      }
    }
  }
`;

export const CREATE_DASHBOARD_CHAT = gql`
  mutation CreateDashboardChat($input: CreateChatInput!) {
    createDashboardChat(input: $input) {
      id
      title
    }
  }
`;

export const UPDATE_DASHBOARD_CHAT = gql`
  mutation UpdateDashboardChat($id: ID!, $input: UpdateChatInput!) {
    updateDashboardChat(id: $id, input: $input) {
      id
      title
    }
  }
`;

export const DELETE_DASHBOARD_CHAT = gql`
  mutation DeleteDashboardChat($id: ID!) {
    deleteDashboardChat(id: $id)
  }
`;
export const GET_DASHBOARD_PROJECTS = gql`
  query DashboardProjects($filter: ProjectFilterInput) {
    dashboardProjects(filter: $filter) {
      id
      projectName
      isActive
      isPublic
      createdAt
      user {
        id
        username
      }
      projectPackages {
        id
        name
      }
    }
  }
`;

export const GET_DASHBOARD_PROJECT = gql`
  query DashboardProject($id: ID!) {
    dashboardProject(id: $id) {
      id
      projectName
      description
      user {
        id
        username
      }
      projectPackages {
        id
        name
      }
    }
  }
`;

export const CREATE_DASHBOARD_PROJECT = gql`
  mutation CreateDashboardProject($input: DashboardCreateProjectInput!) {
    createDashboardProject(input: $input) {
      id
      projectName
    }
  }
`;

export const UPDATE_DASHBOARD_PROJECT = gql`
  mutation UpdateDashboardProject($id: ID!, $input: UpdateProjectInput!) {
    updateDashboardProject(id: $id, input: $input) {
      id
      projectName
    }
  }
`;

export const DELETE_DASHBOARD_PROJECT = gql`
  mutation DeleteDashboardProject($id: ID!) {
    deleteDashboardProject(id: $id)
  }
`;
export const GET_DASHBOARD_STATS = gql`
  query DashboardStats {
    dashboardStats {
      totalUsers
      totalChats
      totalProjects
      totalRoles
      totalMenus
      activeUsers
      activeProjects
      activeChats
    }
  }
`;

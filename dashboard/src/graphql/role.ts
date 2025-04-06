import { gql } from '@apollo/client';

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

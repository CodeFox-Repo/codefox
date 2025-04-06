import { gql } from '@apollo/client';

export const MENUS_QUERY = gql`
  query Menus {
    menus {
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

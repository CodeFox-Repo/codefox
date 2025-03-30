import { ApolloClient, gql, TypedDocumentNode } from '@apollo/client';
export const ADMIN_LOGIN = gql`
  mutation AdminLogin($input: LoginUserInput!) {
    adminLogin(input: $input) {
      accessToken
      refreshToken
    }
  }
`;

export const CHECK_TOKEN_QUERY = gql`
  query CheckToken($input: TokenInput!) {
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

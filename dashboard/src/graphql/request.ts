import { ApolloClient, gql, TypedDocumentNode } from '@apollo/client';
export const ADMIN_LOGIN = gql`
  mutation AdminLogin($input: LoginUserInput!) {
    adminLogin(input: $input) {
      accessToken
      refreshToken
    }
  }
`;

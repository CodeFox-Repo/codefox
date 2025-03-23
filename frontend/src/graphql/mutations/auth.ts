import { gql } from '@apollo/client';

export const REGISTER_USER = gql`
  mutation RegisterUser($input: RegisterUserInput!) {
    registerUser(input: $input) {
      id
      email
      username
    }
  }
`;

export const LOGIN_USER = gql`
  mutation Login($input: LoginUserInput!) {
    login(input: $input) {
      accessToken
      refreshToken
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

export const CONFIRM_EMAIL_MUTATION = gql`
  mutation ConfirmEmail($token: String!) {
    confirmEmail(token: $token) {
      message
      success
    }
  }
`;

export const RESEND_CONFIRMATION_EMAIL_MUTATION = gql`
  mutation ResendConfirmationEmail($input: ResendEmailInput!) {
    resendConfirmationEmail(input: $input) {
      message
      success
    }
  }
`;

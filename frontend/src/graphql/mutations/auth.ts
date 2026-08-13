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

// A query, not a mutation — that is how the backend declares it. It retires
// the bearer token server-side, so it has to run before storage is cleared.
export const LOGOUT = gql`
  query Logout {
    logout
  }
`;

export const EMAIL_VERIFICATION_REQUIRED = gql`
  query EmailVerificationRequired {
    emailVerificationRequired
  }
`;

export const GOOGLE_AUTH_AVAILABLE = gql`
  query GoogleAuthAvailable {
    googleAuthAvailable
  }
`;

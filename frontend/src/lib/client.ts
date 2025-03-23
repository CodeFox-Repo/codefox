'use client';

import {
  ApolloClient,
  InMemoryCache,
  ApolloLink,
  from,
  split,
  Observable,
  FetchResult,
} from '@apollo/client';
import { onError } from '@apollo/client/link/error';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import { getMainDefinition } from '@apollo/client/utilities';
import createUploadLink from 'apollo-upload-client/createUploadLink.mjs';
import { LocalStore } from '@/lib/storage';
import { logger } from '@/app/log/logger';
import { REFRESH_TOKEN_MUTATION } from '@/graphql/mutations/auth';

// Create the upload link as the terminating link
const uploadLink = createUploadLink({
  uri: process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:8080/graphql',
  headers: {
    'Apollo-Require-Preflight': 'true',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Origin': '*',
  },
});

// WebSocket Link (only in browser environment)
let wsLink: GraphQLWsLink | undefined;
if (typeof window !== 'undefined') {
  wsLink = new GraphQLWsLink(
    createClient({
      url:
        process.env.NEXT_PUBLIC_GRAPHQL_WS_URL || 'ws://localhost:8080/graphql',
      connectionParams: () => {
        const token = localStorage.getItem(LocalStore.accessToken);
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
    })
  );
}

// Logging Middleware
const requestLoggingMiddleware = new ApolloLink((operation, forward) => {
  const context = operation.getContext();
  logger.info('GraphQL Request:', {
    operationName: operation.operationName,
    variables: operation.variables,
    query: operation.query.loc?.source.body,
    headers: context.headers,
  });
  return forward(operation).map((response) => {
    logger.info('GraphQL Response:', response.data);
    return response;
  });
});

// Auth Middleware
const authMiddleware = new ApolloLink((operation, forward) => {
  if (typeof window === 'undefined') {
    return forward(operation);
  }
  const token = localStorage.getItem(LocalStore.accessToken);
  if (token) {
    operation.setContext(({ headers = {} }) => ({
      headers: {
        ...headers,
        Authorization: `Bearer ${token}`,
      },
    }));
  }
  return forward(operation);
});

// Refresh Token Handling
const refreshToken = async (): Promise<string | null> => {
  try {
    const refreshToken = localStorage.getItem(LocalStore.refreshToken);
    if (!refreshToken) {
      return null;
    }

    console.debug('start refreshToken mutate');

    // Use the main client for the refresh token request
    // The tokenRefreshLink will skip refresh attempts for this operation
    const result = await client.mutate({
      mutation: REFRESH_TOKEN_MUTATION,
      variables: { refreshToken },
    });

    if (result.data?.refreshToken?.accessToken) {
      const newAccessToken = result.data.refreshToken.accessToken;
      const newRefreshToken =
        result.data.refreshToken.refreshToken || refreshToken;

      localStorage.setItem(LocalStore.accessToken, newAccessToken);
      localStorage.setItem(LocalStore.refreshToken, newRefreshToken);

      logger.info('Token refreshed successfully');
      return newAccessToken;
    }

    return null;
  } catch (error) {
    logger.error('Error refreshing token:', error);
    return null;
  }
};

// Handle token expiration and refresh
const tokenRefreshLink = onError(
  ({ graphQLErrors, networkError, operation, forward }) => {
    if (graphQLErrors) {
      for (const err of graphQLErrors) {
        // Check for auth errors (adjust this check based on your API's error structure)
        const isAuthError =
          err.extensions?.code === 'UNAUTHENTICATED' ||
          err.message.includes('Unauthorized') ||
          err.message.includes('token expired');

        // Don't try to refresh if this operation is the refresh token mutation
        // This prevents infinite refresh loops
        const operationName = operation.operationName;
        const path = err.path;
        const isRefreshTokenOperation =
          operationName === 'RefreshToken' ||
          (path && path.includes('refreshToken'));

        if (isAuthError && !isRefreshTokenOperation) {
          logger.info('Auth error detected, attempting token refresh');

          // Return a new observable to handle the token refresh
          return new Observable<FetchResult>((observer) => {
            // Attempt to refresh the token
            (async () => {
              try {
                const newToken = await refreshToken();

                if (!newToken) {
                  // If refresh fails, clear tokens and redirect
                  localStorage.removeItem(LocalStore.accessToken);
                  localStorage.removeItem(LocalStore.refreshToken);

                  // Redirect to home/login page when running in browser
                  if (typeof window !== 'undefined') {
                    logger.warn(
                      'Token refresh failed, redirecting to home page'
                    );
                    window.location.href = '/';
                  }

                  // Complete the observer with the original error
                  observer.error(err);
                  observer.complete();
                  return;
                }

                // Retry the operation with the new token
                // Clone the operation with the new token
                const oldHeaders = operation.getContext().headers;
                operation.setContext({
                  headers: {
                    ...oldHeaders,
                    Authorization: `Bearer ${newToken}`,
                  },
                });

                // Retry the request
                forward(operation).subscribe({
                  next: observer.next.bind(observer),
                  error: observer.error.bind(observer),
                  complete: observer.complete.bind(observer),
                });
              } catch (error) {
                logger.error('Error in token refresh flow:', error);
                observer.error(error);
                observer.complete();
              }
            })();
          });
        }
      }
    }

    if (networkError) {
      logger.error(`[Network error]: ${networkError}`);

      // For network errors related to authentication endpoints, handle logout
      const networkErrorOperation = operation.operationName;
      if (
        networkErrorOperation === 'RefreshToken' ||
        networkErrorOperation === 'Login' ||
        networkErrorOperation === 'ValidateToken'
      ) {
        // Only redirect for auth-related network errors
        if (typeof window !== 'undefined') {
          localStorage.removeItem(LocalStore.accessToken);
          localStorage.removeItem(LocalStore.refreshToken);

          logger.warn(
            'Network error during authentication, redirecting to home'
          );
          window.location.href = '/';
        }
      }
    }
  }
);

// Error Link
const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path }) => {
      logger.error(
        `[GraphQL error]: Message: ${message}, Location: ${JSON.stringify(locations)}, Path: ${path}`
      );
    });
  }
  if (networkError) {
    logger.error(`[Network error]: ${networkError}`);
  }
});

// Build the HTTP link chain
const httpLinkWithMiddleware = from([
  tokenRefreshLink, // Add token refresh link first
  errorLink,
  requestLoggingMiddleware,
  authMiddleware,
  uploadLink as unknown as ApolloLink, // Cast to ApolloLink to satisfy TypeScript
]);

// Split traffic between WebSocket and HTTP
const splitLink = wsLink
  ? split(
      ({ query }) => {
        const definition = getMainDefinition(query);
        return (
          definition.kind === 'OperationDefinition' &&
          definition.operation === 'subscription'
        );
      },
      wsLink,
      httpLinkWithMiddleware
    )
  : httpLinkWithMiddleware;

// Create Apollo Client
export const client = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: { fetchPolicy: 'no-cache' },
    query: { fetchPolicy: 'no-cache' },
  },
});

export default client;

'use client';

import {
  ApolloClient,
  InMemoryCache,
  ApolloLink,
  from,
  split,
  Operation,
} from '@apollo/client';
import { onError } from '@apollo/client/link/error';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import { getMainDefinition, Observable } from '@apollo/client/utilities';
import createUploadLink from 'apollo-upload-client/createUploadLink.mjs';
import { LocalStore } from '@/lib/storage';
import { logger } from '@/app/log/logger';

// Token refresh state management 
let isRefreshing = false;
let pendingRequests: Array<{
  operation: Operation;
  forward: any;
  observer: any;
}> = [];

// Function to refresh token - will be set by AuthProvider
let refreshTokenFunction: () => Promise<string | boolean | void>;
let logoutFunction: () => void;

// Function to register the token refresh function
export const registerRefreshTokenFunction = (
  refreshFn: () => Promise<string | boolean | void>,
  logout: () => void
) => {
  refreshTokenFunction = refreshFn;
  logoutFunction = logout;
};


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

// Function to retry failed operations with new token
const retryFailedOperations = () => {
  const requests = [...pendingRequests];
  pendingRequests = [];
  
  requests.forEach(({ operation, forward, observer }) => {
    // Update the authorization header with the new token
    const token = localStorage.getItem(LocalStore.accessToken);
    if (token) {
      operation.setContext(({ headers = {} }) => ({
        headers: {
          ...headers,
          Authorization: `Bearer ${token}`,
        },
      }));
    }
    
    // Retry the operation
    forward(operation).subscribe({
      next: observer.next.bind(observer),
      error: observer.error.bind(observer),
      complete: observer.complete.bind(observer),
    });
  });
};

// Error Link
// Error Link with Token Refresh Logic
const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
  const isAuthError = graphQLErrors?.some(error => 
    error.extensions?.code === 'UNAUTHENTICATED' || 
    error.message.includes('not authenticated') ||
    error.message.includes('jwt expired')
  ) || networkError?.name === 'ServerError' && (networkError as any).statusCode === 401;

  if (isAuthError) {
    // Check if we have a refresh token
    const hasRefreshToken = !!localStorage.getItem(LocalStore.refreshToken);
    
    if (!hasRefreshToken || !refreshTokenFunction) {
      // No refresh token or refresh function - logout
      if (logoutFunction) {
        logoutFunction();
      }
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
      return;
    }

    // Return a new observable to handle the retry logic
    return new Observable(observer => {
      // If we're already refreshing, queue this request
      if (isRefreshing) {
        pendingRequests.push({ operation, forward, observer });
      } else {
        isRefreshing = true;
        
        // Try to refresh the token
        refreshTokenFunction()
          .then(success => {
            isRefreshing = false;
            
            if (success) {
              // Retry this operation
              const token = localStorage.getItem(LocalStore.accessToken);
              if (token) {
                operation.setContext(({ headers = {} }) => ({
                  headers: {
                    ...headers,
                    Authorization: `Bearer ${token}`,
                  },
                }));
              }
              
              // Retry all pending operations
              retryFailedOperations();
              
              // Retry the current operation
              forward(operation).subscribe({
                next: observer.next.bind(observer),
                error: observer.error.bind(observer),
                complete: observer.complete.bind(observer),
              });
            } else {
              // Refresh failed - redirect to homepage
              if (logoutFunction) {
                logoutFunction();
              }
              if (typeof window !== 'undefined') {
                window.location.href = '/';
              }
              
              // Complete the operation
              observer.error(new Error('Session expired. Please log in again.'));
            }
          })
          .catch(error => {
            isRefreshing = false;
            logger.error('Token refresh failed:', error);
            
            // Refresh failed - redirect to homepage
            if (logoutFunction) {
              logoutFunction();
            }
            if (typeof window !== 'undefined') {
              window.location.href = '/';
            }
            
            // Complete the operation
            observer.error(new Error('Session expired. Please log in again.'));
          });
      }
    });
  }

  // Handle other errors
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

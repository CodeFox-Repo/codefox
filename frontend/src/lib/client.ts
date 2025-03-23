'use client';

import {
  ApolloClient,
  InMemoryCache,
  ApolloLink,
  from,
  split,
} from '@apollo/client';
import { onError } from '@apollo/client/link/error';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import { getMainDefinition } from '@apollo/client/utilities';
import createUploadLink from 'apollo-upload-client/createUploadLink.mjs';
import { LocalStore } from '@/lib/storage';
import { logger } from '@/app/log/logger';

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

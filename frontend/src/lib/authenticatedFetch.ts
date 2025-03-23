import { LocalStore } from '@/lib/storage';
import { client } from '@/lib/client';
import { REFRESH_TOKEN_MUTATION } from '@/graphql/mutations/auth';
import { gql } from '@apollo/client';

// Prevent multiple simultaneous refresh attempts
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

/**
 * Refreshes the access token using the refresh token
 * @returns Promise that resolves to the new token or null if refresh failed
 */
export const refreshAccessToken = async (): Promise<string | null> => {
  // If a refresh is already in progress, return that promise
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const refreshToken = localStorage.getItem(LocalStore.refreshToken);
      if (!refreshToken) {
        return null;
      }

      // Use Apollo client to refresh the token
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

        console.log('Token refreshed successfully');
        return newAccessToken;
      }

      return null;
    } catch (error) {
      console.error('Error refreshing token:', error);
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

/**
 * Fetch wrapper that handles authentication and token refresh
 * @param url The URL to fetch
 * @param options Fetch options
 * @param retryOnAuth Whether to retry on 401 errors (default: true)
 * @returns Response from the fetch request
 */
export const authenticatedFetch = async (
  url: string,
  options: RequestInit = {},
  retryOnAuth: boolean = true
): Promise<Response> => {
  // Get current token
  const token = localStorage.getItem(LocalStore.accessToken);

  // Setup headers with authentication
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Make the request
  const response = await fetch(url, {
    ...options,
    headers,
  });

  // If we get a 401 and we should retry, attempt to refresh the token
  if (response.status === 401 && retryOnAuth) {
    const newToken = await refreshAccessToken();

    if (newToken) {
      // Update the authorization header with the new token
      headers.set('Authorization', `Bearer ${newToken}`);

      // Retry the request with the new token
      return fetch(url, {
        ...options,
        headers,
      });
    } else {
      // If refresh failed, redirect to home/login
      if (typeof window !== 'undefined') {
        localStorage.removeItem(LocalStore.accessToken);
        localStorage.removeItem(LocalStore.refreshToken);
        window.location.href = '/';
      }
    }
  }

  return response;
};

/**
 * Processes a streaming response from a server-sent events endpoint
 * @param response Fetch Response object (must be a streaming response)
 * @param onChunk Optional callback to process each chunk as it arrives
 * @returns Promise with the full aggregated content
 */
export const processStreamResponse = async (
  response: Response,
  onChunk?: (chunk: string) => void
): Promise<string> => {
  if (!response.body) {
    throw new Error('Response has no body');
  }

  const reader = response.body.getReader();
  let fullContent = '';
  let isStreamDone = false;

  try {
    // More explicit condition than while(true)
    while (!isStreamDone) {
      const { done, value } = await reader.read();

      if (done) {
        isStreamDone = true;
        continue;
      }

      const text = new TextDecoder().decode(value);
      const lines = text.split('\n\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();

          // Additional exit condition
          if (data === '[DONE]') {
            isStreamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              fullContent += parsed.content;
              if (onChunk) {
                onChunk(parsed.content);
              }
            }
          } catch (e) {
            console.error('Error parsing SSE data:', e);
          }
        }
      }
    }

    return fullContent;
  } catch (error) {
    console.error('Error reading stream:', error);
    throw error;
  } finally {
    // Ensure we clean up the reader if we exit due to an error
    if (!isStreamDone) {
      reader
        .cancel()
        .catch((e) => console.error('Error cancelling reader:', e));
    }
  }
};

export default authenticatedFetch;

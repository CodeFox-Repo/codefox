'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { useLazyQuery, useMutation } from '@apollo/client';
import { CHECK_TOKEN_QUERY, GET_USER_INFO } from '@/graphql/request';
import { LOGOUT, REFRESH_TOKEN_MUTATION } from '@/graphql/mutations/auth';
import { LocalStore } from '@/lib/storage';
import { LoadingPage } from '@/components/global-loading';
import { User } from '@/graphql/type';
import { logger } from '@/app/log/logger';
import { useRouter } from 'next/navigation';

interface AuthContextValue {
  isAuthorized: boolean;
  isLoading: boolean;
  token: string | null;
  user: User | null;
  /** Gates the console link only. The API is role-gated on its own. */
  isAdmin: boolean;
  login: (accessToken: string, refreshToken: string) => void;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<string | boolean | void>;
  validateToken: () => Promise<boolean>;
  refreshUserInfo: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue>({
  isAuthorized: false,
  isLoading: false,
  token: null,
  user: null,
  isAdmin: false,
  login: () => {},
  logout: async () => {},
  refreshAccessToken: async () => {},
  validateToken: async () => false,
  refreshUserInfo: async () => false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  const [checkToken] = useLazyQuery<{ checkToken: boolean }>(CHECK_TOKEN_QUERY);
  const [refreshTokenMutation] = useMutation(REFRESH_TOKEN_MUTATION);
  const [getUserInfo] = useLazyQuery<{ me: User }>(GET_USER_INFO);
  // no-cache: a cached `true` would skip the network on the second logout of a
  // session and leave that token live.
  const [logoutQuery] = useLazyQuery<{ logout: boolean }>(LOGOUT, {
    fetchPolicy: 'no-cache',
  });

  const validateToken = useCallback(async () => {
    const storedToken = localStorage.getItem(LocalStore.accessToken);
    if (!storedToken) {
      setIsAuthorized(false);
      setUser(null);
      return false;
    }
    try {
      const { data } = await checkToken({
        variables: { input: { token: storedToken } },
      });
      if (data?.checkToken) {
        setToken(storedToken);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Token validation error:', error);
      return false;
    }
  }, [checkToken]);

  const fetchUserInfo = useCallback(async () => {
    try {
      const { data } = await getUserInfo();
      if (data?.me) {
        setUser(data.me);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Failed to fetch user info:', error);
      return false;
    }
  }, [getUserInfo]);

  const refreshUserInfo = useCallback(async () => {
    return await fetchUserInfo();
  }, [fetchUserInfo]);

  // Above refreshAccessToken because that awaits it: declared after, it was
  // captured stale and its network round trip ran unawaited, so the caller
  // returned "signed out" while the tokens were still in storage.
  const logout = useCallback(async () => {
    // Server first, while the token is still in storage for authMiddleware to
    // attach — clearing it first left the session alive on the backend, so a
    // copied token kept working after "log out". Best effort: a failed or
    // already-dead token must not strand the user in a signed-in shell.
    try {
      await logoutQuery();
    } catch (error) {
      logger.error('Logout request failed:', error);
    }

    setToken(null);
    setIsAuthorized(false);
    setUser(null);
    localStorage.removeItem(LocalStore.accessToken);
    localStorage.removeItem(LocalStore.refreshToken);

    // Redirect to home page after logout
    if (typeof window !== 'undefined') {
      router.push('/');
    }
  }, [router, logoutQuery]);

  const refreshAccessToken = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem(LocalStore.refreshToken);
      if (!refreshToken) {
        await logout();
        return false;
      }
      const { data } = await refreshTokenMutation({
        variables: { refreshToken },
      });
      if (data?.refreshToken) {
        const newAccess = data.refreshToken.accessToken;
        const newRefresh = data.refreshToken.refreshToken;

        localStorage.setItem(LocalStore.accessToken, newAccess);
        if (newRefresh) {
          localStorage.setItem(LocalStore.refreshToken, newRefresh);
        }
        setToken(newAccess);
        setIsAuthorized(true);
        return newAccess;
      } else {
        await logout();
        return false;
      }
    } catch (error) {
      logger.error('Refresh token error:', error);
      await logout();
      return false;
    }
  }, [refreshTokenMutation, logout]);

  const login = useCallback(
    (accessToken: string, refreshToken: string) => {
      localStorage.setItem(LocalStore.accessToken, accessToken);
      localStorage.setItem(LocalStore.refreshToken, refreshToken);

      setToken(accessToken);
      if (process.env.NODE_ENV !== 'production') {
        logger.info('Token saved successfully');
      }
      setIsAuthorized(true);
      fetchUserInfo();
    },
    [fetchUserInfo]
  );

  useEffect(() => {
    async function initAuth() {
      setIsLoading(true);

      const storedToken = localStorage.getItem(LocalStore.accessToken);
      if (!storedToken) {
        logger.info('No stored token found, skip checkToken');
        setIsAuthorized(false);
        setUser(null);
        setIsLoading(false);
        return;
      }

      let isValid = await validateToken();

      // If validation fails, try to refresh
      if (!isValid) {
        isValid = (await refreshAccessToken()) ? true : false;
      }

      // Final decision
      if (isValid) {
        setIsAuthorized(true);
        await fetchUserInfo();
      } else {
        setIsAuthorized(false);
        setUser(null);
      }

      setIsLoading(false);
    }

    initAuth();
  }, [validateToken, refreshAccessToken, fetchUserInfo]);

  if (isLoading) {
    return <LoadingPage />;
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthorized,
        isLoading,
        token,
        user,
        // 'Admin' is the seeded name — DefaultRoles.ADMIN, backend/src/common/enums/role.enum.ts.
        isAdmin: !!user?.roles?.includes('Admin'),
        login,
        logout,
        refreshAccessToken,
        validateToken,
        refreshUserInfo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  return useContext(AuthContext);
}

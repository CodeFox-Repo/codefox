import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback
} from 'react';
import { useLazyQuery, useMutation, gql } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import {
  CHECK_TOKEN_QUERY,
  GET_USER_INFO,
  REFRESH_TOKEN_MUTATION
} from 'src/graphql/request';

interface User {
  email: string;
  username: string;
  avatarUrl: string;
}

interface AuthContextValue {
  isAuthorized: boolean;
  isLoading: boolean;
  token: string | null;
  user: User | null;
  login: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
  refreshUserInfo: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue>({
  isAuthorized: false,
  isLoading: false,
  token: null,
  user: null,
  login: () => {},
  logout: () => {},
  refreshUserInfo: async () => false
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();

  const [checkToken] = useLazyQuery<{ checkToken: boolean }>(CHECK_TOKEN_QUERY);
  const [refreshTokenMutation] = useMutation(REFRESH_TOKEN_MUTATION);
  const [getUserInfo] = useLazyQuery<{ me: User }>(GET_USER_INFO);

  const fetchUserInfo = useCallback(async () => {
    try {
      const { data } = await getUserInfo();
      if (data?.me) {
        setUser(data.me);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to fetch user info:', error);
      return false;
    }
  }, [getUserInfo]);

  const refreshUserInfo = useCallback(async () => {
    return fetchUserInfo();
  }, [fetchUserInfo]);

  const validateToken = useCallback(async () => {
    const storedToken = localStorage.getItem('accessToken');
    if (!storedToken) {
      setIsAuthorized(false);
      setUser(null);
      return false;
    }

    try {
      const { data } = await checkToken({
        variables: { input: { token: storedToken } }
      });
      if (data?.checkToken) {
        setToken(storedToken);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Token validation error:', error);
      return false;
    }
  }, [checkToken]);

  const refreshAccessToken = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        logout();
        return false;
      }

      const { data } = await refreshTokenMutation({
        variables: { refreshToken }
      });

      if (data?.refreshToken) {
        const newAccess = data.refreshToken.accessToken;
        const newRefresh = data.refreshToken.refreshToken;

        localStorage.setItem('accessToken', newAccess);
        if (newRefresh) {
          localStorage.setItem('refreshToken', newRefresh);
        }
        setToken(newAccess);
        setIsAuthorized(true);
        return true;
      } else {
        logout();
        return false;
      }
    } catch (error) {
      console.error('Refresh token error:', error);
      logout();
      return false;
    }
  }, [refreshTokenMutation]);

  const login = useCallback(
    (accessToken: string, refreshToken: string) => {
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      setToken(accessToken);
      setIsAuthorized(true);
      fetchUserInfo();
      navigate('/dashboards/crypto');
    },
    [fetchUserInfo, navigate]
  );

  const logout = useCallback(() => {
    setToken(null);
    setIsAuthorized(false);
    setUser(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    navigate('/');
  }, [navigate]);

  useEffect(() => {
    async function initAuth() {
      setIsLoading(true);

      const storedToken = localStorage.getItem('accessToken');
      if (!storedToken) {
        setIsAuthorized(false);
        setUser(null);
        setIsLoading(false);
        navigate('/');
        return;
      }

      let isValid = await validateToken();

      if (!isValid) {
        isValid = await refreshAccessToken();
      }

      if (isValid) {
        setIsAuthorized(true);
        await fetchUserInfo();
      } else {
        setIsAuthorized(false);
        setUser(null);
        navigate('/');
      }

      setIsLoading(false);
    }

    initAuth();
  }, [validateToken, refreshAccessToken, fetchUserInfo, navigate]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthorized,
        isLoading,
        token,
        user,
        login,
        logout,
        refreshUserInfo
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

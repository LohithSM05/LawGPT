import { createContext, useState, useEffect, useCallback } from 'react';
import authService from '../services/authService';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // true while we try to resume a session
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    authService
      .resumeSession()
      .then(({ user }) => {
        if (!cancelled) setUser(user);
      })
      .catch(() => {
        // No valid refresh cookie — that's a normal "logged out" state, not an error.
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (credentials) => {
    setAuthError(null);
    const loggedInUser = await authService.login(credentials);
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  const register = useCallback(async (payload) => {
    setAuthError(null);
    const newUser = await authService.register(payload);
    setUser(newUser);
    return newUser;
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  const refreshCurrentUser = useCallback(async () => {
    const freshUser = await authService.fetchCurrentUser();
    setUser(freshUser);
    return freshUser;
  }, []);

  const value = {
    user,
    setUser,
    isAuthenticated: Boolean(user),
    isLoading,
    authError,
    setAuthError,
    login,
    register,
    logout,
    refreshCurrentUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

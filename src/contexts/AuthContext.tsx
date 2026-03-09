"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getCurrentUser, signIn, signOut, signUp } from "aws-amplify/auth";
import { fetchAuthSession } from "aws-amplify/auth";
import { configureAmplify, isAuthConfigured } from "@/lib/amplify-config";
import { MESSAGES } from "@/lib/constants";

const MOCK_USER_ID = "dev-user-1";

type AuthState = {
  user: { userId: string; email?: string } | null;
  isLoading: boolean;
  isAuthenticated: boolean;
};

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  getToken: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  useEffect(() => {
    configureAmplify();
  }, []);

  const checkAuth = useCallback(async () => {
    if (!isAuthConfigured()) {
      setState({
        user: { userId: MOCK_USER_ID },
        isLoading: false,
        isAuthenticated: true,
      });
      return;
    }
    try {
      const user = await getCurrentUser();
      const { userId } = user;
      setState({
        user: { userId },
        isLoading: false,
        isAuthenticated: true,
      });
    } catch {
      setState({ user: null, isLoading: false, isAuthenticated: false });
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(
    async (email: string, password: string) => {
      if (!isAuthConfigured()) {
        throw new Error(MESSAGES.auth.notConfigured);
      }
      await signIn({ username: email, password });
      await checkAuth();
    },
    [checkAuth]
  );

  const logout = useCallback(async () => {
    try {
      await signOut();
    } finally {
      setState({ user: null, isLoading: false, isAuthenticated: false });
    }
  }, []);

  const register = useCallback(
    async (email: string, password: string) => {
      if (!isAuthConfigured()) {
        throw new Error(MESSAGES.auth.notConfigured);
      }
      await signUp({ username: email, password, options: { userAttributes: { email } } });
      await checkAuth();
    },
    [checkAuth]
  );

  const getToken = useCallback(async () => {
    try {
      const session = await fetchAuthSession();
      return session.tokens?.idToken?.toString() ?? null;
    } catch {
      return null;
    }
  }, []);

  const value: AuthContextValue = {
    ...state,
    login,
    logout,
    register,
    getToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

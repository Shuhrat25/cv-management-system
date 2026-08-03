import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest } from '../services/api';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'CANDIDATE' | 'RECRUITER' | 'ADMIN';
  location?: string;
  avatarUrl?: string;
  isBlocked?: boolean;
  version?: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  demoUsers: User[];
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; name: string; role: string; location?: string }) => Promise<void>;
  switchDemoUser: (userId: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [demoUsers, setDemoUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDemoUsers = async () => {
    try {
      const users = await apiRequest<User[]>('/auth/demo-users');
      setDemoUsers(users);
    } catch (e) {
      console.error('Failed to fetch demo users', e);
    }
  };

  const refreshUser = async () => {
    if (!localStorage.getItem('token')) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const u = await apiRequest<User>('/auth/me');
      setUser(u);
    } catch (e) {
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDemoUsers();
    refreshUser();
  }, []);

  const login = async (email: string, password: string) => {
    const data = await apiRequest<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const register = async (formData: { email: string; password: string; name: string; role: string; location?: string }) => {
    const data = await apiRequest<{ token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(formData),
    });
    localStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const switchDemoUser = async (userId: string) => {
    const data = await apiRequest<{ token: string; user: User }>('/auth/switch-demo', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
    localStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, demoUsers, loading, login, register, switchDemoUser, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

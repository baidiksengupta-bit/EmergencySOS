import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile } from '../types';
import {
  apiService,
  setAuthToken,
  AuthRegisterPayload,
  AuthLoginPayload,
} from '../services/api';

export interface AuthErrorDetails {
  message: string;
  isNetworkError?: boolean;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isDemoMode: boolean;
  authError: string | null;
  login: (emailOrPhone: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  register: (payload: {
    full_name: string;
    phone_number: string;
    email: string;
    password: string;
    blood_group?: string;
    allergies?: string;
    medical_notes?: string;
    emergency_pin?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  continueInDemoMode: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updated: Partial<UserProfile>) => Promise<void>;
  clearAuthError: () => void;
}

const STORAGE_KEY = '@emergency_sos_user_session';
const TOKEN_KEY = '@emergency_sos_auth_token';

const DEMO_USER: UserProfile = {
  id: 1,
  full_name: 'Alex Morgan',
  phone_number: '+1 (555) 019-2834',
  email: 'alex.morgan@emergencysos.org',
  blood_group: 'O+',
  allergies: 'Penicillin, Peanuts',
  medical_notes: 'Asthmatic - Carries inhaler in backpack',
  emergency_pin: '1234',
  countdown_seconds: 5,
  sound_alarm_enabled: true,
  vibrate_enabled: true,
  sms_fallback_enabled: true,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    // Check local storage for persistent session and token
    const loadSession = async () => {
      try {
        const storedToken = await AsyncStorage.getItem(TOKEN_KEY);
        const storedUser = await AsyncStorage.getItem(STORAGE_KEY);

        if (storedToken && storedUser) {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          setToken(storedToken);
          setAuthToken(storedToken);
          setIsDemoMode(false);
        } else if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          setIsDemoMode(true);
        } else {
          // Pre-populate with demo user so initial testing is instantaneous
          setUser(DEMO_USER);
          setIsDemoMode(true);
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(DEMO_USER));
        }
      } catch (err) {
        console.warn('Failed to load session, defaulting to demo user', err);
        setUser(DEMO_USER);
        setIsDemoMode(true);
      } finally {
        setIsLoading(false);
      }
    };
    loadSession();
  }, []);

  const login = async (
    emailOrPhone: string,
    pass: string
  ): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    setAuthError(null);

    try {
      // 1. Attempt login against FastAPI backend
      const loginPayload: AuthLoginPayload = {
        identifier: emailOrPhone.trim(),
        password: pass,
      };

      const res = await apiService.loginUser(loginPayload);
      const apiUser = res.user;
      const accessToken = res.access_token;

      const profile: UserProfile = {
        id: apiUser.id,
        full_name: apiUser.full_name,
        phone_number: apiUser.phone_number,
        email: apiUser.email,
        blood_group: apiUser.blood_group || 'O+',
        allergies: apiUser.allergies || 'None',
        medical_notes: apiUser.medical_notes || '',
        emergency_pin: apiUser.emergency_pin || '1234',
        countdown_seconds: 5,
        sound_alarm_enabled: true,
        vibrate_enabled: true,
        sms_fallback_enabled: true,
      };

      setUser(profile);
      setToken(accessToken);
      setAuthToken(accessToken);
      setIsDemoMode(false);

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
      await AsyncStorage.setItem(TOKEN_KEY, accessToken);

      return { success: true };
    } catch (err: any) {
      // Extract human-readable error from FastAPI HTTPException response
      let errorMsg = 'Failed to sign in. Please verify your credentials or server connection.';
      if (err.response?.data?.detail) {
        if (typeof err.response.data.detail === 'string') {
          errorMsg = err.response.data.detail;
        } else if (Array.isArray(err.response.data.detail)) {
          errorMsg = err.response.data.detail.map((d: any) => d.msg).join(', ');
        }
      } else if (err.code === 'ECONNABORTED' || err.message?.includes('Network Error')) {
        errorMsg = 'Backend server unreachable. You can continue in Demo Mode or check your network.';
      }

      setAuthError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (payload: {
    full_name: string;
    phone_number: string;
    email: string;
    password: string;
    blood_group?: string;
    allergies?: string;
    medical_notes?: string;
    emergency_pin?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    setAuthError(null);

    try {
      const registerPayload: AuthRegisterPayload = {
        full_name: payload.full_name.trim(),
        phone_number: payload.phone_number.trim(),
        email: payload.email.trim(),
        password: payload.password,
        blood_group: payload.blood_group || 'O+',
        allergies: payload.allergies || 'None',
        medical_notes: payload.medical_notes || '',
        emergency_pin: payload.emergency_pin || '1234',
      };

      const res = await apiService.registerUser(registerPayload);
      const apiUser = res.user;
      const accessToken = res.access_token;

      const profile: UserProfile = {
        id: apiUser.id,
        full_name: apiUser.full_name,
        phone_number: apiUser.phone_number,
        email: apiUser.email,
        blood_group: apiUser.blood_group || 'O+',
        allergies: apiUser.allergies || 'None',
        medical_notes: apiUser.medical_notes || '',
        emergency_pin: apiUser.emergency_pin || '1234',
        countdown_seconds: 5,
        sound_alarm_enabled: true,
        vibrate_enabled: true,
        sms_fallback_enabled: true,
      };

      setUser(profile);
      setToken(accessToken);
      setAuthToken(accessToken);
      setIsDemoMode(false);

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
      await AsyncStorage.setItem(TOKEN_KEY, accessToken);

      return { success: true };
    } catch (err: any) {
      let errorMsg = 'Failed to register emergency profile. Please check your information.';
      if (err.response?.data?.detail) {
        if (typeof err.response.data.detail === 'string') {
          errorMsg = err.response.data.detail;
        } else if (Array.isArray(err.response.data.detail)) {
          errorMsg = err.response.data.detail.map((d: any) => d.msg).join(', ');
        }
      } else if (err.code === 'ECONNABORTED' || err.message?.includes('Network Error')) {
        errorMsg = 'Backend server unreachable. You can continue in Demo Mode or check your network.';
      }

      setAuthError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  };

  const continueInDemoMode = async (): Promise<void> => {
    setIsLoading(true);
    setAuthError(null);
    try {
      setUser(DEMO_USER);
      setToken(null);
      setAuthToken(null);
      setIsDemoMode(true);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(DEMO_USER));
      await AsyncStorage.removeItem(TOKEN_KEY);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      await AsyncStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setAuthToken(null);
      setUser(null);
      setIsDemoMode(false);
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (updated: Partial<UserProfile>): Promise<void> => {
    if (!user) return;
    const merged = { ...user, ...updated };
    setUser(merged);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  };

  const clearAuthError = () => {
    setAuthError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        isDemoMode,
        authError,
        login,
        register,
        continueInDemoMode,
        logout,
        updateProfile,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
};

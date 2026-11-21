import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile } from '../types';

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (emailOrPhone: string, pass: string) => Promise<boolean>;
  register: (profileData: Partial<UserProfile>) => Promise<boolean>;
  logout: () => Promise<void>;
  updateProfile: (updated: Partial<UserProfile>) => Promise<void>;
}

const STORAGE_KEY = '@emergency_sos_user_session';

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
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Check local storage for persistent session
    const loadSession = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          setUser(JSON.parse(stored));
        } else {
          // Pre-populate with demo user so initial testing is instantaneous
          setUser(DEMO_USER);
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(DEMO_USER));
        }
      } catch (err) {
        console.warn('Failed to load session, defaulting to demo user', err);
        setUser(DEMO_USER);
      } finally {
        setIsLoading(false);
      }
    };
    loadSession();
  }, []);

  const login = async (emailOrPhone: string, _pass: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      // Create or load matching session
      const loggedUser: UserProfile = {
        ...DEMO_USER,
        email: emailOrPhone.includes('@') ? emailOrPhone : DEMO_USER.email,
        phone_number: !emailOrPhone.includes('@') ? emailOrPhone : DEMO_USER.phone_number,
      };
      setUser(loggedUser);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(loggedUser));
      return true;
    } catch {
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (profileData: Partial<UserProfile>): Promise<boolean> => {
    setIsLoading(true);
    try {
      const newUser: UserProfile = {
        ...DEMO_USER,
        id: Date.now(),
        full_name: profileData.full_name || 'Emergency Responder',
        phone_number: profileData.phone_number || '+1 (555) 000-0000',
        email: profileData.email || 'user@emergencysos.org',
        blood_group: profileData.blood_group || 'O+',
        allergies: profileData.allergies || 'None',
        medical_notes: profileData.medical_notes || '',
      };
      setUser(newUser);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
      return true;
    } catch {
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      setUser(null);
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

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        updateProfile,
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

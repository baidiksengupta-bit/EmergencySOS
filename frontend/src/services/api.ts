/**
 * EmergencySOS - Centralized API Service
 * =====================================
 * Uses the Axios HTTP library to communicate with the FastAPI backend.
 * Configured with base URL and timeout from Config.
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Config } from '../constants/Config';
import { EmergencyContact, SOSAlert, AlertStatus } from '../types';

export interface HealthCheckResponse {
  status: string;
  service: string;
}

export interface HistoryQueryParams {
  user_id?: number;
  status_filter?: AlertStatus;
}

export interface AlertCreatePayload {
  user_id?: number;
  latitude: number;
  longitude: number;
  accuracy?: number;
  address?: string;
  message?: string;
  location_status?: string;
  google_maps_url?: string;
}

export interface AlertCancelPayload {
  reason?: string;
  pin?: string;
}

export interface ContactCreatePayload {
  name: string;
  phone_number: string;
  relationship_label?: string;
  email?: string;
  is_primary?: boolean;
  user_id?: number;
}

export interface ContactUpdatePayload {
  name?: string;
  phone_number?: string;
  relationship_label?: string;
  email?: string;
  is_primary?: boolean;
}

/**
 * Check whether a contact ID is a local unsynced timestamp ID (> 1,000,000,000,000 / ~Date.now()).
 * Backend SQLite autoincrement IDs are small positive integers (1, 2, 3...).
 */
export const isLocalContactId = (id: number | null | undefined): boolean => {
  if (!id) return true;
  return Number(id) > 1000000000000;
};

export interface AuthRegisterPayload {
  full_name: string;
  phone_number: string;
  email: string;
  password: string;
  blood_group?: string;
  allergies?: string;
  medical_notes?: string;
  emergency_pin?: string;
}

export interface AuthLoginPayload {
  identifier: string;
  password: string;
}

export interface AuthUserResponse {
  id: number;
  full_name: string;
  phone_number: string;
  email: string;
  blood_group?: string;
  allergies?: string;
  medical_notes?: string;
  emergency_pin?: string;
  fcm_token?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
  user: AuthUserResponse;
}

export interface BreadcrumbPayload {
  alert_id: number;
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
}

export interface BreadcrumbResponseItem {
  id: number;
  alert_id: number;
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  recorded_at: string;
}

export interface NearbyEmergencyService {
  id: string;
  name: string;
  category: 'police' | 'hospital';
  latitude: number;
  longitude: number;
  distance_km: number;
  address?: string | null;
}

/**
 * Normalizes any provided API base URL:
 * - Strips trailing whitespace and trailing slashes.
 * - Safely removes any trailing /api/v1 (or /api/v1/) to avoid double concatenation.
 * - Appends a single canonical /api/v1 prefix.
 *
 * Examples:
 * - "http://localhost:8000" -> "http://localhost:8000/api/v1"
 * - "http://localhost:8000/" -> "http://localhost:8000/api/v1"
 * - "http://localhost:8000/api/v1" -> "http://localhost:8000/api/v1"
 * - "https://inform-influenced-cpu-allan.trycloudflare.com/api/v1" -> "https://inform-influenced-cpu-allan.trycloudflare.com/api/v1"
 */
export function normalizeApiBaseUrl(rawUrl?: string): string {
  const fallback = 'http://192.168.0.127:8000';
  let url = (rawUrl && rawUrl.trim()) ? rawUrl.trim() : fallback;
  // Remove any trailing slashes
  url = url.replace(/\/+$/, '');
  // If it already ends with /api/v1, strip it first so we have a clean root base
  if (url.toLowerCase().endsWith('/api/v1')) {
    url = url.slice(0, -'/api/v1'.length);
  }
  // Remove any trailing slashes again
  url = url.replace(/\/+$/, '');
  // Append a single canonical /api/v1
  return `${url}/api/v1`;
}

export const API_BASE_URL = normalizeApiBaseUrl(Config.API_BASE_URL);

// 1. Create a configured Axios instance
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: Config.DEFAULT_TIMEOUT_MS, // 5000ms reasonable timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Centralized auth token memory state
let currentAuthToken: string | null = null;

const SECURE_STORE_TOKEN_KEY = 'auth_token';
const ASYNC_STORE_TOKEN_KEY = '@emergency_sos_auth_token';

/**
 * Helper to fetch token from SecureStore or AsyncStorage
 */
export const getPersistentAuthToken = async (): Promise<string | null> => {
  if (currentAuthToken) return currentAuthToken;
  try {
    // 1. Check Expo SecureStore if installed/available in environment
    try {
      // Dynamic require so missing module never causes a bundle or runtime crash
      const SecureStore = require('expo-secure-store');
      if (SecureStore && typeof SecureStore.getItemAsync === 'function') {
        const secureToken = await SecureStore.getItemAsync(SECURE_STORE_TOKEN_KEY);
        if (secureToken) {
          currentAuthToken = secureToken;
          return secureToken;
        }
      }
    } catch (_) {}

    // 2. Persistent AsyncStorage fallback
    const asyncToken = await AsyncStorage.getItem(ASYNC_STORE_TOKEN_KEY);
    if (asyncToken) {
      currentAuthToken = asyncToken;
      return asyncToken;
    }
    return null;
  } catch (err) {
    console.warn('[apiClient] Failed to retrieve persisted token:', err);
    return null;
  }
};

/**
 * Configure or clear the active Bearer authentication token for all apiClient requests.
 */
export const setAuthToken = (token: string | null) => {
  currentAuthToken = token;
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
  }
};

/**
 * Request Interceptor:
 * 1. Sanitizes request URL: strips any duplicate `/api/v1` prefix so URLs work seamlessly
 *    whether callers pass `/contacts/`, `/api/v1/contacts/`, or `contacts/`.
 * 2. Ensures Authorization header is dynamically attached from memory or SecureStore/AsyncStorage on all requests.
 */
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Strip duplicate /api/v1 prefix if present in request url
    if (config.url) {
      config.url = config.url.replace(/^\/?api\/v1(\/|$)/i, '/');
      if (!config.url.startsWith('/')) {
        config.url = `/${config.url}`;
      }
    }

    if (!config.headers.Authorization) {
      const token = currentAuthToken || (await getPersistentAuthToken());
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Response Interceptor: Gracefully intercepts 401 Unauthorized without crashing demo mode.
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      console.warn('[apiClient] 401 Unauthorized response intercepted - token may be expired or invalid.');
    }
    return Promise.reject(error);
  }
);

// 2. Centralized API methods
export const apiService = {
  /**
   * Health Check: Calls GET /api/v1/health on the backend
   * Returns: { status: 'ok', service: 'EmergencySOS Backend' }
   */
  checkHealth: async (): Promise<HealthCheckResponse> => {
    const response = await apiClient.get<HealthCheckResponse>('/health');
    return response.data;
  },

  /**
   * Root check: Calls GET / to confirm server is up
   */
  checkRoot: async () => {
    const response = await apiClient.get('/');
    return response.data;
  },

  // SOS Alert operations
  /**
   * Trigger SOS alert: Calls POST /api/v1/sos/trigger
   * Request body matches backend AlertCreate schema
   * Returns AlertResponse (SOSAlert)
   */
  triggerSOS: async (payload: AlertCreatePayload): Promise<SOSAlert> => {
    const response = await apiClient.post<SOSAlert>('/sos/trigger', payload);
    return response.data;
  },

  /**
   * Fetch active alert: Calls GET /api/v1/sos/active
   * Optional query param: user_id
   * Returns Optional[AlertResponse]
   */
  getActiveAlert: async (userId?: number): Promise<SOSAlert | null> => {
    const response = await apiClient.get<SOSAlert | null>(`/sos/active`, {
      params: userId ? { user_id: userId } : undefined,
    });
    return response.data;
  },

  /**
   * Cancel / Stand down alert: Calls PATCH /api/v1/sos/{alert_id}/cancel
   * Request body matches backend AlertCancel schema
   * Returns AlertResponse (SOSAlert)
   */
  cancelSOS: async (
    alertId: number,
    payload?: AlertCancelPayload
  ): Promise<SOSAlert> => {
    const response = await apiClient.patch<SOSAlert>(
      `/sos/${alertId}/cancel`,
      payload || { reason: 'Cancelled by user' }
    );
    return response.data;
  },

  /**
   * Resolve SOS alert: calls cancelSOS with standardized reason & optional PIN
   */
  resolveSOS: async (
    alertId: number,
    status: 'RESOLVED' | 'CANCELLED' = 'RESOLVED',
    pin?: string
  ): Promise<SOSAlert> => {
    return apiService.cancelSOS(alertId, {
      reason: status === 'CANCELLED' ? 'Cancelled by user' : 'Resolved',
      pin,
    });
  },

  /**
   * Fetch emergency history: Calls GET /api/v1/sos/history
   * Optional query params: user_id, status_filter (TRIGGERED, CANCELLED, RESOLVED)
   * Returns List[AlertResponse] (SOSAlert[])
   */
  getHistory: async (params?: HistoryQueryParams): Promise<SOSAlert[]> => {
    try {
      const response = await apiClient.get<SOSAlert[]>('/sos/history', {
        params: {
          ...(params?.user_id ? { user_id: params.user_id } : {}),
          ...(params?.status_filter ? { status_filter: params.status_filter } : {}),
        },
      });
      return response.data;
    } catch (err: any) {
      if (err?.response?.status === 400 || err?.response?.status === 401) {
        return [];
      }
      throw err;
    }
  },

  // Emergency Contacts operations
  /**
   * List emergency contacts: Calls GET /api/v1/contacts/
   * Query params: user_id (optional)
   * Returns List[ContactResponse] (EmergencyContact[])
   */
  getContacts: async (userId?: number): Promise<EmergencyContact[]> => {
    const response = await apiClient.get<EmergencyContact[]>('/contacts/', {
      params: userId ? { user_id: userId } : undefined,
    });
    return response.data;
  },

  /**
   * List emergency contacts by user ID: Calls GET /api/v1/contacts/user/{user_id}
   */
  getContactsByUser: async (userId: number): Promise<EmergencyContact[]> => {
    const response = await apiClient.get<EmergencyContact[]>(`/contacts/user/${userId}`);
    return response.data;
  },

  /**
   * Add emergency contact: Calls POST /api/v1/contacts/
   * Request body matches backend ContactCreate schema
   * Returns ContactResponse (EmergencyContact)
   */
  createContact: async (contact: ContactCreatePayload): Promise<EmergencyContact> => {
    const response = await apiClient.post<EmergencyContact>('/contacts/', {
      relationship_label: 'Family',
      is_primary: false,
      ...contact,
    });
    return response.data;
  },

  /**
   * Update emergency contact: Calls PATCH /api/v1/contacts/{contact_id}
   * Request body matches backend ContactUpdate schema
   * Returns ContactResponse (EmergencyContact)
   */
  updateContact: async (
    contactId: number,
    contact: ContactUpdatePayload
  ): Promise<EmergencyContact> => {
    const response = await apiClient.patch<EmergencyContact>(
      `/contacts/${contactId}`,
      contact
    );
    return response.data;
  },

  /**
   * Remove emergency contact: Calls DELETE /api/v1/contacts/{contact_id}
   * Returns deletion message
   */
  deleteContact: async (contactId: number): Promise<{ message: string; id: number }> => {
    const response = await apiClient.delete<{ message: string; id: number }>(
      `/contacts/${contactId}`
    );
    return response.data;
  },

  // Telemetry Breadcrumb
  sendLocationBreadcrumb: async (
    breadcrumb: BreadcrumbPayload
  ): Promise<BreadcrumbResponseItem> => {
    try {
      const response = await apiClient.post<BreadcrumbResponseItem>(
        '/location/breadcrumb',
        breadcrumb
      );
      return response.data;
    } catch (err) {
      console.warn('[apiService] Breadcrumb upload offline/failed, using local fallback item:', err);
      return {
        id: Date.now(),
        alert_id: breadcrumb.alert_id,
        latitude: breadcrumb.latitude,
        longitude: breadcrumb.longitude,
        accuracy: breadcrumb.accuracy,
        speed: breadcrumb.speed,
        heading: breadcrumb.heading,
        recorded_at: new Date().toISOString(),
      };
    }
  },

  /**
   * Fetch GPS breadcrumbs for an active or past alert
   * Calls GET /api/v1/location/alert/{alert_id}/breadcrumbs
   * Returns BreadcrumbResponseItem[] with safe offline fallback
   */
  getAlertBreadcrumbs: async (alertId: number): Promise<BreadcrumbResponseItem[]> => {
    try {
      const response = await apiClient.get<BreadcrumbResponseItem[]>(
        `/location/alert/${alertId}/breadcrumbs`
      );
      return response.data;
    } catch (err) {
      console.warn(`[apiService] Fetch breadcrumbs for alert #${alertId} failed or offline:`, err);
      return [];
    }
  },

  // Authentication operations
  /**
   * Register a new user: Calls POST /api/v1/auth/register
   * Returns AuthTokenResponse with access_token and user profile
   */
  registerUser: async (payload: AuthRegisterPayload): Promise<AuthTokenResponse> => {
    const response = await apiClient.post<AuthTokenResponse>('/auth/register', payload);
    return response.data;
  },

  /**
   * Authenticate user: Calls POST /api/v1/auth/login
   * Returns AuthTokenResponse with access_token and user profile
   */
  loginUser: async (payload: AuthLoginPayload): Promise<AuthTokenResponse> => {
    const response = await apiClient.post<AuthTokenResponse>('/auth/login', payload);
    return response.data;
  },

  /**
   * Fetch current user profile: Calls GET /api/v1/auth/me
   * Requires Bearer token
   */
  getCurrentUser: async (): Promise<AuthUserResponse> => {
    const response = await apiClient.get<AuthUserResponse>('/auth/me');
    return response.data;
  },

  /**
   * Discover nearby Police Stations and Hospitals
   * Calls GET /api/v1/location/nearby-services?lat={lat}&lng={lng}&radius_m={radius_m}
   * If backend is offline or unreachable, falls back to direct OpenStreetMap Overpass API
   * using the user's real GPS coordinates. Never returns hardcoded fake addresses.
   */
  getNearbyServices: async (
    lat: number,
    lng: number,
    radiusM: number = 3000
  ): Promise<NearbyEmergencyService[]> => {
    try {
      const response = await apiClient.get<NearbyEmergencyService[]>('/location/nearby-services', {
        params: {
          lat,
          lng,
          radius_m: radiusM,
        },
      });
      return response.data;
    } catch (err) {
      console.warn('[apiService] Backend nearby-services query unreachable, querying Overpass directly with real GPS:', err);
      // Query real OpenStreetMap Overpass API directly from client
      try {
        const { locationService } = require('./location');
        const realServices = await locationService.fetchNearbyServicesFromOverpass(lat, lng, radiusM);
        return realServices;
      } catch (overpassErr) {
        console.warn('[apiService] Direct Overpass query also failed:', overpassErr);
        return [];
      }
    }
  },
};

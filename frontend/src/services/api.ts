/**
 * EmergencySOS - Centralized API Service
 * =====================================
 * Uses the Axios HTTP library to communicate with the FastAPI backend.
 * Configured with base URL and timeout from Config.
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
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

// 1. Create a configured Axios instance
export const apiClient = axios.create({
  baseURL: Config.API_BASE_URL,
  timeout: Config.DEFAULT_TIMEOUT_MS, // 5000ms reasonable timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Centralized auth token memory state
let currentAuthToken: string | null = null;

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
 * Request Interceptor: Ensures Authorization header is dynamically attached if present.
 */
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (currentAuthToken && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${currentAuthToken}`;
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
   * Health Check: Calls GET /health on the backend
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
    const response = await apiClient.post<SOSAlert>('/api/v1/sos/trigger', payload);
    return response.data;
  },

  /**
   * Fetch active alert: Calls GET /api/v1/sos/active
   * Optional query param: user_id
   * Returns Optional[AlertResponse]
   */
  getActiveAlert: async (userId?: number): Promise<SOSAlert | null> => {
    const response = await apiClient.get<SOSAlert | null>(`/api/v1/sos/active`, {
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
      `/api/v1/sos/${alertId}/cancel`,
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
    const response = await apiClient.get<SOSAlert[]>('/api/v1/sos/history', {
      params: {
        user_id: params?.user_id ?? 1,
        ...(params?.status_filter ? { status_filter: params.status_filter } : {}),
      },
    });
    return response.data;
  },

  // Emergency Contacts operations
  /**
   * List emergency contacts: Calls GET /api/v1/contacts/
   * Query params: user_id (optional)
   * Returns List[ContactResponse] (EmergencyContact[])
   */
  getContacts: async (userId?: number): Promise<EmergencyContact[]> => {
    const response = await apiClient.get<EmergencyContact[]>('/api/v1/contacts/', {
      params: userId ? { user_id: userId } : undefined,
    });
    return response.data;
  },

  /**
   * List emergency contacts by user ID: Calls GET /api/v1/contacts/user/{user_id}
   */
  getContactsByUser: async (userId: number): Promise<EmergencyContact[]> => {
    const response = await apiClient.get<EmergencyContact[]>(`/api/v1/contacts/user/${userId}`);
    return response.data;
  },

  /**
   * Add emergency contact: Calls POST /api/v1/contacts/
   * Request body matches backend ContactCreate schema
   * Returns ContactResponse (EmergencyContact)
   */
  createContact: async (contact: ContactCreatePayload): Promise<EmergencyContact> => {
    const response = await apiClient.post<EmergencyContact>('/api/v1/contacts/', {
      relationship_label: 'Family',
      is_primary: false,
      ...contact,
    });
    return response.data;
  },

  /**
   * Update emergency contact: Calls PATCH /api/v1/contacts/{contact_id} (if supported by backend)
   * Request body matches backend ContactUpdate schema
   * Returns ContactResponse (EmergencyContact)
   */
  updateContact: async (
    contactId: number,
    contact: ContactUpdatePayload
  ): Promise<EmergencyContact> => {
    const response = await apiClient.patch<EmergencyContact>(
      `/api/v1/contacts/${contactId}`,
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
      `/api/v1/contacts/${contactId}`
    );
    return response.data;
  },

  // Telemetry Breadcrumb
  sendLocationBreadcrumb: async (breadcrumb: {
    alert_id: number;
    latitude: number;
    longitude: number;
    accuracy?: number;
    speed?: number;
    heading?: number;
  }) => {
    const response = await apiClient.post('/api/v1/location/breadcrumb', breadcrumb);
    return response.data;
  },

  // Authentication operations
  /**
   * Register a new user: Calls POST /api/v1/auth/register
   * Returns AuthTokenResponse with access_token and user profile
   */
  registerUser: async (payload: AuthRegisterPayload): Promise<AuthTokenResponse> => {
    const response = await apiClient.post<AuthTokenResponse>('/api/v1/auth/register', payload);
    return response.data;
  },

  /**
   * Authenticate user: Calls POST /api/v1/auth/login
   * Returns AuthTokenResponse with access_token and user profile
   */
  loginUser: async (payload: AuthLoginPayload): Promise<AuthTokenResponse> => {
    const response = await apiClient.post<AuthTokenResponse>('/api/v1/auth/login', payload);
    return response.data;
  },

  /**
   * Fetch current user profile: Calls GET /api/v1/auth/me
   * Requires Bearer token
   */
  getCurrentUser: async (): Promise<AuthUserResponse> => {
    const response = await apiClient.get<AuthUserResponse>('/api/v1/auth/me');
    return response.data;
  },
};

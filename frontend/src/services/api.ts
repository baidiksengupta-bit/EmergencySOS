/**
 * EmergencySOS - Centralized API Service
 * =====================================
 * Uses the Axios HTTP library to communicate with the FastAPI backend.
 * Configured with base URL and timeout from Config.
 */

import axios from 'axios';
import { Config } from '../constants/Config';
import { EmergencyContact, SOSAlert } from '../types';

export interface HealthCheckResponse {
  status: string;
  service: string;
}

// 1. Create a configured Axios instance
export const apiClient = axios.create({
  baseURL: Config.API_BASE_URL,
  timeout: Config.DEFAULT_TIMEOUT_MS, // 5000ms reasonable timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

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
  triggerSOS: async (payload: {
    user_id: number;
    latitude: number;
    longitude: number;
    accuracy?: number;
    address?: string;
    message?: string;
    location_status?: string;
    google_maps_url?: string;
  }): Promise<SOSAlert> => {
    const response = await apiClient.post<SOSAlert>('/api/v1/sos/trigger', payload);
    return response.data;
  },

  getActiveAlert: async (userId: number): Promise<SOSAlert | null> => {
    const response = await apiClient.get<SOSAlert | null>(`/api/v1/sos/active`, {
      params: { user_id: userId },
    });
    return response.data;
  },

  resolveSOS: async (
    alertId: number,
    status: 'RESOLVED' | 'CANCELLED' = 'RESOLVED'
  ): Promise<SOSAlert> => {
    const response = await apiClient.patch<SOSAlert>(`/api/v1/sos/${alertId}/cancel`, {
      reason: status === 'CANCELLED' ? 'Cancelled by user' : 'Resolved',
    });
    return response.data;
  },

  // Emergency Contacts operations
  getContacts: async (userId: number): Promise<EmergencyContact[]> => {
    const response = await apiClient.get<EmergencyContact[]>(`/api/v1/contacts/user/${userId}`);
    return response.data;
  },

  createContact: async (contact: {
    user_id: number;
    name: string;
    phone_number: string;
    relationship_label: string;
    is_primary: boolean;
  }): Promise<EmergencyContact> => {
    const response = await apiClient.post<EmergencyContact>('/api/v1/contacts/', contact);
    return response.data;
  },

  deleteContact: async (contactId: number): Promise<void> => {
    await apiClient.delete(`/api/v1/contacts/${contactId}`);
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
};

export type AlertStatus = 'PENDING' | 'TRIGGERED' | 'ACKNOWLEDGED' | 'RESOLVED' | 'CANCELLED';
export type LocationStatus = 'ACCURATE' | 'DEGRADED' | 'UNAVAILABLE' | 'LOCATION_DENIED';
export type DeliveryStatus = 'ACCEPTED' | 'FAILED' | 'UNCONFIGURED' | 'NO_RECIPIENTS' | 'OFFLINE';

export interface NotificationDeliveryReport {
  provider: string;
  delivery_status: DeliveryStatus;
  confirmed_count: number;
  failed_count: number;
  recipient_count: number;
  details: string;
  google_maps_url?: string;
}

export interface UserProfile {
  id: number;
  full_name: string;
  phone_number: string;
  email: string;
  blood_group?: string;
  medical_notes?: string;
  allergies?: string;
  emergency_pin?: string;
  countdown_seconds?: number;
  sound_alarm_enabled?: boolean;
  vibrate_enabled?: boolean;
  sms_fallback_enabled?: boolean;
}

export type ContactPriority = 'PRIMARY' | 'HIGH' | 'STANDARD';

export interface EmergencyContact {
  id: number;
  user_id?: number;
  name: string;
  phone_number: string;
  relationship_label: string;
  is_primary: boolean;
  priority_level?: ContactPriority;
  email?: string;
  avatar_color?: string;
}

export interface SOSAlert {
  id: number;
  user_id: number;
  status: AlertStatus;
  latitude: number;
  longitude: number;
  accuracy?: number;
  address?: string;
  message?: string;
  google_maps_url?: string;
  location_status?: LocationStatus;
  notification_status?: DeliveryStatus | string;
  contacts_alerted_count?: number;
  delivery_report?: NotificationDeliveryReport;
  breadcrumbs_count?: number;
  elapsed_seconds?: number;
  triggered_at: string;
  resolved_at?: string;
  cancellation_reason?: string;
}

export type CountdownDuration = 0 | 3 | 5 | 10 | 15;

export type AppTheme = 'navy' | 'midnight' | 'high-contrast';

export interface LocalUserProfile {
  full_name: string;
  medical_notes?: string;
  is_completed?: boolean;
}

export interface LocalAppSettings {
  countdown_seconds: CountdownDuration;
  vibrate_enabled: boolean;
  sound_alarm_enabled: boolean;
  countdown_preference_set?: boolean;
  theme?: AppTheme;
  custom_emergency_message?: string;
}

export interface EmergencyPlanStatus {
  isProfileComplete: boolean;
  isContactsComplete: boolean;
  isLocationComplete: boolean;
  isCountdownComplete: boolean;
  completedCount: number;
  totalCount: number;
  progressPercent: number;
  isReady: boolean;
}

export interface EmergencyHistoryItem {
  id: string;
  alert_id?: number;
  timestamp: string;
  resolved_at?: string;
  status: AlertStatus | string;
  location_address: string;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  google_maps_url?: string;
  contacts_notified_count?: number;
  notes?: string;
  duration_minutes?: number;
}

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  speed?: number | null;
  heading?: number | null;
  timestamp?: number;
  address?: string;
  status?: LocationStatus;
}

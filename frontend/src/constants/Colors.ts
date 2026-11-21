/**
 * EmergencySOS Theme Palette
 * Supports exactly two selectable themes:
 * - light_white: Crisp white background (#FFFFFF), light slate/off-white card surfaces (#F8FAFC / #F1F5F9), clean subtle borders (#CBD5E1 / #E2E8F0), dark navy/slate primary text (#0F172A), muted slate secondary text (#475569), emergency crimson accents (#DC2626)
 * - midnight_navy (Default): Deep navy background (#070D1F), navy cards (#0F1B38), subtle slate-blue borders (#1E315E), crisp white primary text (#FFFFFF), muted slate secondary text (#94A3B8), emergency crimson accents (#EF4444)
 */

export interface ThemeColors {
  id: 'light_white' | 'midnight_navy';
  isDark: boolean;
  statusBarStyle: 'dark-content' | 'light-content';
  statusBarMode: 'dark' | 'light';
  background: string;
  headerBackground: string;
  cardBackground: string;
  cardNavyBackground: string;
  cardBorder: string;
  cardBorderSubtle: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  emergencyPrimary: string;
  emergencyLight: string;
  emergencyDark: string;
  emergencySurface: string;
  tabBarBackground: string;
  tabBarBorder: string;
  accent: string;
}

export const THEME_PALETTES: Record<'light_white' | 'midnight_navy', ThemeColors> = {
  light_white: {
    id: 'light_white',
    isDark: false,
    statusBarStyle: 'dark-content',
    statusBarMode: 'dark',
    background: '#FFFFFF',
    headerBackground: '#FFFFFF',
    cardBackground: '#F8FAFC',
    cardNavyBackground: '#F1F5F9',
    cardBorder: '#CBD5E1',
    cardBorderSubtle: '#E2E8F0',
    textPrimary: '#0F172A',
    textSecondary: '#475569',
    textMuted: '#64748B',
    emergencyPrimary: '#DC2626',
    emergencyLight: '#EF4444',
    emergencyDark: '#991B1B',
    emergencySurface: '#FEF2F2',
    tabBarBackground: '#FFFFFF',
    tabBarBorder: '#E2E8F0',
    accent: '#0284C7',
  },
  midnight_navy: {
    id: 'midnight_navy',
    isDark: true,
    statusBarStyle: 'light-content',
    statusBarMode: 'light',
    background: '#070D1F',
    headerBackground: '#070D1F',
    cardBackground: '#0F1B38',
    cardNavyBackground: '#0F1B38',
    cardBorder: '#1E315E',
    cardBorderSubtle: '#152445',
    textPrimary: '#FFFFFF',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    emergencyPrimary: '#EF4444',
    emergencyLight: '#F87171',
    emergencyDark: '#DC2626',
    emergencySurface: '#1C1527',
    tabBarBackground: '#070D1F',
    tabBarBorder: '#152445',
    accent: '#1282A2',
  },
};

export const Colors = {
  // Dark Navy Primary Family
  navy: {
    darkest: '#050B14',    // Deepest midnight
    900: '#0A1128',        // Core Dark Navy
    800: '#001F54',        // Deep Navy Slate
    700: '#034078',        // Rich Navy
    600: '#0D3B66',        // Navy Accent
    500: '#1282A2',        // Slate Teal / Highlight
    light: '#1E293B',      // Slate surface for dark cards
  },

  // Emergency Red
  emergency: {
    primary: '#DC2626',    // Emergency Red
    dark: '#991B1B',       // Deep Crimson
    light: '#EF4444',      // Bright Alert Red
    surface: '#FEF2F2',    // Light Red Tint
    border: '#FECACA',     // Red Outline
    pulse: 'rgba(220, 38, 38, 0.25)',
    pulseGlow: 'rgba(239, 68, 68, 0.45)',
  },

  // Crisp Whites & Neutrals
  white: '#FFFFFF',
  offWhite: '#F8FAFC',
  slate50: '#F1F5F9',
  slate100: '#E2E8F0',
  slate200: '#CBD5E1',
  slate400: '#94A3B8',
  slate600: '#475569',
  slate800: '#1E293B',
  slate900: '#0F172A',

  // Status Indicators
  success: '#10B981',
  successLight: '#ECFDF5',
  warning: '#F59E0B',
  warningLight: '#FFFBEB',
  info: '#0284C7',
  infoLight: '#F0F9FF',

  // Semantic UI Mapping
  background: '#F8FAFC',
  headerBackground: '#0A1128',
  card: '#FFFFFF',
  cardDark: '#0A1128',
  text: '#0F172A',
  textLight: '#FFFFFF',
  textMuted: '#64748B',
  border: '#E2E8F0',
  borderDark: '#1E293B',
};

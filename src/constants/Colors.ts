// SheDrive Color Palette & Theme Tokens
// High-Trust Safety Emerald (Teal), Modern Indigo, and Slate Design System

const tintColorLight = '#0D9488';
const tintColorDark = '#2DD4BF';

const Colors = {
  light: {
    // Primary palette (Teal / Safety Emerald)
    primary: '#0D9488',
    primaryDark: '#0F766E',
    primaryLight: '#2DD4BF',
    primaryGhost: '#F0FDFA',
    rosePink: '#14B8A6',
    softPink: '#CCFBF1',

    // Accent & Modern Tech (Indigo / Slate)
    accent: '#6366F1',
    accentDark: '#4F46E5',
    purple: '#6366F1',
    purpleLight: '#EEF2FF',
    gold: '#F59E0B',
    goldLight: '#FEF3C7',

    // Dark Elevated Surface
    darkElevated: '#0F172A',
    slateDark: '#1E293B',

    // Backgrounds
    background: '#F8FAFC',
    surface: '#FFFFFF',
    card: '#FFFFFF',
    cardElevated: '#FFFFFF',

    // Text
    text: '#0F172A',
    textSecondary: '#64748B',
    textTertiary: '#94A3B8',
    textOnPrimary: '#FFFFFF',

    // Borders & dividers
    border: '#E2E8F0',
    divider: '#F1F5F9',
    glassBorder: 'rgba(13, 148, 136, 0.15)',

    // Semantic
    success: '#10B981',
    successLight: '#ECFDF5',
    warning: '#F59E0B',
    warningLight: '#FEF3C7',
    error: '#EF4444',
    errorLight: '#FEF2F2',
    info: '#3B82F6',
    infoLight: '#EFF6FF',

    // SOS / Emergency (Safety Crimson)
    emergency: '#EF4444',
    emergencyBackground: '#DC2626',

    // Map
    routeColor: '#0D9488',
    pickupMarker: '#10B981',
    dropoffMarker: '#EF4444',
    driverMarker: '#6366F1',

    // Navigation
    tabBar: '#FFFFFF',
    tabBarActive: '#0D9488',
    tabBarInactive: '#94A3B8',

    // Shadows
    shadow: 'rgba(15, 23, 42, 0.05)',
    shadowMedium: 'rgba(15, 23, 42, 0.1)',
    shadowDark: 'rgba(15, 23, 42, 0.2)',
    shadowGlow: 'rgba(13, 148, 136, 0.25)',

    // Status
    online: '#10B981',
    offline: '#94A3B8',
    busy: '#F59E0B',

    // Tint
    tint: tintColorLight,
  },

  dark: {
    // Primary palette (Teal / Safety Emerald)
    primary: '#2DD4BF',
    primaryDark: '#0D9488',
    primaryLight: '#14B8A6',
    primaryGhost: '#042F2E',
    rosePink: '#2DD4BF',
    softPink: '#134E4A',

    // Accent & Modern Tech (Indigo / Slate)
    accent: '#818CF8',
    accentDark: '#6366F1',
    purple: '#818CF8',
    purpleLight: '#1E1B4B',
    gold: '#FBBF24',
    goldLight: '#451A03',

    // Dark Elevated Surface
    darkElevated: '#020617',
    slateDark: '#0F172A',

    // Backgrounds
    background: '#0F172A',
    surface: '#1E293B',
    card: '#1E293B',
    cardElevated: '#334155',

    // Text
    text: '#F8FAFC',
    textSecondary: '#94A3B8',
    textTertiary: '#64748B',
    textOnPrimary: '#0F172A',

    // Borders & dividers
    border: '#334155',
    divider: '#1E293B',
    glassBorder: 'rgba(45, 212, 191, 0.2)',

    // Semantic
    success: '#34D399',
    successLight: '#064E3B',
    warning: '#FBBF24',
    warningLight: '#78350F',
    error: '#F87171',
    errorLight: '#7F1D1D',
    info: '#60A5FA',
    infoLight: '#1E3A8A',

    // SOS / Emergency
    emergency: '#EF4444',
    emergencyBackground: '#DC2626',

    // Map
    routeColor: '#2DD4BF',
    pickupMarker: '#34D399',
    dropoffMarker: '#F87171',
    driverMarker: '#818CF8',

    // Navigation
    tabBar: '#0F172A',
    tabBarActive: '#2DD4BF',
    tabBarInactive: '#64748B',

    // Shadows
    shadow: 'rgba(0, 0, 0, 0.3)',
    shadowMedium: 'rgba(0, 0, 0, 0.5)',
    shadowDark: 'rgba(0, 0, 0, 0.7)',
    shadowGlow: 'rgba(45, 212, 191, 0.3)',

    // Status
    online: '#34D399',
    offline: '#64748B',
    busy: '#FBBF24',

    // Tint
    tint: tintColorDark,
  },
};

export default Colors;

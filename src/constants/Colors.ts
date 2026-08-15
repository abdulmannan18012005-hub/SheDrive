// SheDrive Color Palette & Theme Tokens
// Premium female-friendly ride-hailing design system with light/dark mode support

const tintColorLight = '#E91E63';
const tintColorDark = '#F48FB1';

const Colors = {
  light: {
    // Primary palette
    primary: '#E91E63',
    primaryDark: '#C2185B',
    primaryLight: '#F8BBD0',
    primaryGhost: '#FCE4EC',
    rosePink: '#FF5C8A',
    softPink: '#FFD1E3',

    // Accent & Luxury
    accent: '#FF4081',
    accentDark: '#F50057',
    purple: '#6A1B9A',
    purpleLight: '#F3E5F5',
    gold: '#FFC107',
    goldLight: '#FFF8E1',

    // Backgrounds
    background: '#FAFAFA',
    surface: '#FFFFFF',
    card: '#FFFFFF',
    cardElevated: '#FFF8F9',

    // Text
    text: '#1A1A1A',
    textSecondary: '#666666',
    textTertiary: '#9E9E9E',
    textOnPrimary: '#FFFFFF',

    // Borders & dividers
    border: '#EAEAEA',
    divider: '#F5F5F5',
    glassBorder: 'rgba(233, 30, 99, 0.12)',

    // Semantic
    success: '#10B981',
    successLight: '#ECFDF5',
    warning: '#F59E0B',
    warningLight: '#FEF3C7',
    error: '#EF4444',
    errorLight: '#FEF2F2',
    info: '#3B82F6',
    infoLight: '#EFF6FF',

    // SOS / Emergency
    emergency: '#D50000',
    emergencyBackground: '#FF1744',

    // Map
    routeColor: '#E91E63',
    pickupMarker: '#10B981',
    dropoffMarker: '#EF4444',
    driverMarker: '#3B82F6',

    // Navigation
    tabBar: '#FFFFFF',
    tabBarActive: '#E91E63',
    tabBarInactive: '#9E9E9E',

    // Shadows
    shadow: 'rgba(0, 0, 0, 0.06)',
    shadowMedium: 'rgba(0, 0, 0, 0.12)',
    shadowDark: 'rgba(0, 0, 0, 0.22)',
    shadowGlow: 'rgba(233, 30, 99, 0.25)',

    // Status
    online: '#10B981',
    offline: '#9E9E9E',
    busy: '#F59E0B',

    // Tint
    tint: tintColorLight,
  },

  dark: {
    // Primary palette
    primary: '#F48FB1',
    primaryDark: '#E91E63',
    primaryLight: '#880E4F',
    primaryGhost: '#311B20',
    rosePink: '#FF5C8A',
    softPink: '#FFD1E3',

    // Accent & Luxury
    accent: '#FF80AB',
    accentDark: '#FF4081',
    purple: '#CE93D8',
    purpleLight: '#38006B',
    gold: '#FFD54F',
    goldLight: '#422D00',

    // Backgrounds
    background: '#121212',
    surface: '#1E1E1E',
    card: '#2C2C2C',
    cardElevated: '#353535',

    // Text
    text: '#FFFFFF',
    textSecondary: '#B0BEC5',
    textTertiary: '#78909C',
    textOnPrimary: '#000000',

    // Borders & dividers
    border: '#424242',
    divider: '#303030',
    glassBorder: 'rgba(244, 143, 177, 0.2)',

    // Semantic
    success: '#66BB6A',
    successLight: '#1B5E20',
    warning: '#FFA726',
    warningLight: '#E65100',
    error: '#EF5350',
    errorLight: '#B71C1C',
    info: '#42A5F5',
    infoLight: '#0D47A1',

    // SOS / Emergency
    emergency: '#FF1744',
    emergencyBackground: '#D50000',

    // Map
    routeColor: '#F48FB1',
    pickupMarker: '#66BB6A',
    dropoffMarker: '#EF5350',
    driverMarker: '#42A5F5',

    // Navigation
    tabBar: '#1E1E1E',
    tabBarActive: '#F48FB1',
    tabBarInactive: '#78909C',

    // Shadows
    shadow: 'rgba(0, 0, 0, 0.3)',
    shadowMedium: 'rgba(0, 0, 0, 0.4)',
    shadowDark: 'rgba(0, 0, 0, 0.6)',
    shadowGlow: 'rgba(244, 143, 177, 0.3)',

    // Status
    online: '#66BB6A',
    offline: '#78909C',
    busy: '#FFA726',

    // Tint
    tint: tintColorDark,
  },
};

export default Colors;

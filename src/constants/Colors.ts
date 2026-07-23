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

    // Accent
    accent: '#FF4081',
    accentDark: '#F50057',

    // Backgrounds
    background: '#FAFAFA',
    surface: '#FFFFFF',
    card: '#FFFFFF',
    cardElevated: '#FFF8F9',

    // Text
    text: '#212121',
    textSecondary: '#757575',
    textTertiary: '#9E9E9E',
    textOnPrimary: '#FFFFFF',

    // Borders & dividers
    border: '#E0E0E0',
    divider: '#F5F5F5',

    // Semantic
    success: '#4CAF50',
    successLight: '#E8F5E9',
    warning: '#FF9800',
    warningLight: '#FFF3E0',
    error: '#F44336',
    errorLight: '#FFEBEE',
    info: '#2196F3',
    infoLight: '#E3F2FD',

    // SOS / Emergency
    emergency: '#D50000',
    emergencyBackground: '#FF1744',

    // Map
    routeColor: '#E91E63',
    pickupMarker: '#4CAF50',
    dropoffMarker: '#F44336',
    driverMarker: '#2196F3',

    // Navigation
    tabBar: '#FFFFFF',
    tabBarActive: '#E91E63',
    tabBarInactive: '#9E9E9E',

    // Shadows
    shadow: 'rgba(0, 0, 0, 0.1)',
    shadowMedium: 'rgba(0, 0, 0, 0.15)',
    shadowDark: 'rgba(0, 0, 0, 0.25)',

    // Status
    online: '#4CAF50',
    offline: '#9E9E9E',
    busy: '#FF9800',

    // Tint
    tint: tintColorLight,
  },

  dark: {
    // Primary palette
    primary: '#F48FB1',
    primaryDark: '#E91E63',
    primaryLight: '#880E4F',
    primaryGhost: '#311B20',

    // Accent
    accent: '#FF80AB',
    accentDark: '#FF4081',

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

    // Status
    online: '#66BB6A',
    offline: '#78909C',
    busy: '#FFA726',

    // Tint
    tint: tintColorDark,
  },
};

export default Colors;

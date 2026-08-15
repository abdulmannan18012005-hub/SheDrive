/**
 * SheDrive API Base URL Configuration
 * Local Wi-Fi Development Mode
 *
 * HOW TO UPDATE: If your laptop's Wi-Fi IP changes, update ONLY the IP below.
 * Find your IP by running in terminal:  ipconfig | findstr "IPv4"
 */

// ✏️ Configuration Mode: Set to false for production release builds, or true for local development
const IS_LOCAL_DEV = false;

// ✏️ Local Development: Update this IP to your laptop's current Wi-Fi IP address
const LOCAL_LAPTOP_IP = '192.168.100.9';

// 🌐 Production Render Backend Base URL
const PRODUCTION_API_URL = 'https://shedrive-backend.onrender.com/api/v1';

export const API_BASE_URL = IS_LOCAL_DEV
  ? `http://${LOCAL_LAPTOP_IP}:3000/api/v1`
  : PRODUCTION_API_URL;

export const getApiBaseUrl = (): string => API_BASE_URL;

export const ENDPOINTS = {
  HEALTH: `${API_BASE_URL}/health`,
  AUTH: {
    LOGIN: `${API_BASE_URL}/auth/login`,
    REGISTER: `${API_BASE_URL}/auth/register`,
  },
  RIDES: {
    REQUEST: `${API_BASE_URL}/rides/request`,
    ACTIVE: `${API_BASE_URL}/rides/active`,
  },
  UPLOAD: {
    DOCUMENT: `${API_BASE_URL}/upload/document`,
  },
};

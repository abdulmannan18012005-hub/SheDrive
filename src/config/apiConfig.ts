/**
 * SheDrive Dynamic API Base URL & Versioning Configuration
 * Automatically switches endpoints between Local Development and Production Cloud Servers.
 */

const DEV_API_URL = 'http://10.0.2.2:3000/api/v1'; // Standard Android Emulator Local Loopback IP
const PROD_API_URL = 'https://shedrive-api.onrender.com/api/v1'; // Always-Online Production Backend API

export const API_BASE_URL = __DEV__ ? DEV_API_URL : PROD_API_URL;

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

// Admin API Client with caching, error handling, and request deduplication

const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const API_BASE_URL = isLocalhost
  ? (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1')
  : 'https://shedrive.onrender.com/api/v1';

// Simple in-memory cache with TTL
interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = {
  SHORT: 5000,    // 5 seconds - for live data
  MEDIUM: 30000,  // 30 seconds - for stats, settings
  LONG: 120000,   // 2 minutes - for static data
};

// In-flight request deduplication
const pendingRequests = new Map<string, Promise<any>>();

// Abort controllers for cancellation
const abortControllers = new Map<string, AbortController>();

function getCacheKey(endpoint: string, params?: Record<string, any>): string {
  const paramString = params ? JSON.stringify(params) : '';
  return `${endpoint}:${paramString}`;
}

function getFromCache(key: string): any | null {
  const entry = cache.get(key);
  if (!entry) return null;
  
  if (Date.now() - entry.timestamp > entry.ttl) {
    cache.delete(key);
    return null;
  }
  
  return entry.data;
}

function setCache(key: string, data: any, ttl: number): void {
  cache.set(key, { data, timestamp: Date.now(), ttl });
}

function invalidateCache(pattern: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(pattern)) {
      cache.delete(key);
    }
  }
}

function invalidateAllCache(): void {
  cache.clear();
}

async function fetchWithErrorHandling(
  endpoint: string,
  options: RequestInit = {},
  cacheTTL: number | null = null
): Promise<any> {
  const cacheKey = getCacheKey(endpoint, options.body ? JSON.parse(options.body as string) : undefined);
  
  // Check cache first
  if (cacheTTL && options.method === 'GET') {
    const cached = getFromCache(cacheKey);
    if (cached) return cached;
  }
  
  // Check for in-flight request
  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey);
  }
  
  // Create abort controller
  const controller = new AbortController();
  abortControllers.set(cacheKey, controller);
  
  const requestPromise = (async () => {
    try {
      const token = getAuthToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {}),
      };
      if (token && !headers['Authorization'] && !headers['authorization']) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers,
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      // Cache successful GET requests
      if (cacheTTL && options.method === 'GET' || !options.method) {
        setCache(cacheKey, data, cacheTTL);
      }
      
      return data;
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log(`Request aborted: ${endpoint}`);
        throw new Error('Request cancelled');
      }
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    } finally {
      pendingRequests.delete(cacheKey);
      abortControllers.delete(cacheKey);
    }
  })();
  
  pendingRequests.set(cacheKey, requestPromise);
  return requestPromise;
}

export function cancelRequest(pattern: string): void {
  for (const [key, controller] of abortControllers.entries()) {
    if (key.startsWith(pattern)) {
      controller.abort();
      abortControllers.delete(key);
      pendingRequests.delete(key);
    }
  }
}

export function cancelAllRequests(): void {
  for (const controller of abortControllers.values()) {
    controller.abort();
  }
  abortControllers.clear();
  pendingRequests.clear();
}

// Get auth token
export function getAuthToken(): string {
  return localStorage.getItem('shedrive_admin_token') || '';
}

// Set auth token
export function setAuthToken(token: string): void {
  localStorage.setItem('shedrive_admin_token', token);
}

// Clear auth token
export function clearAuthToken(): void {
  localStorage.removeItem('shedrive_admin_token');
  invalidateAllCache();
}

// API methods
export const adminApi = {
  // Auth
  login: async (email: string, password: string) => {
    return fetchWithErrorHandling('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }, null);
  },
  
  // Stats (cached for 30 seconds)
  getStats: async () => {
    return fetchWithErrorHandling('/admin/stats', {}, CACHE_TTL.MEDIUM);
  },
  
  // Pending drivers (cached for 5 seconds)
  getPendingDrivers: async () => {
    return fetchWithErrorHandling('/admin/drivers/pending', {}, CACHE_TTL.SHORT);
  },
  
  // Drivers with pagination
  getDrivers: async (params: { page?: number; limit?: number; search?: string; status?: string } = {}) => {
    const queryString = new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== '') as [string, string][]
    ).toString();
    const endpoint = queryString ? `/admin/drivers?${queryString}` : '/admin/drivers';
    return fetchWithErrorHandling(endpoint, {}, CACHE_TTL.MEDIUM);
  },
  
  // Verify driver
  verifyDriver: async (driverId: string, approve: boolean, reason?: string) => {
    invalidateCache('/admin/drivers');
    invalidateCache('/admin/drivers/pending');
    invalidateCache('/admin/stats');
    return fetchWithErrorHandling(`/admin/drivers/${driverId}/verify`, {
      method: 'PUT',
      body: JSON.stringify({ approve, reason }),
    }, null);
  },
  
  // Block/unblock driver
  blockDriver: async (driverId: string, block: boolean) => {
    invalidateCache('/admin/drivers');
    invalidateCache('/admin/stats');
    return fetchWithErrorHandling(`/admin/drivers/${driverId}/block`, {
      method: 'PUT',
      body: JSON.stringify({ block }),
    }, null);
  },
  
  // Passengers with pagination
  getPassengers: async (params: { page?: number; limit?: number; search?: string } = {}) => {
    const queryString = new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== '') as [string, string][]
    ).toString();
    const endpoint = queryString ? `/admin/passengers?${queryString}` : '/admin/passengers';
    return fetchWithErrorHandling(endpoint, {}, CACHE_TTL.MEDIUM);
  },
  
  // Block/unblock passenger
  blockPassenger: async (passengerId: string, block: boolean) => {
    invalidateCache('/admin/passengers');
    invalidateCache('/admin/stats');
    return fetchWithErrorHandling(`/admin/passengers/${passengerId}/block`, {
      method: 'PUT',
      body: JSON.stringify({ block }),
    }, null);
  },
  
  // Live rides (cached for 5 seconds)
  getLiveRides: async () => {
    return fetchWithErrorHandling('/admin/rides/live', {}, CACHE_TTL.SHORT);
  },
  
  // Settings (cached for 2 minutes)
  getSettings: async () => {
    return fetchWithErrorHandling('/admin/settings', {}, CACHE_TTL.LONG);
  },
  
  // Save settings
  saveSettings: async (settings: any) => {
    invalidateCache('/admin/settings');
    return fetchWithErrorHandling('/admin/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    }, null);
  },
  
  // Update credentials
  updateCredentials: async (credentials: { currentPassword: string; newEmail?: string; newPassword?: string }) => {
    return fetchWithErrorHandling('/admin/credentials', {
      method: 'PUT',
      body: JSON.stringify(credentials),
    }, null);
  },
  
  // Payments with pagination
  getPayments: async (params: { page?: number; limit?: number; status?: string; search?: string } = {}) => {
    const queryString = new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== '') as [string, string][]
    ).toString();
    const endpoint = queryString ? `/payments/admin/payments?${queryString}` : '/payments/admin/payments';
    return fetchWithErrorHandling(endpoint, {}, CACHE_TTL.MEDIUM);
  },
  
  // Payment summary
  getPaymentSummary: async () => {
    return fetchWithErrorHandling('/payments/admin/payments/summary', {}, CACHE_TTL.MEDIUM);
  },
  
  // Review payment
  reviewPayment: async (paymentId: string, status: 'paid' | 'rejected', adminNotes?: string) => {
    invalidateCache('/payments/admin/payments');
    invalidateCache('/payments/admin/payments/summary');
    return fetchWithErrorHandling(`/payments/admin/payments/${paymentId}/review`, {
      method: 'PUT',
      body: JSON.stringify({ status, adminNotes }),
    }, null);
  },
  
  // Feedback with pagination
  getFeedback: async (params: { page?: number; limit?: number; search?: string; category?: string } = {}) => {
    const queryString = new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== '') as [string, string][]
    ).toString();
    const endpoint = queryString ? `/admin/feedback?${queryString}` : '/admin/feedback';
    return fetchWithErrorHandling(endpoint, {}, CACHE_TTL.MEDIUM);
  },

  // Audit logs with pagination
  getAuditLogs: async (params: { page?: number; limit?: number; search?: string; action?: string } = {}) => {
    const queryString = new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== '') as [string, string][]
    ).toString();
    const endpoint = queryString ? `/admin/audit-logs?${queryString}` : '/admin/audit-logs';
    return fetchWithErrorHandling(endpoint, {}, CACHE_TTL.MEDIUM);
  },

  // SOS alerts with pagination
  getSOSAlerts: async (params: { limit?: number } = {}) => {
    const queryString = new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== '') as [string, string][]
    ).toString();
    const endpoint = queryString ? `/safety/sos/recent?${queryString}` : '/safety/sos/recent';
    return fetchWithErrorHandling(endpoint, {}, CACHE_TTL.SHORT);
  },

  // Resolve SOS alert
  resolveSOSAlert: async (id: string) => {
    return fetchWithErrorHandling(`/safety/sos/${id}/resolve`, { method: 'PUT' }, 0);
  },
};

export default adminApi;

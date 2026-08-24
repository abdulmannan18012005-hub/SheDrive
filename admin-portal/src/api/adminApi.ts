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

  // Support tickets with pagination
  getSupportTickets: async (params: { page?: number; limit?: number; search?: string; status?: string } = {}) => {
    const queryString = new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== '') as [string, string][]
    ).toString();
    const endpoint = queryString ? `/admin/support/tickets?${queryString}` : '/admin/support/tickets';
    return fetchWithErrorHandling(endpoint, {}, CACHE_TTL.MEDIUM);
  },

  // Update support ticket status
  updateTicketStatus: async (id: string, status: 'open' | 'in_progress' | 'resolved') => {
    invalidateCache('/admin/support/tickets');
    return fetchWithErrorHandling(`/admin/support/tickets/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }, 0);
  },

  // Deactivated accounts with pagination
  getDeactivatedAccounts: async (params: { page?: number; limit?: number; search?: string } = {}) => {
    const queryString = new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== '') as [string, string][]
    ).toString();
    const endpoint = queryString ? `/admin/users/deactivated?${queryString}` : '/admin/users/deactivated';
    return fetchWithErrorHandling(endpoint, {}, CACHE_TTL.LONG);
  },

  // Reactivate account
  reactivateAccount: async (id: string) => {
    invalidateCache('/admin/users/deactivated');
    return fetchWithErrorHandling(`/admin/users/${id}/reactivate`, { method: 'PUT' }, 0);
  },

  // Ride history with pagination and filters
  getRideHistory: async (params: { page?: number; limit?: number; status?: string; startDate?: string; endDate?: string } = {}) => {
    const queryString = new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== '') as [string, string][]
    ).toString();
    const endpoint = queryString ? `/admin/rides/history?${queryString}` : '/admin/rides/history';
    return fetchWithErrorHandling(endpoint, {}, CACHE_TTL.MEDIUM);
  },

  // Send admin notification
  sendAdminNotification: async (title: string, body: string, target: 'all' | 'drivers' | 'passengers' | 'specific', userId?: string) => {
    return fetchWithErrorHandling('/admin/notifications/send', {
      method: 'POST',
      body: JSON.stringify({ title, body, target, userId }),
    }, 0);
  },

  // Analytics - Executive Overview
  getAnalyticsOverview: async (params: { startDate?: number; endDate?: number; interval?: 'day' | 'week' | 'month' } = {}) => {
    const queryString = new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== '') as [string, string][]
    ).toString();
    const endpoint = queryString ? `/admin/analytics/overview?${queryString}` : '/admin/analytics/overview';
    return fetchWithErrorHandling(endpoint, {}, CACHE_TTL.MEDIUM);
  },

  // Analytics - Revenue Breakdown
  getRevenueAnalytics: async (params: { startDate?: number; endDate?: number } = {}) => {
    const queryString = new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== '') as [string, string][]
    ).toString();
    const endpoint = queryString ? `/admin/analytics/revenue?${queryString}` : '/admin/analytics/revenue';
    return fetchWithErrorHandling(endpoint, {}, CACHE_TTL.MEDIUM);
  },

  // Analytics - Rides & Demand
  getRideAnalytics: async (params: { startDate?: number; endDate?: number; category?: string; status?: string } = {}) => {
    const queryString = new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== '') as [string, string][]
    ).toString();
    const endpoint = queryString ? `/admin/analytics/rides?${queryString}` : '/admin/analytics/rides';
    return fetchWithErrorHandling(endpoint, {}, CACHE_TTL.MEDIUM);
  },

  // Analytics - Driver Performance
  getDriverAnalytics: async (params: { startDate?: number; endDate?: number; page?: number; limit?: number; sort?: string } = {}) => {
    const queryString = new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== '') as [string, string][]
    ).toString();
    const endpoint = queryString ? `/admin/analytics/drivers?${queryString}` : '/admin/analytics/drivers';
    return fetchWithErrorHandling(endpoint, {}, CACHE_TTL.MEDIUM);
  },

  // Analytics - Safety & Support
  getSafetySupportAnalytics: async (params: { startDate?: number; endDate?: number } = {}) => {
    const queryString = new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== '') as [string, string][]
    ).toString();
    const endpoint = queryString ? `/admin/analytics/safety-support?${queryString}` : '/admin/analytics/safety-support';
    return fetchWithErrorHandling(endpoint, {}, CACHE_TTL.MEDIUM);
  },

  // Analytics - Download CSV Report
  downloadReportCSV: async (params: { type: 'financial' | 'rides' | 'drivers' | 'safety'; startDate?: number; endDate?: number }) => {
    const token = getAuthToken();
    const queryString = new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== '') as [string, string][]
    ).toString();
    const endpoint = `${API_BASE_URL}/admin/analytics/export?${queryString}`;
    
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.error || `HTTP ${response.status}: Failed to download CSV report`);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shedrive_${params.type}_report_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    return true;
  },

  // ────────── Phase 9: Operational Reliability & Compliance ──────────

  // Deep System Health & Infrastructure Diagnostics
  getDeepHealth: async () => {
    return fetchWithErrorHandling('/admin/system/health-deep', {}, CACHE_TTL.SHORT);
  },

  // Compliance - Expiry List
  getComplianceExpiries: async (params: { status?: string; page?: number; limit?: number } = {}) => {
    const queryString = new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== '') as [string, string][]
    ).toString();
    const endpoint = queryString ? `/admin/compliance/expiries?${queryString}` : '/admin/compliance/expiries';
    return fetchWithErrorHandling(endpoint, {}, CACHE_TTL.MEDIUM);
  },

  // Compliance - Scan
  runComplianceScan: async () => {
    invalidateCache('/admin/compliance');
    return fetchWithErrorHandling('/admin/compliance/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
  },

  // Disputes - List
  getDisputes: async (params: { status?: string; page?: number; limit?: number } = {}) => {
    const queryString = new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== '') as [string, string][]
    ).toString();
    const endpoint = queryString ? `/admin/disputes?${queryString}` : '/admin/disputes';
    return fetchWithErrorHandling(endpoint, {}, CACHE_TTL.SHORT);
  },

  // Disputes - Resolve
  resolveDispute: async (id: string, body: { resolutionNotes: string; actionTaken: string; adjustmentAmount?: number }) => {
    invalidateCache('/admin/disputes');
    return fetchWithErrorHandling(`/admin/disputes/${id}/resolve`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },

  // SOS Investigation
  investigateSOS: async (id: string, body: { resolutionNotes: string; severity: string; policeContacted: boolean }) => {
    invalidateCache('/admin/safety');
    invalidateCache('/safety');
    return fetchWithErrorHandling(`/safety/sos/${id}/investigate`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },

  // Issue User Warning
  issueUserWarning: async (userId: string, body: { warningType: string; message: string }) => {
    return fetchWithErrorHandling(`/admin/users/${userId}/warn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },

  // Phase 10: Passenger Payment Transactions
  getPassengerTransactions: async (params: { provider?: string; status?: string; page?: number; limit?: number } = {}) => {
    const queryString = new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== '') as [string, string][]
    ).toString();
    const endpoint = queryString ? `/admin/payments/transactions?${queryString}` : '/admin/payments/transactions';
    return fetchWithErrorHandling(endpoint, {}, CACHE_TTL.SHORT);
  },

  // Phase 10: Scheduled Rides Query
  getScheduledRides: async () => {
    return fetchWithErrorHandling('/rides/scheduled', {}, CACHE_TTL.SHORT);
  },
};

export default adminApi;

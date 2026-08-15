import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes before expiry

interface SessionData {
  token: string;
  refreshToken?: string;
  lastActivity: number;
  tokenExpiry?: number;
  deviceId: string;
}

class SessionManager {
  private static instance: SessionManager;
  private sessionTimeout: NodeJS.Timeout | null = null;
  private tokenRefreshInterval: NodeJS.Timeout | null = null;
  private onSessionTimeout: (() => void) | null = null;
  private onTokenRefresh: ((newToken: string) => void) | null = null;

  private constructor() {
    this.initializeDeviceId();
  }

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  private async initializeDeviceId(): Promise<void> {
    let deviceId = await AsyncStorage.getItem('device_id');
    if (!deviceId) {
      deviceId = this.generateDeviceId();
      await AsyncStorage.setItem('device_id', deviceId);
    }
  }

  private generateDeviceId(): string {
    return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async getDeviceId(): Promise<string> {
    let deviceId = await AsyncStorage.getItem('device_id');
    if (!deviceId) {
      deviceId = this.generateDeviceId();
      await AsyncStorage.setItem('device_id', deviceId);
    }
    return deviceId;
  }

  async saveSession(
    token: string,
    refreshToken?: string,
    tokenExpiry?: number,
    rememberMe: boolean = false
  ): Promise<void> {
    const deviceId = await this.getDeviceId();
    const sessionData: SessionData = {
      token,
      refreshToken,
      lastActivity: Date.now(),
      tokenExpiry,
      deviceId,
    };

    await AsyncStorage.setItem('user_session', JSON.stringify(sessionData));
    
    if (rememberMe) {
      await AsyncStorage.setItem('remember_me', 'true');
    } else {
      await AsyncStorage.removeItem('remember_me');
    }

    this.startSessionMonitoring();
  }

  async getSession(): Promise<SessionData | null> {
    const sessionJson = await AsyncStorage.getItem('user_session');
    if (!sessionJson) return null;

    try {
      const sessionData: SessionData = JSON.parse(sessionJson);
      
      // Check if session has expired
      if (this.isSessionExpired(sessionData)) {
        await this.clearSession();
        return null;
      }

      return sessionData;
    } catch (error) {
      console.error('Error parsing session data:', error);
      return null;
    }
  }

  async updateLastActivity(): Promise<void> {
    const session = await this.getSession();
    if (session) {
      session.lastActivity = Date.now();
      await AsyncStorage.setItem('user_session', JSON.stringify(session));
    }
  }

  private isSessionExpired(session: SessionData): boolean {
    const now = Date.now();
    const timeSinceActivity = now - session.lastActivity;
    return timeSinceActivity > SESSION_TIMEOUT_MS;
  }

  private isTokenExpiringSoon(session: SessionData): boolean {
    if (!session.tokenExpiry) return false;
    const now = Date.now();
    const timeUntilExpiry = session.tokenExpiry - now;
    return timeUntilExpiry < TOKEN_REFRESH_THRESHOLD_MS;
  }

  async clearSession(): Promise<void> {
    await AsyncStorage.removeItem('user_session');
    await AsyncStorage.removeItem('remember_me');
    this.stopSessionMonitoring();
  }

  startSessionMonitoring(): void {
    this.stopSessionMonitoring();

    // Check for session timeout every minute
    this.sessionTimeout = setInterval(async () => {
      const session = await this.getSession();
      if (!session) {
        this.stopSessionMonitoring();
        return;
      }

      if (this.isSessionExpired(session)) {
        this.stopSessionMonitoring();
        await this.clearSession();
        if (this.onSessionTimeout) {
          this.onSessionTimeout();
        }
      }
    }, 60 * 1000); // Check every minute

    // Check for token refresh every 5 minutes
    this.tokenRefreshInterval = setInterval(async () => {
      const session = await this.getSession();
      if (!session || !session.refreshToken) return;

      if (this.isTokenExpiringSoon(session)) {
        if (this.onTokenRefresh) {
          const newToken = await this.refreshToken(session.refreshToken);
          if (newToken) {
            this.onTokenRefresh(newToken);
          }
        }
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
  }

  stopSessionMonitoring(): void {
    if (this.sessionTimeout) {
      clearInterval(this.sessionTimeout);
      this.sessionTimeout = null;
    }
    if (this.tokenRefreshInterval) {
      clearInterval(this.tokenRefreshInterval);
      this.tokenRefreshInterval = null;
    }
  }

  async refreshToken(refreshToken: string): Promise<string | null> {
    try {
      const response = await fetch('https://your-api.com/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        const newToken = data.token;
        const newExpiry = data.expiresAt;
        
        await this.saveSession(newToken, refreshToken, newExpiry, await this.isRememberMeEnabled());
        return newToken;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }
    return null;
  }

  async isRememberMeEnabled(): Promise<boolean> {
    const rememberMe = await AsyncStorage.getItem('remember_me');
    return rememberMe === 'true';
  }

  async logoutAllDevices(userId: string): Promise<boolean> {
    try {
      const response = await fetch('https://your-api.com/auth/logout-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await this.getCurrentToken()}`,
        },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        await this.clearSession();
        return true;
      }
    } catch (error) {
      console.error('Logout all devices failed:', error);
    }
    return false;
  }

  async getCurrentToken(): Promise<string | null> {
    const session = await this.getSession();
    return session?.token || null;
  }

  setSessionTimeoutCallback(callback: () => void): void {
    this.onSessionTimeout = callback;
  }

  setTokenRefreshCallback(callback: (newToken: string) => void): void {
    this.onTokenRefresh = callback;
  }

  async autoLogin(): Promise<{ token: string; user: any } | null> {
    const rememberMe = await this.isRememberMeEnabled();
    if (!rememberMe) return null;

    const session = await this.getSession();
    if (!session) return null;

    // If session is still valid, return the token
    if (!this.isSessionExpired(session)) {
      return { token: session.token, user: null }; // User data would need to be fetched separately
    }

    return null;
  }
}

export default SessionManager.getInstance();

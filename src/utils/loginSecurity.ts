import AsyncStorage from '@react-native-async-storage/async-storage';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_INCREMENT_MS = 15 * 60 * 1000; // Additional 15 minutes per lockout

interface LoginAttemptData {
  attempts: number;
  lastAttemptTime: number;
  lockoutUntil: number | null;
  consecutiveLockouts: number;
}

class LoginSecurity {
  private static instance: LoginSecurity;

  private constructor() {}

  static getInstance(): LoginSecurity {
    if (!LoginSecurity.instance) {
      LoginSecurity.instance = new LoginSecurity();
    }
    return LoginSecurity.instance;
  }

  private async getLoginData(email: string): Promise<LoginAttemptData> {
    const key = `login_attempts_${email.toLowerCase()}`;
    const data = await AsyncStorage.getItem(key);
    
    if (!data) {
      return {
        attempts: 0,
        lastAttemptTime: 0,
        lockoutUntil: null,
        consecutiveLockouts: 0,
      };
    }

    try {
      return JSON.parse(data);
    } catch {
      return {
        attempts: 0,
        lastAttemptTime: 0,
        lockoutUntil: null,
        consecutiveLockouts: 0,
      };
    }
  }

  private async saveLoginData(email: string, data: LoginAttemptData): Promise<void> {
    const key = `login_attempts_${email.toLowerCase()}`;
    await AsyncStorage.setItem(key, JSON.stringify(data));
  }

  async isLockedOut(email: string): Promise<{ locked: boolean; remainingTime?: number }> {
    const data = await this.getLoginData(email);
    
    if (!data.lockoutUntil) {
      return { locked: false };
    }

    const now = Date.now();
    if (now >= data.lockoutUntil) {
      // Lockout has expired, reset
      await this.resetAttempts(email);
      return { locked: false };
    }

    const remainingTime = data.lockoutUntil - now;
    return { locked: true, remainingTime };
  }

  async recordFailedAttempt(email: string): Promise<void> {
    const data = await this.getLoginData(email);
    const now = Date.now();

    data.attempts += 1;
    data.lastAttemptTime = now;

    // Check if max attempts reached
    if (data.attempts >= MAX_LOGIN_ATTEMPTS) {
      data.consecutiveLockouts += 1;
      const lockoutDuration = LOCKOUT_DURATION_MS + (data.consecutiveLockouts - 1) * LOCKOUT_INCREMENT_MS;
      data.lockoutUntil = now + lockoutDuration;
    }

    await this.saveLoginData(email, data);
  }

  async recordSuccessfulLogin(email: string): Promise<void> {
    await this.resetAttempts(email);
  }

  async resetAttempts(email: string): Promise<void> {
    const key = `login_attempts_${email.toLowerCase()}`;
    await AsyncStorage.removeItem(key);
  }

  async getRemainingAttempts(email: string): Promise<number> {
    const data = await this.getLoginData(email);
    return Math.max(0, MAX_LOGIN_ATTEMPTS - data.attempts);
  }

  async getLockoutEndTime(email: string): Promise<number | null> {
    const data = await this.getLoginData(email);
    return data.lockoutUntil;
  }

  formatRemainingTime(ms: number): string {
    const minutes = Math.floor(ms / (60 * 1000));
    const seconds = Math.floor((ms % (60 * 1000)) / 1000);
    
    if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''} ${seconds} second${seconds !== 1 ? 's' : ''}`;
    }
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  }

  async clearAllLoginData(): Promise<void> {
    const keys = await AsyncStorage.getAllKeys();
    const loginKeys = keys.filter(key => key.startsWith('login_attempts_'));
    await AsyncStorage.multiRemove(loginKeys);
  }
}

export default LoginSecurity.getInstance();

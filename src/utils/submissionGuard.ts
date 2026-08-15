import React from 'react';

interface SubmissionRecord {
  timestamp: number;
  actionId: string;
}

class SubmissionGuard {
  private static instance: SubmissionGuard;
  private submissions: Map<string, SubmissionRecord> = new Map();
  private readonly DEBOUNCE_MS = 2000; // 2 seconds
  private readonly MAX_RECORDS = 100;

  private constructor() {
    // Clean up old records periodically
    setInterval(() => this.cleanupOldRecords(), 60000); // Every minute
  }

  static getInstance(): SubmissionGuard {
    if (!SubmissionGuard.instance) {
      SubmissionGuard.instance = new SubmissionGuard();
    }
    return SubmissionGuard.instance;
  }

  /**
   * Check if an action can be submitted (not a duplicate)
   * @param actionId Unique identifier for the action (e.g., 'ride_booking', 'profile_update')
   * @param uniqueKey Optional unique key for specific instance (e.g., ride ID, user ID)
   * @returns true if submission is allowed, false if it's a duplicate
   */
  canSubmit(actionId: string, uniqueKey?: string): boolean {
    const key = this.generateKey(actionId, uniqueKey);
    const now = Date.now();
    const record = this.submissions.get(key);

    if (!record) {
      // First submission
      this.submissions.set(key, { timestamp: now, actionId });
      return true;
    }

    // Check if enough time has passed
    if (now - record.timestamp < this.DEBOUNCE_MS) {
      return false;
    }

    // Update record
    this.submissions.set(key, { timestamp: now, actionId });
    return true;
  }

  /**
   * Mark an action as submitted (useful for async operations)
   * @param actionId Unique identifier for the action
   * @param uniqueKey Optional unique key for specific instance
   */
  markSubmitted(actionId: string, uniqueKey?: string): void {
    const key = this.generateKey(actionId, uniqueKey);
    this.submissions.set(key, {
      timestamp: Date.now(),
      actionId,
    });
  }

  /**
   * Clear a specific submission record
   * @param actionId Unique identifier for the action
   * @param uniqueKey Optional unique key for specific instance
   */
  clearSubmission(actionId: string, uniqueKey?: string): void {
    const key = this.generateKey(actionId, uniqueKey);
    this.submissions.delete(key);
  }

  /**
   * Clear all submission records for a specific action type
   * @param actionId Unique identifier for the action
   */
  clearActionSubmissions(actionId: string): void {
    const keysToDelete: string[] = [];
    this.submissions.forEach((record, key) => {
      if (record.actionId === actionId) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.submissions.delete(key));
  }

  /**
   * Clear all submission records
   */
  clearAll(): void {
    this.submissions.clear();
  }

  /**
   * Get time remaining before a submission is allowed again
   * @param actionId Unique identifier for the action
   * @param uniqueKey Optional unique key for specific instance
   * @returns Remaining time in milliseconds, or 0 if submission is allowed
   */
  getTimeRemaining(actionId: string, uniqueKey?: string): number {
    const key = this.generateKey(actionId, uniqueKey);
    const record = this.submissions.get(key);

    if (!record) {
      return 0;
    }

    const elapsed = Date.now() - record.timestamp;
    const remaining = this.DEBOUNCE_MS - elapsed;
    return Math.max(0, remaining);
  }

  private generateKey(actionId: string, uniqueKey?: string): string {
    return uniqueKey ? `${actionId}:${uniqueKey}` : actionId;
  }

  private cleanupOldRecords(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    this.submissions.forEach((record, key) => {
      // Remove records older than 5 minutes
      if (now - record.timestamp > 300000) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.submissions.delete(key));

    // If we have too many records, remove the oldest ones
    if (this.submissions.size > this.MAX_RECORDS) {
      const entries = Array.from(this.submissions.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = entries.slice(0, entries.length - this.MAX_RECORDS);
      toRemove.forEach(([key]) => this.submissions.delete(key));
    }
  }

  /**
   * React hook for preventing duplicate submissions
   * @param actionId Unique identifier for the action
   * @param uniqueKey Optional unique key for specific instance
   * @returns Object with isSubmitting and submit function
   */
  static useSubmissionGuard(actionId: string, uniqueKey?: string) {
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const guard = SubmissionGuard.getInstance();

    const submit = async <T,>(
      action: () => Promise<T>,
      onSuccess?: (result: T) => void,
      onError?: (error: Error) => void
    ): Promise<T | null> => {
      if (isSubmitting) {
        return null;
      }

      if (!guard.canSubmit(actionId, uniqueKey)) {
        const remaining = guard.getTimeRemaining(actionId, uniqueKey);
        console.warn(`Submission blocked for ${actionId}. Wait ${remaining}ms.`);
        return null;
      }

      setIsSubmitting(true);

      try {
        const result = await action();
        onSuccess?.(result);
        return result;
      } catch (error) {
        onError?.(error as Error);
        throw error;
      } finally {
        setIsSubmitting(false);
      }
    };

    return { isSubmitting, submit };
  }
}

export default SubmissionGuard.getInstance();

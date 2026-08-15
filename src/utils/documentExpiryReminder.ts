import AsyncStorage from '@react-native-async-storage/async-storage';

export interface DocumentExpiry {
  documentType: 'driving_license' | 'vehicle_registration' | 'insurance';
  expiryDate: number; // Timestamp
  documentNumber?: string;
  userId: string;
}

export interface ExpiryAlert {
  documentType: string;
  documentNumber?: string;
  expiryDate: number;
  daysUntilExpiry: number;
  severity: 'critical' | 'warning' | 'info';
}

const WARNING_DAYS = 30; // 30 days before expiry
const CRITICAL_DAYS = 7; // 7 days before expiry

class DocumentExpiryReminder {
  private static instance: DocumentExpiryReminder;
  private readonly STORAGE_KEY = 'document_expiry_records';

  private constructor() {}

  static getInstance(): DocumentExpiryReminder {
    if (!DocumentExpiryReminder.instance) {
      DocumentExpiryReminder.instance = new DocumentExpiryReminder();
    }
    return DocumentExpiryReminder.instance;
  }

  /**
   * Store document expiry information
   */
  async saveDocumentExpiry(document: DocumentExpiry): Promise<void> {
    const records = await this.getAllRecords();
    const key = this.generateKey(document.userId, document.documentType);
    
    records[key] = document;
    await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(records));
  }

  /**
   * Get all stored document expiry records
   */
  private async getAllRecords(): Promise<Record<string, DocumentExpiry>> {
    const data = await AsyncStorage.getItem(this.STORAGE_KEY);
    if (!data) return {};
    
    try {
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  /**
   * Get document expiry for a specific user and document type
   */
  async getDocumentExpiry(
    userId: string,
    documentType: DocumentExpiry['documentType']
  ): Promise<DocumentExpiry | null> {
    const records = await this.getAllRecords();
    const key = this.generateKey(userId, documentType);
    return records[key] || null;
  }

  /**
   * Get all documents for a user
   */
  async getUserDocuments(userId: string): Promise<DocumentExpiry[]> {
    const records = await this.getAllRecords();
    const userDocuments: DocumentExpiry[] = [];
    
    Object.entries(records).forEach(([key, document]) => {
      if (document.userId === userId) {
        userDocuments.push(document);
      }
    });
    
    return userDocuments;
  }

  /**
   * Check for documents expiring soon
   */
  async checkExpiringDocuments(userId: string): Promise<ExpiryAlert[]> {
    const documents = await this.getUserDocuments(userId);
    const alerts: ExpiryAlert[] = [];
    const now = Date.now();
    
    documents.forEach((doc) => {
      const daysUntilExpiry = Math.ceil((doc.expiryDate - now) / (1000 * 60 * 60 * 24));
      
      if (daysUntilExpiry <= CRITICAL_DAYS && daysUntilExpiry > 0) {
        alerts.push({
          documentType: this.formatDocumentType(doc.documentType),
          documentNumber: doc.documentNumber,
          expiryDate: doc.expiryDate,
          daysUntilExpiry,
          severity: 'critical',
        });
      } else if (daysUntilExpiry <= WARNING_DAYS && daysUntilExpiry > CRITICAL_DAYS) {
        alerts.push({
          documentType: this.formatDocumentType(doc.documentType),
          documentNumber: doc.documentNumber,
          expiryDate: doc.expiryDate,
          daysUntilExpiry,
          severity: 'warning',
        });
      } else if (daysUntilExpiry <= 0) {
        alerts.push({
          documentType: this.formatDocumentType(doc.documentType),
          documentNumber: doc.documentNumber,
          expiryDate: doc.expiryDate,
          daysUntilExpiry,
          severity: 'critical',
        });
      }
    });
    
    // Sort by severity and days until expiry
    alerts.sort((a, b) => {
      if (a.severity !== b.severity) {
        return a.severity === 'critical' ? -1 : 1;
      }
      return a.daysUntilExpiry - b.daysUntilExpiry;
    });
    
    return alerts;
  }

  /**
   * Check if any document is expired
   */
  async hasExpiredDocuments(userId: string): Promise<boolean> {
    const alerts = await this.checkExpiringDocuments(userId);
    return alerts.some(alert => alert.daysUntilExpiry <= 0);
  }

  /**
   * Delete document expiry record
   */
  async deleteDocumentExpiry(
    userId: string,
    documentType: DocumentExpiry['documentType']
  ): Promise<void> {
    const records = await this.getAllRecords();
    const key = this.generateKey(userId, documentType);
    delete records[key];
    await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(records));
  }

  /**
   * Delete all documents for a user
   */
  async deleteUserDocuments(userId: string): Promise<void> {
    const records = await this.getAllRecords();
    const keysToDelete: string[] = [];
    
    Object.entries(records).forEach(([key, document]) => {
      if (document.userId === userId) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => delete records[key]);
    await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(records));
  }

  /**
   * Calculate profile completion based on document expiry dates
   */
  async calculateDocumentCompletion(userId: string): Promise<number> {
    const documents = await this.getUserDocuments(userId);
    const requiredDocuments = ['driving_license', 'vehicle_registration'];
    const optionalDocuments = ['insurance'];
    
    let completed = 0;
    const total = requiredDocuments.length + optionalDocuments.length;
    
    requiredDocuments.forEach((docType) => {
      const doc = documents.find(d => d.documentType === docType);
      if (doc && doc.expiryDate > Date.now()) {
        completed++;
      }
    });
    
    optionalDocuments.forEach((docType) => {
      const doc = documents.find(d => d.documentType === docType);
      if (doc && doc.expiryDate > Date.now()) {
        completed++;
      }
    });
    
    return Math.round((completed / total) * 100);
  }

  /**
   * Generate notification message for expiring document
   */
  generateNotificationMessage(alert: ExpiryAlert): string {
    const docName = alert.documentType;
    
    if (alert.daysUntilExpiry <= 0) {
      return `Your ${docName} has expired. Please renew it immediately to continue driving.`;
    } else if (alert.daysUntilExpiry === 1) {
      return `Your ${docName} expires tomorrow. Please renew it soon.`;
    } else {
      return `Your ${docName} expires in ${alert.daysUntilExpiry} days. Please renew it before expiry.`;
    }
  }

  /**
   * Format document type for display
   */
  private formatDocumentType(type: DocumentExpiry['documentType']): string {
    switch (type) {
      case 'driving_license':
        return 'Driving License';
      case 'vehicle_registration':
        return 'Vehicle Registration';
      case 'insurance':
        return 'Insurance';
      default:
        return 'Document';
    }
  }

  /**
   * Generate storage key
   */
  private generateKey(userId: string, documentType: DocumentExpiry['documentType']): string {
    return `${userId}_${documentType}`;
  }

  /**
   * Parse date string to timestamp
   */
  parseDateToTimestamp(dateString: string): number {
    const date = new Date(dateString);
    return date.getTime();
  }

  /**
   * Format timestamp to readable date
   */
  formatTimestampToDate(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  /**
   * Get days remaining until expiry
   */
  getDaysRemaining(expiryDate: number): number {
    const now = Date.now();
    return Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
  }
}

export default DocumentExpiryReminder.getInstance();

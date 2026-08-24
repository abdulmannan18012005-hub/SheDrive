import { query } from '../../config/db';

export type PaymentProvider = 'cash' | 'jazzcash' | 'easypaisa';

export type TransactionStatus = 'pending' | 'pending_user_auth' | 'success' | 'failed' | 'refunded';

export interface PaymentInitiateRequest {
  rideId: string;
  userId: string;
  amount: number;
  currency?: string;
  provider: PaymentProvider;
  mobileAccountNo?: string;
  customerEmail?: string;
  idempotencyKey?: string;
}

export interface PaymentInitiateResult {
  success: boolean;
  transactionId: string;
  status: TransactionStatus;
  provider: PaymentProvider;
  amount: number;
  currency: string;
  message: string;
  gatewayRef?: string;
  redirectUrl?: string;
  isSandbox: boolean;
}

export interface PaymentVerifyResult {
  success: boolean;
  transactionId: string;
  status: TransactionStatus;
  provider: PaymentProvider;
  amount: number;
  message: string;
}

export interface IPaymentGateway {
  initiatePayment(req: PaymentInitiateRequest): Promise<PaymentInitiateResult>;
  verifyPayment(transactionId: string): Promise<PaymentVerifyResult>;
  handleWebhook(payload: any, headers?: any): Promise<{ success: boolean; transactionId: string; status: TransactionStatus; rawStatus?: string; message: string }>;
  refundPayment(transactionId: string, amount: number, reason: string): Promise<{ success: boolean; refundRef?: string; message: string }>;
}

import { CashGateway } from './cashGateway';
import { JazzCashGateway } from './jazzCashGateway';
import { EasypaisaGateway } from './easypaisaGateway';

const cashGateway = new CashGateway();
const jazzCashGateway = new JazzCashGateway();
const easypaisaGateway = new EasypaisaGateway();

export function getPaymentGateway(provider: PaymentProvider): IPaymentGateway {
  switch (provider) {
    case 'cash':
      return cashGateway;
    case 'jazzcash':
      return jazzCashGateway;
    case 'easypaisa':
      return easypaisaGateway;
    default:
      throw new Error(`Unsupported payment provider: ${provider}`);
  }
}

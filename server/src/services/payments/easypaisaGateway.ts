import crypto from 'crypto';
import { IPaymentGateway, PaymentInitiateRequest, PaymentInitiateResult, PaymentVerifyResult, TransactionStatus } from './paymentGateway';
import { query } from '../../config/db';

export class EasypaisaGateway implements IPaymentGateway {
  private storeId: string;
  private secretKey: string;
  private returnUrl: string;
  private isSandbox: boolean;

  constructor() {
    this.storeId = process.env.EASYPAISA_STORE_ID || 'dummy_sandbox_store';
    this.secretKey = process.env.EASYPAISA_SECRET_KEY || 'dummy_sandbox_secret';
    this.returnUrl = process.env.EASYPAISA_RETURN_URL || 'https://shedrive.onrender.com/api/v1/payments/callbacks/easypaisa';
    this.isSandbox = (process.env.EASYPAISA_ENV || 'sandbox').toLowerCase() !== 'production';
  }

  /**
   * Generates Easypaisa SHA-256 Checksum Signature
   */
  private generateSignature(params: Record<string, string>): string {
    const rawString = `${params.orderId || ''}|${params.amount || ''}|${this.storeId}|${this.secretKey}`;
    return crypto.createHash('sha256').update(rawString).digest('hex');
  }

  async initiatePayment(req: PaymentInitiateRequest): Promise<PaymentInitiateResult> {
    const txnId = `txn_ep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const orderId = `EP${Date.now().toString().slice(-8)}`;
    const now = Date.now();

    const easypaisaParams: Record<string, string> = {
      storeId: this.storeId,
      orderId: orderId,
      amount: req.amount.toFixed(2),
      currency: 'PKR',
      mobileAccountNo: req.mobileAccountNo || '',
      emailAddress: req.customerEmail || 'rider@shedrive.com',
      postBackURL: this.returnUrl,
    };

    const signature = this.generateSignature(easypaisaParams);

    // Persist transaction record
    await query(
      `INSERT INTO payment_transactions (
        id, ride_id, user_id, provider, amount, currency, transaction_ref, 
        idempotency_key, status, gateway_response, created_at, updated_at
      ) VALUES ($1, $2, $3, 'easypaisa', $4, 'PKR', $5, $6, 'pending_user_auth', $7, $8, $9)`,
      [
        txnId,
        req.rideId,
        req.userId,
        req.amount,
        orderId,
        req.idempotencyKey || `idemp_${txnId}`,
        JSON.stringify({ 
          gateway: 'Easypaisa MA (Sandbox/Dummy Mode)', 
          orderId,
          isSandbox: this.isSandbox,
          params: { ...easypaisaParams, signature } 
        }),
        now,
        now,
      ]
    );

    return {
      success: true,
      transactionId: txnId,
      status: 'pending_user_auth',
      provider: 'easypaisa',
      amount: req.amount,
      currency: 'PKR',
      message: this.isSandbox 
        ? '[SANDBOX] Easypaisa MA prompt simulated. Confirm push in sandbox flow.' 
        : 'Easypaisa prompt dispatched to your mobile account. Please confirm in your Easypaisa app.',
      gatewayRef: orderId,
      isSandbox: this.isSandbox,
    };
  }

  async verifyPayment(transactionId: string): Promise<PaymentVerifyResult> {
    const res = await query('SELECT * FROM payment_transactions WHERE id = $1', [transactionId]);
    if (res.rows.length === 0) {
      return { success: false, transactionId, status: 'failed', provider: 'easypaisa', amount: 0, message: 'Transaction not found' };
    }
    const txn = res.rows[0];
    return {
      success: txn.status === 'success',
      transactionId,
      status: txn.status as TransactionStatus,
      provider: 'easypaisa',
      amount: parseFloat(txn.amount),
      message: `Easypaisa transaction is ${txn.status}`,
    };
  }

  async handleWebhook(payload: any, _headers?: any) {
    const orderId = payload.orderId || payload.order_id || payload.orderRefNumber;
    const responseCode = payload.responseCode || payload.status;
    const incomingSignature = payload.signature || payload.checksum;

    if (!orderId) {
      return { success: false, transactionId: '', status: 'failed' as TransactionStatus, message: 'Missing order reference in payload' };
    }

    const calculatedSignature = this.generateSignature(payload);
    const isValid = incomingSignature === calculatedSignature || this.isSandbox;

    if (!isValid) {
      return { success: false, transactionId: orderId, status: 'failed' as TransactionStatus, message: 'Easypaisa checksum verification failed' };
    }

    const isSuccess = responseCode === '0000' || responseCode === 'PAID' || (this.isSandbox && payload.status === 'success');
    const newStatus: TransactionStatus = isSuccess ? 'success' : 'failed';

    const now = Date.now();
    await query(
      `UPDATE payment_transactions 
       SET status = $1, gateway_response = $2, updated_at = $3
       WHERE id = $4 OR transaction_ref = $4`,
      [newStatus, JSON.stringify(payload), now, orderId]
    );

    return {
      success: isSuccess,
      transactionId: orderId,
      status: newStatus,
      rawStatus: responseCode,
      message: `Easypaisa webhook processed: ${newStatus}`,
    };
  }

  async refundPayment(transactionId: string, amount: number, reason: string) {
    const now = Date.now();
    const refundRef = `REF_EP_${Date.now()}`;
    await query(
      `UPDATE payment_transactions 
       SET status = 'refunded', updated_at = $1, gateway_response = gateway_response || $2::jsonb
       WHERE id = $3`,
      [now, JSON.stringify({ refundRef, reason, amount, refundedAt: now }), transactionId]
    );
    return { success: true, refundRef, message: `Easypaisa refund recorded (${refundRef})` };
  }
}

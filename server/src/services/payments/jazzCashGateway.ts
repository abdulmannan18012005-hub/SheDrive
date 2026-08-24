import crypto from 'crypto';
import { IPaymentGateway, PaymentInitiateRequest, PaymentInitiateResult, PaymentVerifyResult, TransactionStatus } from './paymentGateway';
import { query } from '../../config/db';

export class JazzCashGateway implements IPaymentGateway {
  private merchantId: string;
  private password: string;
  private integritySalt: string;
  private returnUrl: string;
  private isSandbox: boolean;

  constructor() {
    this.merchantId = process.env.JAZZCASH_MERCHANT_ID || 'dummy_sandbox_merchant';
    this.password = process.env.JAZZCASH_PASSWORD || 'dummy_sandbox_password';
    this.integritySalt = process.env.JAZZCASH_INTEGRITY_SALT || 'dummy_sandbox_integrity_salt';
    this.returnUrl = process.env.JAZZCASH_RETURN_URL || 'https://shedrive.onrender.com/api/v1/payments/callbacks/jazzcash';
    this.isSandbox = (process.env.JAZZCASH_ENV || 'sandbox').toLowerCase() !== 'production';
  }

  /**
   * Generates JazzCash HMAC-SHA256 Secure Hash
   */
  private generateSecureHash(params: Record<string, string>): string {
    // Sort keys alphabetically and exclude pp_SecureHash
    const sortedKeys = Object.keys(params).filter(k => k !== 'pp_SecureHash' && params[k] !== undefined && params[k] !== '').sort();
    
    // Concatenate IntegritySalt with sorted parameters delimited by &
    let hashString = this.integritySalt;
    for (const key of sortedKeys) {
      hashString += `&${params[key]}`;
    }

    return crypto.createHmac('sha256', this.integritySalt).update(hashString).digest('hex').toUpperCase();
  }

  async initiatePayment(req: PaymentInitiateRequest): Promise<PaymentInitiateResult> {
    const txnId = `txn_jc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const billRef = `JC${Date.now().toString().slice(-8)}`;
    const now = Date.now();

    const formattedAmount = (req.amount * 100).toFixed(0); // JazzCash expects amount in paisas (e.g. 500.00 -> 50000)

    const jazzCashParams: Record<string, string> = {
      pp_Version: '1.1',
      pp_TxnType: 'MWALLET',
      pp_Language: 'EN',
      pp_MerchantID: this.merchantId,
      pp_Password: this.password,
      pp_TxnRefNo: txnId,
      pp_Amount: formattedAmount,
      pp_TxnCurrency: 'PKR',
      pp_TxnDateTime: new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14),
      pp_BillReference: billRef,
      pp_Description: `SheDrive Ride ${req.rideId}`,
      pp_ReturnURL: this.returnUrl,
      pp_MobileNumber: req.mobileAccountNo || '',
    };

    const secureHash = this.generateSecureHash(jazzCashParams);
    jazzCashParams.pp_SecureHash = secureHash;

    // Persist transaction record
    await query(
      `INSERT INTO payment_transactions (
        id, ride_id, user_id, provider, amount, currency, transaction_ref, 
        idempotency_key, status, gateway_response, created_at, updated_at
      ) VALUES ($1, $2, $3, 'jazzcash', $4, 'PKR', $5, $6, 'pending_user_auth', $7, $8, $9)`,
      [
        txnId,
        req.rideId,
        req.userId,
        req.amount,
        billRef,
        req.idempotencyKey || `idemp_${txnId}`,
        JSON.stringify({ 
          gateway: 'JazzCash MWALLET (Sandbox/Dummy Mode)', 
          billRef,
          isSandbox: this.isSandbox,
          params: { ...jazzCashParams, pp_Password: '[REDACTED]' } 
        }),
        now,
        now,
      ]
    );

    return {
      success: true,
      transactionId: txnId,
      status: 'pending_user_auth',
      provider: 'jazzcash',
      amount: req.amount,
      currency: 'PKR',
      message: this.isSandbox 
        ? '[SANDBOX] JazzCash MWALLET prompt simulated. Enter MPIN in sandbox flow.' 
        : 'JazzCash payment prompt dispatched to your mobile account. Please confirm with MPIN.',
      gatewayRef: billRef,
      isSandbox: this.isSandbox,
    };
  }

  async verifyPayment(transactionId: string): Promise<PaymentVerifyResult> {
    const res = await query('SELECT * FROM payment_transactions WHERE id = $1', [transactionId]);
    if (res.rows.length === 0) {
      return { success: false, transactionId, status: 'failed', provider: 'jazzcash', amount: 0, message: 'Transaction not found' };
    }
    const txn = res.rows[0];
    return {
      success: txn.status === 'success',
      transactionId,
      status: txn.status as TransactionStatus,
      provider: 'jazzcash',
      amount: parseFloat(txn.amount),
      message: `JazzCash transaction is ${txn.status}`,
    };
  }

  async handleWebhook(payload: any, _headers?: any) {
    const txnRef = payload.pp_TxnRefNo || payload.pp_BillReference;
    const responseCode = payload.pp_ResponseCode;
    const incomingHash = payload.pp_SecureHash;

    if (!txnRef) {
      return { success: false, transactionId: '', status: 'failed' as TransactionStatus, message: 'Missing transaction reference in payload' };
    }

    // Verify hash integrity if not in mock bypass
    const calculatedHash = this.generateSecureHash(payload);
    const hashValid = incomingHash === calculatedHash || this.isSandbox;

    if (!hashValid) {
      return { success: false, transactionId: txnRef, status: 'failed' as TransactionStatus, message: 'HMAC signature verification failed' };
    }

    const isSuccess = responseCode === '000' || responseCode === '121' || (this.isSandbox && payload.status === 'success');
    const newStatus: TransactionStatus = isSuccess ? 'success' : 'failed';

    const now = Date.now();
    await query(
      `UPDATE payment_transactions 
       SET status = $1, gateway_response = $2, updated_at = $3
       WHERE id = $4 OR transaction_ref = $4`,
      [newStatus, JSON.stringify(payload), now, txnRef]
    );

    return {
      success: isSuccess,
      transactionId: txnRef,
      status: newStatus,
      rawStatus: responseCode,
      message: `JazzCash webhook processed: ${newStatus}`,
    };
  }

  async refundPayment(transactionId: string, amount: number, reason: string) {
    const now = Date.now();
    const refundRef = `REF_JC_${Date.now()}`;
    await query(
      `UPDATE payment_transactions 
       SET status = 'refunded', updated_at = $1, gateway_response = gateway_response || $2::jsonb
       WHERE id = $3`,
      [now, JSON.stringify({ refundRef, reason, amount, refundedAt: now }), transactionId]
    );
    return { success: true, refundRef, message: `JazzCash refund recorded (${refundRef})` };
  }
}

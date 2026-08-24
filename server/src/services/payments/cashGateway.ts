import { IPaymentGateway, PaymentInitiateRequest, PaymentInitiateResult, PaymentVerifyResult, TransactionStatus } from './paymentGateway';
import { query } from '../../config/db';

export class CashGateway implements IPaymentGateway {
  async initiatePayment(req: PaymentInitiateRequest): Promise<PaymentInitiateResult> {
    const txnId = `txn_cash_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();

    // Persist cash transaction
    await query(
      `INSERT INTO payment_transactions (
        id, ride_id, user_id, provider, amount, currency, transaction_ref, 
        idempotency_key, status, gateway_response, created_at, updated_at
      ) VALUES ($1, $2, $3, 'cash', $4, 'PKR', $5, $6, 'pending', $7, $8, $9)`,
      [
        txnId,
        req.rideId,
        req.userId,
        req.amount,
        `CASH_${req.rideId}`,
        req.idempotencyKey || `idemp_${txnId}`,
        JSON.stringify({ type: 'cash_settlement', instructions: 'Direct cash payment on ride completion' }),
        now,
        now,
      ]
    );

    return {
      success: true,
      transactionId: txnId,
      status: 'pending',
      provider: 'cash',
      amount: req.amount,
      currency: 'PKR',
      message: 'Direct cash payment method selected. Pay the driver upon arrival.',
      gatewayRef: `CASH_${req.rideId}`,
      isSandbox: false,
    };
  }

  async verifyPayment(transactionId: string): Promise<PaymentVerifyResult> {
    const res = await query('SELECT * FROM payment_transactions WHERE id = $1', [transactionId]);
    if (res.rows.length === 0) {
      return { success: false, transactionId, status: 'failed', provider: 'cash', amount: 0, message: 'Transaction not found' };
    }
    const txn = res.rows[0];
    return {
      success: txn.status === 'success',
      transactionId,
      status: txn.status as TransactionStatus,
      provider: 'cash',
      amount: parseFloat(txn.amount),
      message: txn.status === 'success' ? 'Cash payment confirmed' : 'Cash payment pending ride completion',
    };
  }

  async handleWebhook(_payload: any, _headers?: any) {
    return { success: true, transactionId: '', status: 'success' as TransactionStatus, message: 'Cash transactions do not use webhooks' };
  }

  async refundPayment(transactionId: string, amount: number, reason: string) {
    const now = Date.now();
    await query(
      'UPDATE payment_transactions SET status = $1, updated_at = $2 WHERE id = $3',
      ['refunded', now, transactionId]
    );
    return { success: true, refundRef: `REF_CASH_${now}`, message: `Cash adjustment noted: ${reason}` };
  }
}

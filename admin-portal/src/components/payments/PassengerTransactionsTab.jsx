import React, { useState, useEffect, useCallback } from 'react';
import adminApi from '../../api/adminApi';

export function PassengerTransactionsTab({ onShowToast }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [providerFilter, setProviderFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [selectedTxn, setSelectedTxn] = useState(null);

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminApi.getPassengerTransactions({
        provider: providerFilter !== 'all' ? providerFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        page,
        limit: 15,
      });

      if (res && res.transactions) {
        setTransactions(res.transactions);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      } else {
        setTransactions([]);
      }
    } catch (err) {
      console.error('Fetch passenger transactions error:', err);
      onShowToast?.('Failed to load passenger transactions', 'error');
    } finally {
      setLoading(false);
    }
  }, [providerFilter, statusFilter, page, onShowToast]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const getProviderBadge = (provider, isSandbox) => {
    const configs = {
      cash: { bg: '#E0F2FE', text: '#0369A1', label: '💵 Cash' },
      jazzcash: { bg: '#FEF3C7', text: '#B45309', label: '💳 JazzCash' },
      easypaisa: { bg: '#DCFCE7', text: '#15803D', label: '💳 Easypaisa' },
    };
    const c = configs[provider] || { bg: '#F3F4F6', text: '#374151', label: provider };
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', backgroundColor: c.bg, color: c.text }}>
          {c.label}
        </span>
        {isSandbox && (
          <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: '700', backgroundColor: '#F3F4F6', color: '#6B7280', border: '1px solid #E5E7EB' }}>
            SANDBOX
          </span>
        )}
      </div>
    );
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      success: { bg: '#D1FAE5', text: '#059669', label: 'PAID' },
      pending: { bg: '#FEF3C7', text: '#D97706', label: 'PENDING' },
      pending_user_auth: { bg: '#E0E7FF', text: '#4338CA', label: 'AUTH PENDING' },
      failed: { bg: '#FEE2E2', text: '#DC2626', label: 'FAILED' },
      refunded: { bg: '#F3F4F6', text: '#4B5563', label: 'REFUNDED' },
    };
    const s = statusMap[status] || { bg: '#F3F4F6', text: '#374151', label: status };
    return (
      <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', backgroundColor: s.bg, color: s.text, textTransform: 'uppercase' }}>
        {s.label}
      </span>
    );
  };

  return (
    <div style={{ padding: '0' }}>
      {/* Header & Filter Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#181C32' }}>💳 Passenger Payment Transactions</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#7E8299' }}>
            Real-time audit log of digital wallet prompts (JazzCash / Easypaisa Sandbox) and cash ride settlements.
          </p>
        </div>
        <button
          onClick={fetchTransactions}
          style={{ padding: '8px 16px', backgroundColor: '#3699FF', color: '#FFF', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
        >
          🔄 Refresh Log
        </button>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#7E8299' }}>Gateway:</span>
          {['all', 'cash', 'jazzcash', 'easypaisa'].map((prov) => (
            <button
              key={prov}
              onClick={() => { setProviderFilter(prov); setPage(1); }}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                backgroundColor: providerFilter === prov ? '#181C32' : '#F3F6F9',
                color: providerFilter === prov ? '#FFFFFF' : '#3F4254',
              }}
            >
              {prov === 'all' ? 'All Providers' : prov === 'cash' ? '💵 Cash' : prov === 'jazzcash' ? '💳 JazzCash' : '💳 Easypaisa'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#7E8299' }}>Status:</span>
          {['all', 'success', 'pending', 'failed'].map((st) => (
            <button
              key={st}
              onClick={() => { setStatusFilter(st); setPage(1); }}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                backgroundColor: statusFilter === st ? '#181C32' : '#F3F6F9',
                color: statusFilter === st ? '#FFFFFF' : '#3F4254',
              }}
            >
              {st.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #F1F1F4', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#7E8299' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>⏳</div>
            Loading passenger transaction records...
          </div>
        ) : transactions.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#7E8299' }}>
            <div style={{ fontSize: '40px', marginBottom: '10px' }}>💳</div>
            <strong style={{ fontSize: '16px', color: '#3F4254' }}>No Transactions Found</strong>
            <p style={{ fontSize: '13px', marginTop: '4px' }}>No transactions match the selected filter criteria.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '14px 16px' }}>Txn ID / Ref</th>
                  <th style={{ padding: '14px 16px' }}>Passenger</th>
                  <th style={{ padding: '14px 16px' }}>Ride Route</th>
                  <th style={{ padding: '14px 16px' }}>Gateway</th>
                  <th style={{ padding: '14px 16px' }}>Amount</th>
                  <th style={{ padding: '14px 16px' }}>Status</th>
                  <th style={{ padding: '14px 16px' }}>Date & Time</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: '700', color: '#1E293B', fontFamily: 'monospace' }}>{tx.id}</div>
                      {tx.transactionRef && <div style={{ fontSize: '11px', color: '#64748B' }}>Ref: {tx.transactionRef}</div>}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: '700', color: '#1E293B' }}>{tx.userName}</div>
                      <div style={{ fontSize: '12px', color: '#64748B' }}>{tx.userPhone}</div>
                    </td>
                    <td style={{ padding: '14px 16px', maxWidth: '240px' }}>
                      <div style={{ fontSize: '12px', color: '#10B981', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        🟢 {tx.pickup}
                      </div>
                      <div style={{ fontSize: '12px', color: '#EF4444', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        🔴 {tx.dropoff}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {getProviderBadge(tx.provider, tx.isSandbox)}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontWeight: '800', color: '#0F172A', fontSize: '14px' }}>
                        PKR {tx.amount.toFixed(2)}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {getStatusBadge(tx.status)}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#64748B', fontSize: '12px' }}>
                      {new Date(tx.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {pagination.totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderTop: '1px solid #F1F1F4' }}>
            <span style={{ fontSize: '13px', color: '#7E8299' }}>
              Showing Page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong> ({pagination.total} total transactions)
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #E2E8F0', backgroundColor: page <= 1 ? '#F8FAFC' : '#FFFFFF', cursor: page <= 1 ? 'not-allowed' : 'pointer' }}
              >
                Previous
              </button>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #E2E8F0', backgroundColor: page >= pagination.totalPages ? '#F8FAFC' : '#FFFFFF', cursor: page >= pagination.totalPages ? 'not-allowed' : 'pointer' }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

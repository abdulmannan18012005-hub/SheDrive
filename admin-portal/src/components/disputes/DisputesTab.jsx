import React, { useState, useEffect, useCallback } from 'react';
import adminApi from '../../api/adminApi';

export function DisputesTab({ onShowToast }) {
  const [disputes, setDisputes] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [filterStatus, setFilterStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [resolveModal, setResolveModal] = useState(null);
  const [resolveForm, setResolveForm] = useState({ resolutionNotes: '', actionTaken: 'dismissed', adjustmentAmount: '' });
  const [resolving, setResolving] = useState(false);

  const fetchDisputes = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const data = await adminApi.getDisputes({ status: filterStatus, page, limit: 20 });
      setDisputes(data.disputes || []);
      setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
    } catch (err) {
      onShowToast?.('Failed to fetch disputes', 'error');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, onShowToast]);

  useEffect(() => { fetchDisputes(1); }, [fetchDisputes]);

  const handleResolve = async () => {
    if (!resolveModal) return;
    if (!resolveForm.resolutionNotes.trim()) {
      onShowToast?.('Resolution notes are required', 'error');
      return;
    }
    try {
      setResolving(true);
      const body = {
        resolutionNotes: resolveForm.resolutionNotes.trim(),
        actionTaken: resolveForm.actionTaken,
      };
      if (resolveForm.actionTaken === 'fare_adjusted' && resolveForm.adjustmentAmount) {
        body.adjustmentAmount = parseFloat(resolveForm.adjustmentAmount);
      }
      await adminApi.resolveDispute(resolveModal.id, body);
      onShowToast?.(`Dispute ${resolveModal.id} resolved successfully`, 'success');
      setResolveModal(null);
      setResolveForm({ resolutionNotes: '', actionTaken: 'dismissed', adjustmentAmount: '' });
      fetchDisputes(pagination.page);
    } catch (err) {
      onShowToast?.(err?.message || 'Failed to resolve dispute', 'error');
    } finally {
      setResolving(false);
    }
  };

  const styles = {
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' },
    title: { margin: 0, fontSize: '20px', fontWeight: '800', color: '#181C32' },
    subtitle: { margin: '4px 0 0 0', fontSize: '13px', color: '#7E8299' },
    filters: { display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' },
    filterBtn: (active) => ({
      padding: '6px 14px', borderRadius: '8px', border: 'none', fontSize: '13px',
      fontWeight: '600', cursor: 'pointer',
      backgroundColor: active ? '#3699FF' : '#F5F5F5',
      color: active ? '#FFF' : '#3F4254',
    }),
    table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
    th: { textAlign: 'left', padding: '12px 14px', backgroundColor: '#F9FAFB', color: '#7E8299', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #F1F1F4' },
    td: { padding: '12px 14px', borderBottom: '1px solid #F5F5F5', color: '#3F4254' },
    badge: (status) => ({
      padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase',
      backgroundColor: status === 'pending' ? '#FEF3C7' : status === 'resolved' ? '#D1FAE5' : '#FEE2E2',
      color: status === 'pending' ? '#D97706' : status === 'resolved' ? '#059669' : '#DC2626',
    }),
    actionBtn: {
      padding: '6px 12px', backgroundColor: '#7C3AED', color: '#FFF', border: 'none',
      borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer',
    },
    modalOverlay: {
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000,
    },
    modal: {
      backgroundColor: '#FFF', borderRadius: '16px', padding: '32px', width: '520px', maxWidth: '90vw',
      maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.15)',
    },
    input: {
      width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #E5E7EB',
      fontSize: '14px', fontFamily: 'inherit', boxSizing: 'border-box',
    },
    select: {
      width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #E5E7EB',
      fontSize: '14px', fontFamily: 'inherit', boxSizing: 'border-box', backgroundColor: '#FFF',
    },
    textarea: {
      width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #E5E7EB',
      fontSize: '14px', fontFamily: 'inherit', minHeight: '100px', resize: 'vertical', boxSizing: 'border-box',
    },
    label: { display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: '#3F4254' },
    formGroup: { marginBottom: '16px' },
    btnPrimary: {
      padding: '10px 20px', backgroundColor: '#7C3AED', color: '#FFF', border: 'none',
      borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer',
    },
    btnSecondary: {
      padding: '10px 20px', backgroundColor: '#F5F5F5', color: '#3F4254', border: 'none',
      borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
    },
    tableContainer: {
      backgroundColor: '#FFFFFF', borderRadius: '12px', overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #F1F1F4',
    },
    emptyState: {
      textAlign: 'center', padding: '60px 20px', backgroundColor: '#FAFBFC', borderRadius: '12px',
    },
    paginationBar: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '16px' },
    pageBtn: (disabled) => ({
      padding: '6px 12px', borderRadius: '6px', border: '1px solid #E5E7EB', fontSize: '13px',
      fontWeight: '600', cursor: disabled ? 'not-allowed' : 'pointer',
      backgroundColor: disabled ? '#F9FAFB' : '#FFF', color: disabled ? '#D1D5DB' : '#3F4254',
    }),
  };

  const formatDate = (ts) => {
    if (!ts) return 'N/A';
    return new Date(Number(ts)).toLocaleString();
  };

  return (
    <div>
      <div style={styles.header}>
        <div>
          <h3 style={styles.title}>⚖️ Ride Dispute & Complaint Resolution</h3>
          <p style={styles.subtitle}>
            Review and resolve ride disputes, fare complaints, and service issues
          </p>
        </div>
      </div>

      <div style={styles.filters}>
        {[
          { key: 'all', label: 'All Disputes' },
          { key: 'pending', label: '🟡 Pending' },
          { key: 'resolved', label: '✅ Resolved' },
          { key: 'rejected', label: '❌ Rejected / Dismissed' },
        ].map(f => (
          <button key={f.key} style={styles.filterBtn(filterStatus === f.key)} onClick={() => setFilterStatus(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ color: '#7E8299' }}>Loading disputes…</p>
        </div>
      ) : disputes.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>⚖️</div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '700', color: '#3F4254' }}>No Disputes Found</h3>
          <p style={{ margin: 0, fontSize: '14px', color: '#7E8299' }}>
            {filterStatus === 'all' ? 'No ride disputes have been filed.' : `No ${filterStatus} disputes found.`}
          </p>
        </div>
      ) : (
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>User</th>
                <th style={styles.th}>Subject</th>
                <th style={styles.th}>Ride</th>
                <th style={styles.th}>Fare</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {disputes.map((d) => (
                <tr key={d.id} style={d.status === 'pending' ? { backgroundColor: '#FFFBEB' } : {}}>
                  <td style={styles.td}>
                    <span style={{ fontSize: '12px' }}>{formatDate(d.createdAt)}</span>
                  </td>
                  <td style={styles.td}>
                    <strong>{d.userName}</strong>
                    <br />
                    <span style={{ fontSize: '11px', color: '#7E8299' }}>{d.userRole} • {d.userPhone}</span>
                  </td>
                  <td style={styles.td}>
                    <strong style={{ fontSize: '13px' }}>{d.subject || 'No Subject'}</strong>
                    <br />
                    <span style={{ fontSize: '11px', color: '#7E8299', display: 'block', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.message}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <span style={{ fontSize: '11px', color: '#7E8299' }}>
                      {d.rideId ? `${d.pickup} → ${d.dropoff}` : 'No Ride'}
                    </span>
                  </td>
                  <td style={styles.td}>
                    {d.rideFare > 0 ? (
                      <strong>Rs. {d.rideFare}</strong>
                    ) : (
                      <span style={{ color: '#7E8299' }}>—</span>
                    )}
                  </td>
                  <td style={styles.td}>
                    <span style={styles.badge(d.status)}>{d.status}</span>
                  </td>
                  <td style={styles.td}>
                    {d.status === 'pending' ? (
                      <button style={styles.actionBtn} onClick={() => {
                        setResolveModal(d);
                        setResolveForm({ resolutionNotes: '', actionTaken: 'dismissed', adjustmentAmount: '' });
                      }}>
                        Review
                      </button>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#7E8299' }}>Closed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div style={styles.paginationBar}>
          <button style={styles.pageBtn(pagination.page <= 1)} disabled={pagination.page <= 1} onClick={() => fetchDisputes(pagination.page - 1)}>
            ← Previous
          </button>
          <span style={{ fontSize: '13px', color: '#7E8299' }}>
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </span>
          <button style={styles.pageBtn(pagination.page >= pagination.totalPages)} disabled={pagination.page >= pagination.totalPages} onClick={() => fetchDisputes(pagination.page + 1)}>
            Next →
          </button>
        </div>
      )}

      {/* Resolve Dispute Modal */}
      {resolveModal && (
        <div style={styles.modalOverlay} onClick={() => setResolveModal(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '800', color: '#181C32' }}>
              ⚖️ Resolve Dispute
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#7E8299' }}>
              Dispute by <strong>{resolveModal.userName}</strong> — "{resolveModal.subject}"
            </p>

            {/* Message */}
            <div style={{ ...styles.formGroup, backgroundColor: '#F9FAFB', padding: '12px', borderRadius: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#7E8299' }}>User's Complaint:</span>
              <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#3F4254' }}>{resolveModal.message}</p>
            </div>

            {/* Action */}
            <div style={styles.formGroup}>
              <label style={styles.label}>Action to Take</label>
              <select
                style={styles.select}
                value={resolveForm.actionTaken}
                onChange={(e) => setResolveForm(f => ({ ...f, actionTaken: e.target.value }))}
              >
                <option value="dismissed">Dismiss — No action needed</option>
                <option value="warning_issued">Issue Warning to offending party</option>
                <option value="fare_adjusted">Approve Fare Adjustment</option>
              </select>
            </div>

            {/* Fare Adjustment */}
            {resolveForm.actionTaken === 'fare_adjusted' && (
              <div style={styles.formGroup}>
                <label style={styles.label}>Adjustment Amount (Rs.)</label>
                <input
                  type="number"
                  min="0"
                  style={styles.input}
                  placeholder="Enter fare adjustment amount"
                  value={resolveForm.adjustmentAmount}
                  onChange={(e) => setResolveForm(f => ({ ...f, adjustmentAmount: e.target.value }))}
                />
              </div>
            )}

            {/* Resolution Notes */}
            <div style={styles.formGroup}>
              <label style={styles.label}>Resolution Notes *</label>
              <textarea
                style={styles.textarea}
                placeholder="Provide detailed resolution notes for audit records…"
                value={resolveForm.resolutionNotes}
                onChange={(e) => setResolveForm(f => ({ ...f, resolutionNotes: e.target.value }))}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button style={styles.btnSecondary} onClick={() => setResolveModal(null)} disabled={resolving}>
                Cancel
              </button>
              <button style={styles.btnPrimary} onClick={handleResolve} disabled={resolving}>
                {resolving ? '⏳ Resolving…' : '✓ Resolve Dispute'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

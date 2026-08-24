import React, { useState, useEffect, useCallback } from 'react';
import adminApi from '../../api/adminApi';

export function ComplianceTab({ onShowToast }) {
  const [documents, setDocuments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [filterStatus, setFilterStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);

  const fetchExpiries = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const data = await adminApi.getComplianceExpiries({ status: filterStatus, page, limit: 20 });
      setDocuments(data.documents || []);
      setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
    } catch (err) {
      onShowToast?.('Failed to fetch compliance data', 'error');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, onShowToast]);

  useEffect(() => { fetchExpiries(1); }, [fetchExpiries]);

  const handleScan = async () => {
    try {
      setScanning(true);
      setScanResult(null);
      const result = await adminApi.runComplianceScan();
      setScanResult(result);
      onShowToast?.(`Compliance scan complete: ${result.expiredCount || 0} expired, ${result.expiringSoonCount || 0} expiring soon, ${result.noticesDispatchedCount || 0} notices sent`, 'success');
      fetchExpiries(1);
    } catch (err) {
      onShowToast?.('Compliance scan failed', 'error');
    } finally {
      setScanning(false);
    }
  };

  const styles = {
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' },
    title: { margin: 0, fontSize: '20px', fontWeight: '800', color: '#181C32' },
    subtitle: { margin: '4px 0 0 0', fontSize: '13px', color: '#7E8299' },
    filters: { display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' },
    filterBtn: (active) => ({
      padding: '6px 14px', borderRadius: '8px', border: 'none', fontSize: '13px',
      fontWeight: '600', cursor: 'pointer',
      backgroundColor: active ? '#3699FF' : '#F5F5F5',
      color: active ? '#FFF' : '#3F4254',
    }),
    scanBtn: {
      padding: '10px 20px', backgroundColor: '#7C3AED', color: '#FFF', border: 'none',
      borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer',
    },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
    th: { textAlign: 'left', padding: '12px 14px', backgroundColor: '#F9FAFB', color: '#7E8299', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #F1F1F4' },
    td: { padding: '12px 14px', borderBottom: '1px solid #F5F5F5', color: '#3F4254' },
    badge: (status) => ({
      padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase',
      backgroundColor: status === 'expired' ? '#FEE2E2' : status === 'expiring_soon' ? '#FEF3C7' : '#D1FAE5',
      color: status === 'expired' ? '#DC2626' : status === 'expiring_soon' ? '#D97706' : '#059669',
    }),
    scanResultCard: {
      backgroundColor: '#F0FDF4', borderRadius: '10px', padding: '16px 20px', marginBottom: '16px',
      border: '1px solid #BBF7D0', display: 'flex', alignItems: 'center', gap: '12px',
    },
    paginationBar: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '16px' },
    pageBtn: (disabled) => ({
      padding: '6px 12px', borderRadius: '6px', border: '1px solid #E5E7EB', fontSize: '13px',
      fontWeight: '600', cursor: disabled ? 'not-allowed' : 'pointer',
      backgroundColor: disabled ? '#F9FAFB' : '#FFF', color: disabled ? '#D1D5DB' : '#3F4254',
    }),
    emptyState: {
      textAlign: 'center', padding: '60px 20px', backgroundColor: '#FAFBFC', borderRadius: '12px',
    },
    tableContainer: {
      backgroundColor: '#FFFFFF', borderRadius: '12px', overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #F1F1F4',
    },
  };

  const formatDate = (ts) => {
    if (!ts) return 'N/A';
    return new Date(Number(ts)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const docTypeLabel = (type) => {
    switch (type) {
      case 'driving_license': return '🪪 Driving License';
      case 'vehicle_registration': return '🚘 Vehicle Registration';
      case 'insurance': return '🛡️ Insurance';
      default: return type?.replace(/_/g, ' ') || 'Unknown';
    }
  };

  return (
    <div>
      <div style={styles.header}>
        <div>
          <h3 style={styles.title}>📋 Driver Compliance & Document Expiry</h3>
          <p style={styles.subtitle}>
            Monitor driver document validity, license expiry, and compliance status
          </p>
        </div>
        <button style={styles.scanBtn} onClick={handleScan} disabled={scanning}>
          {scanning ? '⏳ Scanning…' : '🔍 Run Compliance Scan'}
        </button>
      </div>

      {scanResult && (
        <div style={styles.scanResultCard}>
          <span style={{ fontSize: '24px' }}>✅</span>
          <div>
            <strong style={{ fontSize: '14px', color: '#166534' }}>Scan Complete</strong>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#15803D' }}>
              Flagged {scanResult.scannedDocumentsCount || 0} documents: {scanResult.expiredCount || 0} expired, {scanResult.expiringSoonCount || 0} expiring soon. Dispatched {scanResult.noticesDispatchedCount || 0} automated notifications.
            </p>
          </div>
        </div>
      )}

      <div style={styles.filters}>
        {[
          { key: 'all', label: 'All Documents' },
          { key: 'expired', label: '🔴 Expired' },
          { key: 'expiring_soon', label: '🟡 Expiring Soon' },
        ].map(f => (
          <button key={f.key} style={styles.filterBtn(filterStatus === f.key)} onClick={() => setFilterStatus(f.key)}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ color: '#7E8299' }}>Loading compliance data…</p>
        </div>
      ) : documents.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>📋</div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '700', color: '#3F4254' }}>No Documents Found</h3>
          <p style={{ margin: 0, fontSize: '14px', color: '#7E8299' }}>
            {filterStatus === 'all' ? 'No tracked driver documents with expiry dates.' : `No ${filterStatus.replace('_', ' ')} documents found.`}
          </p>
        </div>
      ) : (
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Driver</th>
                <th style={styles.th}>Vehicle</th>
                <th style={styles.th}>Document Type</th>
                <th style={styles.th}>Expiry Date</th>
                <th style={styles.th}>Days Left</th>
                <th style={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc, idx) => (
                <tr key={`${doc.driverId}-${doc.documentType}-${idx}`} style={doc.status === 'expired' ? { backgroundColor: '#FEF2F2' } : {}}>
                  <td style={styles.td}>
                    <strong>{doc.driverName || 'Unknown'}</strong>
                    <br />
                    <span style={{ fontSize: '11px', color: '#7E8299' }}>{doc.driverPhone || ''}</span>
                  </td>
                  <td style={styles.td}>
                    <span style={{ fontSize: '12px' }}>{doc.vehicleTier || '—'}</span>
                    <br />
                    <span style={{ fontSize: '11px', color: '#7E8299' }}>{doc.vehiclePlate || ''}</span>
                  </td>
                  <td style={styles.td}>{docTypeLabel(doc.documentType)}</td>
                  <td style={styles.td}>{formatDate(doc.expiryDate)}</td>
                  <td style={styles.td}>
                    <strong style={{ color: doc.daysRemaining < 0 ? '#DC2626' : doc.daysRemaining <= 7 ? '#D97706' : '#059669' }}>
                      {doc.daysRemaining < 0 ? `${Math.abs(doc.daysRemaining)}d overdue` : `${doc.daysRemaining}d`}
                    </strong>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.badge(doc.status)}>{doc.status?.replace('_', ' ')}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div style={styles.paginationBar}>
          <button
            style={styles.pageBtn(pagination.page <= 1)}
            disabled={pagination.page <= 1}
            onClick={() => fetchExpiries(pagination.page - 1)}
          >
            ← Previous
          </button>
          <span style={{ fontSize: '13px', color: '#7E8299' }}>
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </span>
          <button
            style={styles.pageBtn(pagination.page >= pagination.totalPages)}
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => fetchExpiries(pagination.page + 1)}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

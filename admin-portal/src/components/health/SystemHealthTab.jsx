import React, { useState, useEffect, useCallback } from 'react';
import adminApi from '../../api/adminApi';

export function SystemHealthTab({ onShowToast }) {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchHealth = useCallback(async () => {
    try {
      setLoading(true);
      const data = await adminApi.getDeepHealth();
      setHealth(data);
      setLastRefresh(new Date());
    } catch (err) {
      onShowToast?.('Failed to fetch system health diagnostics', 'error');
    } finally {
      setLoading(false);
    }
  }, [onShowToast]);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);

  const styles = {
    container: { padding: '0' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
    title: { margin: 0, fontSize: '20px', fontWeight: '800', color: '#181C32' },
    subtitle: { margin: '4px 0 0 0', fontSize: '13px', color: '#7E8299' },
    refreshBtn: {
      padding: '8px 16px', backgroundColor: '#3699FF', color: '#FFF', border: 'none',
      borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer',
    },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' },
    card: {
      backgroundColor: '#FFFFFF', borderRadius: '12px', padding: '24px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #F1F1F4',
    },
    cardTitle: { margin: '0 0 16px 0', fontSize: '16px', fontWeight: '700', color: '#181C32', display: 'flex', alignItems: 'center', gap: '8px' },
    row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F5F5F5' },
    label: { fontSize: '13px', color: '#7E8299', fontWeight: '500' },
    value: { fontSize: '14px', fontWeight: '700', color: '#181C32' },
    statusDot: (ok) => ({
      display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%',
      backgroundColor: ok ? '#10B981' : '#EF4444', marginRight: '6px',
    }),
    badge: (color) => ({
      padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700',
      backgroundColor: color === 'green' ? '#D1FAE5' : color === 'yellow' ? '#FEF3C7' : '#FEE2E2',
      color: color === 'green' ? '#059669' : color === 'yellow' ? '#D97706' : '#DC2626',
      textTransform: 'uppercase',
    }),
    bar: (pct, color) => ({
      height: '8px', borderRadius: '4px', backgroundColor: '#F1F1F4', overflow: 'hidden', marginTop: '6px',
      position: 'relative',
    }),
    barFill: (pct, color) => ({
      height: '100%', width: `${Math.min(pct, 100)}%`, borderRadius: '4px',
      backgroundColor: pct > 85 ? '#EF4444' : pct > 60 ? '#F59E0B' : '#10B981',
      transition: 'width 0.5s ease',
    }),
  };

  if (loading && !health) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>🩺</div>
        <p style={{ fontSize: '14px', color: '#7E8299' }}>Running diagnostic checks…</p>
      </div>
    );
  }

  if (!health) return null;

  const heapPct = health.memory ? Math.round((health.memory.heapUsedMb / health.memory.heapTotalMb) * 100) : 0;
  const uptimeHrs = Math.floor(health.uptimeSeconds / 3600);
  const uptimeMins = Math.floor((health.uptimeSeconds % 3600) / 60);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h3 style={styles.title}>🩺 System Health & Infrastructure Diagnostics</h3>
          <p style={styles.subtitle}>
            Real-time server, database, and third-party gateway health monitoring
            {lastRefresh && ` • Last refresh: ${lastRefresh.toLocaleTimeString()}`}
          </p>
        </div>
        <button style={styles.refreshBtn} onClick={fetchHealth} disabled={loading}>
          {loading ? '⏳ Refreshing…' : '🔄 Refresh Diagnostics'}
        </button>
      </div>

      {/* Overall Status Banner */}
      <div style={{
        ...styles.card, marginBottom: '20px',
        borderLeft: `4px solid ${health.status === 'healthy' ? '#10B981' : '#EF4444'}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '32px' }}>{health.status === 'healthy' ? '✅' : '⚠️'}</span>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: health.status === 'healthy' ? '#059669' : '#DC2626' }}>
              System Status: {health.status?.toUpperCase()}
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#7E8299' }}>
              Server uptime: {uptimeHrs}h {uptimeMins}m
            </p>
          </div>
        </div>
      </div>

      <div style={styles.grid}>
        {/* Database Card */}
        <div style={styles.card}>
          <h4 style={styles.cardTitle}>🗄️ Database Engine</h4>
          <div style={styles.row}>
            <span style={styles.label}>Connection</span>
            <span>
              <span style={styles.statusDot(health.database?.connected)} />
              <span style={{ ...styles.value, color: health.database?.connected ? '#059669' : '#DC2626' }}>
                {health.database?.connected ? 'Connected' : 'Disconnected'}
              </span>
            </span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Engine</span>
            <span style={styles.value}>{health.database?.engine || 'N/A'}</span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Query Latency</span>
            <span style={styles.badge(health.database?.latencyMs < 50 ? 'green' : health.database?.latencyMs < 200 ? 'yellow' : 'red')}>
              {health.database?.latencyMs ?? '—'} ms
            </span>
          </div>
          {health.database?.error && (
            <div style={{ ...styles.row, borderBottom: 'none' }}>
              <span style={{ fontSize: '12px', color: '#DC2626' }}>Error: {health.database.error}</span>
            </div>
          )}
        </div>

        {/* Memory Card */}
        <div style={styles.card}>
          <h4 style={styles.cardTitle}>💾 Server Memory</h4>
          <div style={styles.row}>
            <span style={styles.label}>Heap Used</span>
            <span style={styles.value}>{health.memory?.heapUsedMb ?? '—'} MB</span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Heap Total</span>
            <span style={styles.value}>{health.memory?.heapTotalMb ?? '—'} MB</span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>RSS</span>
            <span style={styles.value}>{health.memory?.rssMb ?? '—'} MB</span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Heap Utilization</span>
            <span style={styles.badge(heapPct < 60 ? 'green' : heapPct < 85 ? 'yellow' : 'red')}>
              {heapPct}%
            </span>
          </div>
          <div style={styles.bar(heapPct)}>
            <div style={styles.barFill(heapPct)} />
          </div>
        </div>

        {/* Services Card */}
        <div style={styles.card}>
          <h4 style={styles.cardTitle}>🔌 Third-Party Service Gateways</h4>
          {[
            { label: 'Firebase FCM (Push)', key: 'firebaseFCM', icon: '🔔' },
            { label: 'Gmail SMTP (Email)', key: 'gmailSMTP', icon: '📧' },
            { label: 'Cloudinary (Media)', key: 'cloudinary', icon: '🖼️' },
          ].map(svc => {
            const val = health.services?.[svc.key] || 'unknown';
            const isConfigured = val === 'configured' || val === 'ready';
            return (
              <div key={svc.key} style={styles.row}>
                <span style={styles.label}>{svc.icon} {svc.label}</span>
                <span style={styles.badge(isConfigured ? 'green' : 'yellow')}>
                  {val}
                </span>
              </div>
            );
          })}
        </div>

        {/* Uptime Card */}
        <div style={styles.card}>
          <h4 style={styles.cardTitle}>⏱️ Server Uptime & Runtime</h4>
          <div style={styles.row}>
            <span style={styles.label}>Uptime</span>
            <span style={styles.value}>{uptimeHrs}h {uptimeMins}m</span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Node.js Process</span>
            <span style={styles.badge('green')}>Running</span>
          </div>
          <div style={styles.row}>
            <span style={styles.label}>Last Health Check</span>
            <span style={{ fontSize: '12px', color: '#7E8299' }}>
              {health.timestamp ? new Date(health.timestamp).toLocaleString() : 'Just now'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

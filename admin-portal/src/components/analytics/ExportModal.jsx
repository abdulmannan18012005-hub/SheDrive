import React, { useState } from 'react';
import adminApi from '../../api/adminApi';

/**
 * Modal to configure and download RFC 4180 CSV Reports
 */
export function ExportModal({ isOpen, onClose, defaultStartDate, defaultEndDate, onShowToast }) {
  const [reportType, setReportType] = useState('financial');
  const [startDate, setStartDate] = useState(
    new Date(defaultStartDate || Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(
    new Date(defaultEndDate || Date.now()).toISOString().split('T')[0]
  );
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const startMs = new Date(startDate).getTime();
      const endMs = new Date(endDate).getTime() + (24 * 60 * 60 * 1000 - 1);

      await adminApi.downloadReportCSV({
        type: reportType,
        startDate: startMs,
        endDate: endMs,
      });

      if (onShowToast) {
        onShowToast(`Report (${reportType}) downloaded successfully!`, 'success');
      }
      onClose();
    } catch (err) {
      console.error('Export error:', err);
      if (onShowToast) {
        onShowToast(err.message || 'Failed to download report', 'error');
      }
    } finally {
      setIsExporting(false);
    }
  };

  const reportOptions = [
    {
      id: 'financial',
      title: '💰 Financial & Revenue Statement',
      desc: 'Gross fares, platform commissions (7%), net driver payouts, and payment settlement breakdown.',
    },
    {
      id: 'rides',
      title: '🛣️ Complete Rides Archive',
      desc: 'Full ride details including pickup/dropoff, distance, duration, final fare, and cancellation reasons.',
    },
    {
      id: 'drivers',
      title: '🚘 Driver Performance & Payout Roster',
      desc: 'Completed rides, ratings, gross earnings, platform fee calculations, and online availability.',
    },
    {
      id: 'safety',
      title: '🚨 Emergency SOS & Safety Incident Log',
      desc: 'All SOS emergency triggers, GPS coordinates, resolution times, and user roles.',
    },
  ];

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
    }}>
      <div style={{
        backgroundColor: '#1E293B',
        border: '1px solid #334155',
        borderRadius: '14px',
        width: '100%',
        maxWidth: '540px',
        padding: '26px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 style={{ color: '#FFFFFF', fontSize: '20px', fontWeight: '700', margin: 0 }}>
              📥 Export Analytics & Operational Report
            </h2>
            <p style={{ color: '#94A3B8', fontSize: '13px', margin: '4px 0 0 0' }}>
              Standard RFC 4180 CSV format with security audit logging
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94A3B8',
              fontSize: '22px',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {/* Report Type Selection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
          <label style={{ fontSize: '12px', fontWeight: '700', color: '#CBD5E1', textTransform: 'uppercase' }}>
            Select Report Type
          </label>
          {reportOptions.map(opt => {
            const isSelected = reportType === opt.id;
            return (
              <div
                key={opt.id}
                onClick={() => setReportType(opt.id)}
                style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: isSelected ? '2px solid #0D9488' : '1px solid #334155',
                  backgroundColor: isSelected ? 'rgba(13, 148, 136, 0.15)' : '#0F172A',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ color: '#FFFFFF', fontWeight: '600', fontSize: '14px' }}>{opt.title}</div>
                <div style={{ color: '#94A3B8', fontSize: '12px', marginTop: '2px' }}>{opt.desc}</div>
              </div>
            );
          })}
        </div>

        {/* Date Range Selection */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '24px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#94A3B8', marginBottom: '6px' }}>
              From Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: '#0F172A',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '8px 12px',
                color: '#FFFFFF',
                fontSize: '13px',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#94A3B8', marginBottom: '6px' }}>
              To Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: '#0F172A',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '8px 12px',
                color: '#FFFFFF',
                fontSize: '13px',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            onClick={onClose}
            disabled={isExporting}
            style={{
              padding: '10px 18px',
              backgroundColor: 'transparent',
              border: '1px solid #475569',
              borderRadius: '8px',
              color: '#CBD5E1',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            style={{
              padding: '10px 22px',
              backgroundColor: '#0D9488',
              border: 'none',
              borderRadius: '8px',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: '700',
              cursor: isExporting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: isExporting ? 0.7 : 1,
            }}
          >
            {isExporting ? 'Generating CSV...' : 'Download CSV Report'}
          </button>
        </div>
      </div>
    </div>
  );
}

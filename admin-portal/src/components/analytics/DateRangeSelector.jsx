import React, { useState } from 'react';

/**
 * Reusable Date Range Selector with Presets and Custom Pickers
 */
export function DateRangeSelector({ startDate, endDate, onRangeChange, isLoading }) {
  const [activePreset, setActivePreset] = useState('30d');
  const [customStart, setCustomStart] = useState(
    new Date(startDate || Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [customEnd, setCustomEnd] = useState(
    new Date(endDate || Date.now()).toISOString().split('T')[0]
  );

  const handlePreset = (preset) => {
    setActivePreset(preset);
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (preset === 'today') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (preset === '7d') {
      start.setDate(now.getDate() - 7);
    } else if (preset === '30d') {
      start.setDate(now.getDate() - 30);
    } else if (preset === 'this_month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (preset === '90d') {
      start.setDate(now.getDate() - 90);
    }

    setCustomStart(start.toISOString().split('T')[0]);
    setCustomEnd(end.toISOString().split('T')[0]);
    onRangeChange(start.getTime(), end.getTime());
  };

  const handleCustomApply = () => {
    if (!customStart || !customEnd) return;
    const start = new Date(customStart);
    start.setHours(0, 0, 0, 0);
    const end = new Date(customEnd);
    end.setHours(23, 59, 59, 999);

    if (start.getTime() > end.getTime()) {
      alert('Start date cannot be after end date');
      return;
    }
    setActivePreset('custom');
    onRangeChange(start.getTime(), end.getTime());
  };

  const presets = [
    { id: 'today', label: 'Today' },
    { id: '7d', label: 'Last 7 Days' },
    { id: '30d', label: 'Last 30 Days' },
    { id: 'this_month', label: 'This Month' },
    { id: '90d', label: 'Last 90 Days' },
    { id: 'custom', label: 'Custom' },
  ];

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      flexWrap: 'wrap',
      backgroundColor: '#1E293B',
      padding: '8px 14px',
      borderRadius: '10px',
      border: '1px solid #334155',
    }}>
      {/* Preset Pills */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {presets.map(p => {
          const isActive = activePreset === p.id;
          return (
            <button
              key={p.id}
              disabled={isLoading}
              onClick={() => handlePreset(p.id)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: isActive ? '#E91E63' : 'transparent',
                color: isActive ? '#FFFFFF' : '#94A3B8',
                fontSize: '12px',
                fontWeight: isActive ? '700' : '500',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Custom Date Inputs (shown when custom preset active or always available) */}
      {activePreset === 'custom' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '6px' }}>
          <input
            type="date"
            value={customStart}
            onChange={e => setCustomStart(e.target.value)}
            style={{
              backgroundColor: '#0F172A',
              border: '1px solid #475569',
              borderRadius: '6px',
              padding: '4px 8px',
              color: '#F8FAFC',
              fontSize: '12px',
            }}
          />
          <span style={{ color: '#64748B', fontSize: '12px' }}>to</span>
          <input
            type="date"
            value={customEnd}
            onChange={e => setCustomEnd(e.target.value)}
            style={{
              backgroundColor: '#0F172A',
              border: '1px solid #475569',
              borderRadius: '6px',
              padding: '4px 8px',
              color: '#F8FAFC',
              fontSize: '12px',
            }}
          />
          <button
            onClick={handleCustomApply}
            disabled={isLoading}
            style={{
              backgroundColor: '#0284C7',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              padding: '5px 10px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}

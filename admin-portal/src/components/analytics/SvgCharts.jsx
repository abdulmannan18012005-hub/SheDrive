import React, { useState } from 'react';

/**
 * KPI Metric Card with Delta % indicator
 */
export function KpiDeltaCard({ title, value, prefix = '', suffix = '', delta, deltaLabel = 'vs prev period', icon, color = '#E91E63', subtext }) {
  const isPositive = delta > 0;
  const isNeutral = delta === 0 || delta === undefined || delta === null;

  return (
    <div style={{
      backgroundColor: '#1E293B',
      border: '1px solid #334155',
      borderRadius: '12px',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div>
          <span style={{ color: '#94A3B8', fontSize: '13px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {title}
          </span>
          <h3 style={{ color: '#FFFFFF', fontSize: '26px', fontWeight: '700', margin: '6px 0 0 0' }}>
            {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
          </h3>
        </div>
        <div style={{
          width: '44px',
          height: '44px',
          borderRadius: '10px',
          backgroundColor: `${color}20`,
          color: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '20px',
        }}>
          {icon}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
        {!isNeutral ? (
          <span style={{
            fontSize: '12px',
            fontWeight: '600',
            padding: '3px 8px',
            borderRadius: '6px',
            backgroundColor: isPositive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: isPositive ? '#10B981' : '#EF4444',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}>
            {isPositive ? '↑ +' : '↓ '}{delta}% {deltaLabel}
          </span>
        ) : (
          <span style={{ fontSize: '12px', color: '#64748B' }}>{subtext || 'Current period'}</span>
        )}
      </div>
    </div>
  );
}

/**
 * Responsive Multi-Series SVG Line Chart
 */
export function SvgLineChart({ data = [], lines = [], height = 260, xKey = 'date' }) {
  const [hoverIndex, setHoverIndex] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B', fontSize: '14px' }}>
        No trend data available for selected period
      </div>
    );
  }

  const padding = { top: 20, right: 20, bottom: 35, left: 55 };
  const chartWidth = 700;
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  // Calculate max value across all line keys
  let maxVal = 0;
  data.forEach(d => {
    lines.forEach(l => {
      const val = Number(d[l.key]) || 0;
      if (val > maxVal) maxVal = val;
    });
  });
  if (maxVal === 0) maxVal = 10;
  maxVal = Math.ceil(maxVal * 1.15); // Add 15% headroom

  const getX = (index) => padding.left + (index / Math.max(1, data.length - 1)) * innerWidth;
  const getY = (val) => padding.top + innerHeight - (val / maxVal) * innerHeight;

  // Y-axis gridlines
  const gridTicks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      {/* Chart Legend */}
      <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end', marginBottom: '10px' }}>
        {lines.map(l => (
          <div key={l.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#94A3B8' }}>
            <span style={{ width: '12px', height: '3px', backgroundColor: l.color, borderRadius: '2px' }} />
            {l.label}
          </div>
        ))}
      </div>

      <svg viewBox={`0 0 ${chartWidth} ${height}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
        {/* Y Gridlines & Labels */}
        {gridTicks.map((tick, i) => {
          const y = padding.top + innerHeight * (1 - tick);
          const val = Math.round(maxVal * tick);
          return (
            <g key={i}>
              <line
                x1={padding.left}
                y1={y}
                x2={chartWidth - padding.right}
                y2={y}
                stroke="#334155"
                strokeDasharray={tick === 0 ? '0' : '4 4'}
                strokeWidth="1"
              />
              <text x={padding.left - 8} y={y + 4} fill="#64748B" fontSize="10" textAnchor="end">
                {val >= 1000 ? `${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k` : val}
              </text>
            </g>
          );
        })}

        {/* X Axis Labels */}
        {data.map((d, i) => {
          if (data.length > 10 && i % Math.ceil(data.length / 7) !== 0 && i !== data.length - 1) return null;
          const x = getX(i);
          const rawDate = d[xKey] || '';
          const label = rawDate.length > 5 ? rawDate.substring(5) : rawDate; // MM-DD
          return (
            <text key={i} x={x} y={height - 10} fill="#64748B" fontSize="10" textAnchor="middle">
              {label}
            </text>
          );
        })}

        {/* Line Paths & Gradient Areas */}
        {lines.map(l => {
          const points = data.map((d, i) => `${getX(i)},${getY(Number(d[l.key]) || 0)}`).join(' ');
          return (
            <g key={l.key}>
              <polyline
                fill="none"
                stroke={l.color}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
              />
              {data.map((d, i) => {
                const x = getX(i);
                const y = getY(Number(d[l.key]) || 0);
                const isHovered = hoverIndex === i;
                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r={isHovered ? 5 : 3}
                    fill={l.color}
                    stroke="#1E293B"
                    strokeWidth="2"
                    style={{ transition: 'all 0.15s ease', cursor: 'pointer' }}
                  />
                );
              })}
            </g>
          );
        })}

        {/* Interactive Hover Columns */}
        {data.map((d, i) => {
          const x = getX(i);
          return (
            <rect
              key={i}
              x={x - (innerWidth / data.length) / 2}
              y={padding.top}
              width={Math.max(12, innerWidth / data.length)}
              height={innerHeight}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
            />
          );
        })}
      </svg>

      {/* Hover Tooltip Overlay */}
      {hoverIndex !== null && data[hoverIndex] && (
        <div style={{
          position: 'absolute',
          top: '30px',
          left: `${(hoverIndex / (data.length - 1)) * 80 + 10}%`,
          transform: 'translateX(-50%)',
          backgroundColor: '#0F172A',
          border: '1px solid #475569',
          borderRadius: '8px',
          padding: '10px 14px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          pointerEvents: 'none',
          zIndex: 10,
          minWidth: '130px',
        }}>
          <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '600', marginBottom: '6px' }}>
            {data[hoverIndex][xKey]}
          </div>
          {lines.map(l => (
            <div key={l.key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#F1F5F9', marginTop: '2px' }}>
              <span style={{ color: l.color }}>{l.label}:</span>
              <span style={{ fontWeight: '700' }}>
                {l.prefix || ''}{Number(data[hoverIndex][l.key] || 0).toLocaleString()}{l.suffix || ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Responsive SVG Bar Chart / Histogram
 */
export function SvgBarChart({ data = [], xKey = 'label', yKey = 'count', height = 240, barColor = '#E91E63', title }) {
  const [hoverIndex, setHoverIndex] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B', fontSize: '14px' }}>
        No bar chart data available
      </div>
    );
  }

  const padding = { top: 20, right: 15, bottom: 35, left: 45 };
  const chartWidth = 700;
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  let maxVal = 0;
  data.forEach(d => {
    const val = Number(d[yKey]) || 0;
    if (val > maxVal) maxVal = val;
  });
  if (maxVal === 0) maxVal = 10;
  maxVal = Math.ceil(maxVal * 1.15);

  const barWidth = Math.max(8, Math.min(28, (innerWidth / data.length) * 0.7));
  const slotWidth = innerWidth / data.length;

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      <svg viewBox={`0 0 ${chartWidth} ${height}`} style={{ width: '100%', height: 'auto' }}>
        {/* Y Gridlines */}
        {[0, 0.5, 1].map((tick, i) => {
          const y = padding.top + innerHeight * (1 - tick);
          const val = Math.round(maxVal * tick);
          return (
            <g key={i}>
              <line x1={padding.left} y1={y} x2={chartWidth - padding.right} y2={y} stroke="#334155" strokeDasharray="4 4" />
              <text x={padding.left - 6} y={y + 4} fill="#64748B" fontSize="10" textAnchor="end">
                {val}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const val = Number(d[yKey]) || 0;
          const barHeight = (val / maxVal) * innerHeight;
          const x = padding.left + i * slotWidth + (slotWidth - barWidth) / 2;
          const y = padding.top + innerHeight - barHeight;
          const isHovered = hoverIndex === i;

          return (
            <g key={i} onMouseEnter={() => setHoverIndex(i)} onMouseLeave={() => setHoverIndex(null)} style={{ cursor: 'pointer' }}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(2, barHeight)}
                rx="4"
                fill={isHovered ? '#F43F5E' : barColor}
                style={{ transition: 'all 0.15s ease' }}
              />
              {/* X Label */}
              <text
                x={padding.left + i * slotWidth + slotWidth / 2}
                y={height - 12}
                fill={isHovered ? '#FFFFFF' : '#64748B'}
                fontSize="10"
                textAnchor="middle"
                fontWeight={isHovered ? '700' : '400'}
              >
                {d[xKey]}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Hover Value Callout */}
      {hoverIndex !== null && data[hoverIndex] && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '15px',
          backgroundColor: '#0F172A',
          border: '1px solid #475569',
          borderRadius: '6px',
          padding: '6px 10px',
          fontSize: '12px',
          color: '#F1F5F9',
        }}>
          <span style={{ color: '#94A3B8' }}>{data[hoverIndex][xKey]}:</span> <strong>{data[hoverIndex][yKey]?.toLocaleString()} rides</strong>
        </div>
      )}
    </div>
  );
}

/**
 * Responsive SVG Donut Chart with Legend & Percentages
 */
export function SvgDonutChart({ data = [], height = 240, size = 180, strokeWidth = 28 }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B', fontSize: '14px' }}>
        No distribution data available
      </div>
    );
  }

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = data.reduce((sum, d) => sum + (Number(d.value) || 0), 0);

  let accumulatedOffset = 0;

  const defaultColors = ['#E91E63', '#6366F1', '#10B981', '#F59E0B', '#06B6D4', '#8B5CF6', '#EC4899'];

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', flexWrap: 'wrap', gap: '20px', minHeight: height }}>
      {/* SVG Donut */}
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
          {total === 0 ? (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke="#334155"
              strokeWidth={strokeWidth}
            />
          ) : (
            data.map((d, i) => {
              const val = Number(d.value) || 0;
              const ratio = total > 0 ? val / total : 0;
              const dashLength = ratio * circumference;
              const dashOffset = -accumulatedOffset;
              accumulatedOffset += dashLength;
              const color = d.color || defaultColors[i % defaultColors.length];

              return (
                <circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke={color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                  strokeDashoffset={dashOffset}
                  style={{ transition: 'stroke-dasharray 0.3s ease' }}
                />
              );
            })
          )}
        </svg>

        {/* Center Text */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <span style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', fontWeight: '600' }}>Total</span>
          <span style={{ fontSize: '20px', color: '#FFFFFF', fontWeight: '700' }}>
            {total.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Legend List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '180px' }}>
        {data.map((d, i) => {
          const val = Number(d.value) || 0;
          const pct = total > 0 ? Math.round((val / total) * 1000) / 10 : 0;
          const color = d.color || defaultColors[i % defaultColors.length];

          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: color }} />
                <span style={{ fontSize: '13px', color: '#E2E8F0', fontWeight: '500' }}>{d.label}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#94A3B8' }}>{val.toLocaleString()}</span>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#FFFFFF', minWidth: '42px', textAlign: 'right' }}>
                  {pct}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

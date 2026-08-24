import React, { useState, useEffect, useCallback } from 'react';
import adminApi from '../../api/adminApi';
import { SvgLineChart, SvgBarChart, SvgDonutChart, KpiDeltaCard } from './SvgCharts';
import { DateRangeSelector } from './DateRangeSelector';
import { ExportModal } from './ExportModal';
import { PaginationBar } from '../PaginationBar';
import { LoadingSpinner } from '../LoadingSpinner';

export function AnalyticsTab({ onShowToast }) {
  const [subTab, setSubTab] = useState('overview'); // 'overview' | 'financials' | 'rides' | 'drivers' | 'safety'
  const [isLoading, setIsLoading] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  // Date Range State (default last 30 days)
  const [startDate, setStartDate] = useState(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [endDate, setEndDate] = useState(Date.now());

  // Analytics Data States
  const [overviewData, setOverviewData] = useState(null);
  const [revenueData, setRevenueData] = useState(null);
  const [rideData, setRideData] = useState(null);
  const [driverData, setDriverData] = useState({ drivers: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } });
  const [driverSort, setDriverSort] = useState('rides'); // 'rides' | 'earnings' | 'rating' | 'cancellation'
  const [driverPage, setDriverPage] = useState(1);
  const [safetySupportData, setSafetySupportData] = useState(null);

  // Fetch Analytics for active sub-tab
  const fetchAnalyticsData = useCallback(async () => {
    try {
      setIsLoading(true);
      if (subTab === 'overview') {
        const data = await adminApi.getAnalyticsOverview({ startDate, endDate, interval: 'day' });
        setOverviewData(data);
      } else if (subTab === 'financials') {
        const data = await adminApi.getRevenueAnalytics({ startDate, endDate });
        setRevenueData(data);
      } else if (subTab === 'rides') {
        const data = await adminApi.getRideAnalytics({ startDate, endDate });
        setRideData(data);
      } else if (subTab === 'drivers') {
        const data = await adminApi.getDriverAnalytics({ startDate, endDate, page: driverPage, limit: 20, sort: driverSort });
        setDriverData(data);
      } else if (subTab === 'safety') {
        const data = await adminApi.getSafetySupportAnalytics({ startDate, endDate });
        setSafetySupportData(data);
      }
    } catch (err) {
      console.error('Fetch analytics error:', err);
      if (onShowToast) {
        onShowToast(err.message || 'Failed to load analytics data', 'error');
      }
    } finally {
      setIsLoading(false);
    }
  }, [subTab, startDate, endDate, driverPage, driverSort, onShowToast]);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  const handleDateRangeChange = (start, end) => {
    setStartDate(start);
    setEndDate(end);
    setDriverPage(1);
  };

  const handlePrintSummary = () => {
    window.print();
  };

  const subTabs = [
    { id: 'overview', label: '📊 Executive Overview' },
    { id: 'financials', label: '💰 Financials & Revenue' },
    { id: 'rides', label: '🛣️ Rides & Demand' },
    { id: 'drivers', label: '🚘 Driver Performance' },
    { id: 'safety', label: '🛡️ Safety & Support' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Print Stylesheet */}
      <style>{`
        @media print {
          aside, header, nav, button, .no-print {
            display: none !important;
          }
          body, main {
            background-color: #FFFFFF !important;
            color: #000000 !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .print-container {
            width: 100% !important;
            background: transparent !important;
            color: #000000 !important;
          }
          .print-card {
            border: 1px solid #CCCCCC !important;
            background: #FAFAFA !important;
            color: #000000 !important;
            break-inside: avoid;
          }
          h1, h2, h3, p, span {
            color: #000000 !important;
          }
        }
      `}</style>

      {/* Top Header & Controls */}
      <div className="no-print" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        backgroundColor: '#1E293B',
        padding: '18px 24px',
        borderRadius: '14px',
        border: '1px solid #334155',
      }}>
        <div>
          <h2 style={{ color: '#FFFFFF', fontSize: '22px', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            📈 Operational Intelligence & Analytics
          </h2>
          <p style={{ color: '#94A3B8', fontSize: '13px', margin: '4px 0 0 0' }}>
            Server-authoritative metrics, revenue trends, and operational performance
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <DateRangeSelector
            startDate={startDate}
            endDate={endDate}
            onRangeChange={handleDateRangeChange}
            isLoading={isLoading}
          />

          <button
            onClick={handlePrintSummary}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#334155',
              color: '#F8FAFC',
              border: '1px solid #475569',
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            🖨️ Print Summary
          </button>

          <button
            onClick={() => setShowExportModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#E91E63',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(233, 30, 99, 0.3)',
            }}
          >
            📥 Export CSV
          </button>

          <button
            onClick={fetchAnalyticsData}
            disabled={isLoading}
            style={{
              backgroundColor: '#0F172A',
              color: '#94A3B8',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            🔄
          </button>
        </div>
      </div>

      {/* Sub-Tab Navigation Bar */}
      <div className="no-print" style={{
        display: 'flex',
        gap: '8px',
        borderBottom: '1px solid #334155',
        paddingBottom: '8px',
        overflowX: 'auto',
      }}>
        {subTabs.map(t => {
          const isActive = subTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => {
                setSubTab(t.id);
                setDriverPage(1);
              }}
              style={{
                padding: '10px 18px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: isActive ? '#E91E63' : 'transparent',
                color: isActive ? '#FFFFFF' : '#94A3B8',
                fontSize: '14px',
                fontWeight: isActive ? '700' : '500',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Loading Indicator */}
      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '30px' }}>
          <LoadingSpinner text="Computing server-authoritative analytics..." />
        </div>
      )}

      {/* SUB-VIEW 1: EXECUTIVE OVERVIEW */}
      {!isLoading && subTab === 'overview' && overviewData && (
        <div className="print-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Top KPI Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <KpiDeltaCard
              title="Gross Completed Revenue"
              value={overviewData.summary.grossRevenue}
              prefix="Rs. "
              delta={overviewData.summary.prevPeriodComparison.revenueGrowthPct}
              icon="💰"
              color="#10B981"
            />
            <KpiDeltaCard
              title="Platform Commission (7%)"
              value={overviewData.summary.platformCommission}
              prefix="Rs. "
              delta={overviewData.summary.prevPeriodComparison.revenueGrowthPct}
              icon="🏛️"
              color="#6366F1"
            />
            <KpiDeltaCard
              title="Completed Rides"
              value={overviewData.summary.completedRides}
              delta={overviewData.summary.prevPeriodComparison.rideGrowthPct}
              icon="🏁"
              color="#E91E63"
            />
            <KpiDeltaCard
              title="Active Fleet Drivers"
              value={overviewData.summary.activeDrivers}
              subtext={`${overviewData.summary.activePassengers} Active Passengers`}
              icon="🚘"
              color="#F59E0B"
            />
          </div>

          {/* Key Summary Ratio Pill Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            flexWrap: 'wrap',
            gap: '16px',
            backgroundColor: '#0F172A',
            padding: '16px 20px',
            borderRadius: '12px',
            border: '1px solid #334155',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '600' }}>Trip Completion Rate</div>
              <div style={{ fontSize: '20px', color: '#10B981', fontWeight: '800' }}>{overviewData.summary.completionRate}%</div>
            </div>
            <div style={{ width: '1px', height: '30px', backgroundColor: '#334155' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '600' }}>Total Ride Inquiries</div>
              <div style={{ fontSize: '20px', color: '#FFFFFF', fontWeight: '800' }}>{overviewData.summary.totalRides.toLocaleString()}</div>
            </div>
            <div style={{ width: '1px', height: '30px', backgroundColor: '#334155' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '600' }}>Cancelled Rides</div>
              <div style={{ fontSize: '20px', color: '#EF4444', fontWeight: '800' }}>{overviewData.summary.cancelledRides.toLocaleString()}</div>
            </div>
            <div style={{ width: '1px', height: '30px', backgroundColor: '#334155' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '600' }}>Net Driver Earnings</div>
              <div style={{ fontSize: '20px', color: '#38BDF8', fontWeight: '800' }}>Rs. {overviewData.summary.netDriverEarnings.toLocaleString()}</div>
            </div>
          </div>

          {/* Charts Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '20px' }}>
            {/* Revenue Trend Line Chart */}
            <div className="print-card" style={{
              backgroundColor: '#1E293B',
              border: '1px solid #334155',
              borderRadius: '12px',
              padding: '20px',
            }}>
              <h3 style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: '700', margin: '0 0 16px 0' }}>
                📈 Daily Revenue Trend (PKR)
              </h3>
              <SvgLineChart
                data={overviewData.timeSeries}
                lines={[
                  { key: 'revenue', label: 'Revenue (PKR)', color: '#10B981', prefix: 'Rs. ' },
                ]}
                height={260}
              />
            </div>

            {/* Ride Volume Multi-Series Trend */}
            <div className="print-card" style={{
              backgroundColor: '#1E293B',
              border: '1px solid #334155',
              borderRadius: '12px',
              padding: '20px',
            }}>
              <h3 style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: '700', margin: '0 0 16px 0' }}>
                🛣️ Completed vs Cancelled Rides
              </h3>
              <SvgLineChart
                data={overviewData.timeSeries}
                lines={[
                  { key: 'completedRides', label: 'Completed', color: '#38BDF8' },
                  { key: 'cancelledRides', label: 'Cancelled', color: '#EF4444' },
                ]}
                height={260}
              />
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: FINANCIALS & REVENUE */}
      {!isLoading && subTab === 'financials' && revenueData && (
        <div className="print-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <KpiDeltaCard
              title="Gross Fare Revenue"
              value={revenueData.grossRevenue}
              prefix="Rs. "
              icon="💵"
              color="#10B981"
            />
            <KpiDeltaCard
              title={`Platform Commission (${revenueData.commissionPct}%)`}
              value={revenueData.platformCommission}
              prefix="Rs. "
              icon="🏛️"
              color="#6366F1"
            />
            <KpiDeltaCard
              title="Net Driver Earnings (93%)"
              value={revenueData.netDriverEarnings}
              prefix="Rs. "
              icon="👩‍✈️"
              color="#38BDF8"
            />
            <KpiDeltaCard
              title="Fee Collection Rate"
              value={revenueData.paymentCollection.collectionRate}
              suffix="%"
              icon="📊"
              color="#F59E0B"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
            {/* Category Revenue Donut Chart */}
            <div className="print-card" style={{
              backgroundColor: '#1E293B',
              border: '1px solid #334155',
              borderRadius: '12px',
              padding: '20px',
            }}>
              <h3 style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: '700', margin: '0 0 16px 0' }}>
                🚗 Revenue by Vehicle Category
              </h3>
              <SvgDonutChart
                data={revenueData.categoryBreakdown.map((c, i) => ({
                  label: c.category.toUpperCase(),
                  value: c.revenue,
                  color: ['#E91E63', '#38BDF8', '#10B981', '#F59E0B', '#8B5CF6'][i % 5],
                }))}
              />
            </div>

            {/* Category Breakdown Table */}
            <div className="print-card" style={{
              backgroundColor: '#1E293B',
              border: '1px solid #334155',
              borderRadius: '12px',
              padding: '20px',
            }}>
              <h3 style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: '700', margin: '0 0 16px 0' }}>
                📊 Category Settlement Breakdown
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #334155', color: '#94A3B8', textAlign: 'left' }}>
                      <th style={{ padding: '8px' }}>Category</th>
                      <th style={{ padding: '8px' }}>Rides</th>
                      <th style={{ padding: '8px' }}>Revenue (PKR)</th>
                      <th style={{ padding: '8px' }}>Share %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenueData.categoryBreakdown.map((c, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #283548', color: '#F1F5F9' }}>
                        <td style={{ padding: '10px 8px', fontWeight: '600' }}>{c.category.toUpperCase()}</td>
                        <td style={{ padding: '10px 8px' }}>{c.completedRides.toLocaleString()}</td>
                        <td style={{ padding: '10px 8px', color: '#10B981', fontWeight: '700' }}>Rs. {c.revenue.toLocaleString()}</td>
                        <td style={{ padding: '10px 8px' }}>{c.percentage}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 3: RIDES & DEMAND */}
      {!isLoading && subTab === 'rides' && rideData && (
        <div className="print-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <KpiDeltaCard
              title="Average Distance"
              value={rideData.metrics.avgDistanceKm}
              suffix=" km"
              icon="📍"
              color="#38BDF8"
            />
            <KpiDeltaCard
              title="Average Duration"
              value={rideData.metrics.avgDurationMin}
              suffix=" mins"
              icon="⏱️"
              color="#6366F1"
            />
            <KpiDeltaCard
              title="Average Trip Fare"
              value={rideData.metrics.avgFare}
              prefix="Rs. "
              icon="🏷️"
              color="#10B981"
            />
            <KpiDeltaCard
              title="Direct Cash Payment"
              value={rideData.metrics.cashPaymentPct}
              suffix="%"
              icon="💵"
              color="#F59E0B"
            />
          </div>

          {/* 24-Hour Peak Demand Histogram */}
          <div className="print-card" style={{
            backgroundColor: '#1E293B',
            border: '1px solid #334155',
            borderRadius: '12px',
            padding: '20px',
          }}>
            <h3 style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: '700', margin: '0 0 4px 0' }}>
              ⏰ 24-Hour Peak Ride Demand (Hourly Histogram)
            </h3>
            <p style={{ color: '#94A3B8', fontSize: '12px', margin: '0 0 16px 0' }}>
              Distribution of ride requests by hour of day (0:00 to 23:00)
            </p>
            <SvgBarChart
              data={rideData.hourlyDemand.map(h => ({
                label: `${h.hour}:00`,
                count: h.count,
              }))}
              xKey="label"
              yKey="count"
              height={260}
              barColor="#E91E63"
            />
          </div>

          {/* Top Corridors & Top Cancellation Reasons */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
            <div className="print-card" style={{
              backgroundColor: '#1E293B',
              border: '1px solid #334155',
              borderRadius: '12px',
              padding: '20px',
            }}>
              <h3 style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: '700', margin: '0 0 16px 0' }}>
                🛣️ Top Route Corridors
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {rideData.topCorridors.map((c, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#0F172A',
                    border: '1px solid #334155',
                  }}>
                    <div style={{ fontSize: '13px', color: '#FFFFFF', fontWeight: '600' }}>
                      {c.pickup} <span style={{ color: '#E91E63' }}>➔</span> {c.dropoff}
                    </div>
                    <div style={{ fontSize: '12px', color: '#38BDF8', fontWeight: '700' }}>
                      {c.tripCount} trips
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="print-card" style={{
              backgroundColor: '#1E293B',
              border: '1px solid #334155',
              borderRadius: '12px',
              padding: '20px',
            }}>
              <h3 style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: '700', margin: '0 0 16px 0' }}>
                ⚠️ Top Cancellation Reasons
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {rideData.topCancellationReasons.map((r, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#0F172A',
                    border: '1px solid #334155',
                  }}>
                    <div style={{ fontSize: '13px', color: '#F1F5F9' }}>{r.reason}</div>
                    <div style={{ fontSize: '12px', color: '#EF4444', fontWeight: '700' }}>{r.count} times</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 4: DRIVER PERFORMANCE */}
      {!isLoading && subTab === 'drivers' && driverData && (
        <div className="print-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Driver Filter & Sort Bar */}
          <div className="no-print" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#1E293B',
            padding: '14px 20px',
            borderRadius: '10px',
            border: '1px solid #334155',
          }}>
            <span style={{ color: '#FFFFFF', fontWeight: '700', fontSize: '15px' }}>
              🚘 Driver Performance Leaderboard ({driverData.pagination.total} Drivers)
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#94A3B8', fontSize: '12px' }}>Sort by:</span>
              <select
                value={driverSort}
                onChange={e => {
                  setDriverSort(e.target.value);
                  setDriverPage(1);
                }}
                style={{
                  backgroundColor: '#0F172A',
                  color: '#F8FAFC',
                  border: '1px solid #475569',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '13px',
                }}
              >
                <option value="rides">Most Completed Rides</option>
                <option value="earnings">Highest Gross Earnings</option>
                <option value="rating">Top Customer Rating</option>
                <option value="cancellation">Cancellation Rate</option>
              </select>
            </div>
          </div>

          {/* Driver Leaderboard Table */}
          <div className="print-card" style={{
            backgroundColor: '#1E293B',
            borderRadius: '12px',
            border: '1px solid #334155',
            overflow: 'hidden',
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#0F172A', borderBottom: '1px solid #334155', color: '#94A3B8', textAlign: 'left' }}>
                    <th style={{ padding: '12px 14px' }}>Driver</th>
                    <th style={{ padding: '12px 14px' }}>Tier & Vehicle</th>
                    <th style={{ padding: '12px 14px' }}>Rating</th>
                    <th style={{ padding: '12px 14px' }}>Status</th>
                    <th style={{ padding: '12px 14px' }}>Completed</th>
                    <th style={{ padding: '12px 14px' }}>Cancelled</th>
                    <th style={{ padding: '12px 14px' }}>Cancel %</th>
                    <th style={{ padding: '12px 14px' }}>Gross (PKR)</th>
                    <th style={{ padding: '12px 14px' }}>Net Earnings (PKR)</th>
                  </tr>
                </thead>
                <tbody>
                  {driverData.drivers.map((d, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #283548', color: '#F1F5F9' }}>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: '700', color: '#FFFFFF' }}>{d.name}</div>
                        <div style={{ fontSize: '11px', color: '#94A3B8' }}>{d.phone}</div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          backgroundColor: '#E91E6320',
                          color: '#E91E63',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '700',
                          textTransform: 'uppercase',
                        }}>
                          {d.vehicleTier}
                        </span>
                        <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>{d.vehicleModel}</div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ color: '#F59E0B', fontWeight: '700' }}>★ {d.rating.toFixed(2)}</span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '700',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          backgroundColor: d.isOnline ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                          color: d.isOnline ? '#10B981' : '#94A3B8',
                        }}>
                          {d.isOnline ? 'ONLINE' : 'OFFLINE'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: '600' }}>{d.completedRides}</td>
                      <td style={{ padding: '12px 14px', color: '#EF4444' }}>{d.cancelledRides}</td>
                      <td style={{ padding: '12px 14px' }}>{d.cancellationRate}%</td>
                      <td style={{ padding: '12px 14px', fontWeight: '600' }}>Rs. {d.grossEarnings.toLocaleString()}</td>
                      <td style={{ padding: '12px 14px', fontWeight: '700', color: '#10B981' }}>
                        Rs. {d.netEarnings.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="no-print" style={{ padding: '12px 16px', borderTop: '1px solid #334155' }}>
              <PaginationBar
                currentPage={driverData.pagination.page}
                totalPages={driverData.pagination.totalPages}
                totalItems={driverData.pagination.total}
                itemsPerPage={driverData.pagination.limit}
                onPageChange={(p) => setDriverPage(p)}
              />
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 5: SAFETY & SUPPORT */}
      {!isLoading && subTab === 'safety' && safetySupportData && (
        <div className="print-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <KpiDeltaCard
              title="Total SOS Triggers"
              value={safetySupportData.sos.totalIncidents}
              icon="🚨"
              color="#EF4444"
            />
            <KpiDeltaCard
              title="Resolved SOS Incidents"
              value={safetySupportData.sos.resolvedCount}
              icon="🛡️"
              color="#10B981"
            />
            <KpiDeltaCard
              title="Avg SOS Resolution Time"
              value={safetySupportData.sos.avgResolutionTimeMin}
              suffix=" mins"
              icon="⏱️"
              color="#38BDF8"
            />
            <KpiDeltaCard
              title="Overall App Rating"
              value={safetySupportData.feedback.avgRating}
              prefix="★ "
              suffix=" / 5.0"
              icon="⭐"
              color="#F59E0B"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
            {/* Support Ticket Breakdown */}
            <div className="print-card" style={{
              backgroundColor: '#1E293B',
              border: '1px solid #334155',
              borderRadius: '12px',
              padding: '20px',
            }}>
              <h3 style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: '700', margin: '0 0 16px 0' }}>
                🎫 Support Ticket Categories
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {safetySupportData.support.categoryBreakdown.map((t, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#0F172A',
                    border: '1px solid #334155',
                  }}>
                    <div style={{ fontSize: '13px', color: '#F1F5F9', textTransform: 'capitalize' }}>
                      {t.category.replace(/_/g, ' ')}
                    </div>
                    <div style={{ fontSize: '12px', color: '#38BDF8', fontWeight: '700' }}>
                      {t.count} tickets
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 1-5 Star Feedback Rating Distribution */}
            <div className="print-card" style={{
              backgroundColor: '#1E293B',
              border: '1px solid #334155',
              borderRadius: '12px',
              padding: '20px',
            }}>
              <h3 style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: '700', margin: '0 0 16px 0' }}>
                ⭐ Customer & Driver Rating Distribution
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[5, 4, 3, 2, 1].map(stars => {
                  const count = safetySupportData.feedback.starDistribution[stars] || 0;
                  const total = safetySupportData.feedback.totalFeedbacks || 1;
                  const pct = Math.round((count / total) * 100);

                  return (
                    <div key={stars} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px' }}>
                      <span style={{ width: '50px', color: '#F59E0B', fontWeight: '700' }}>{stars} Stars</span>
                      <div style={{ flex: 1, height: '8px', backgroundColor: '#0F172A', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', backgroundColor: stars >= 4 ? '#10B981' : (stars === 3 ? '#F59E0B' : '#EF4444') }} />
                      </div>
                      <span style={{ width: '40px', color: '#94A3B8', fontSize: '12px', textAlign: 'right' }}>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Report Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        defaultStartDate={startDate}
        defaultEndDate={endDate}
        onShowToast={onShowToast}
      />
    </div>
  );
}

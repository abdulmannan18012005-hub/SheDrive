import { Router, Request, Response } from 'express';
import { query } from '../../config/db';
import { authenticateToken } from '../../middleware/auth';
import { requireAdmin } from './admin.routes';

const router = Router();

// Helper to sanitize CSV field to prevent formula injection and conform to RFC 4180
function sanitizeCsvField(val: any): string {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  // Prevent CSV Formula Injection
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  // Escape double quotes
  str = str.replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * GET /api/v1/admin/analytics/overview
 * Returns executive summary metrics, previous period comparison, and time-series trend data.
 */
router.get('/overview', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const now = Date.now();
    const endDate = Number(req.query.endDate) || now;
    const startDate = Number(req.query.startDate) || (endDate - 30 * 24 * 60 * 60 * 1000);
    const interval = (req.query.interval as string) || 'day';

    if (isNaN(startDate) || isNaN(endDate) || startDate > endDate) {
      return res.status(400).json({ error: 'Invalid date range provided' });
    }

    const duration = endDate - startDate;
    const prevStartDate = startDate - duration;
    const prevEndDate = startDate;

    // Get current commission rate from admin_settings
    const settingsRes = await query('SELECT commission_pct FROM admin_settings WHERE id = 1');
    const commissionPct = parseFloat(settingsRes.rows[0]?.commission_pct || '7.0');

    // Current period summary query
    const currentSummaryRes = await query(`
      SELECT 
        COUNT(*) as total_rides,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_rides,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_rides,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN COALESCE(final_fare, offered_fare, 0) ELSE 0 END), 0) as gross_revenue,
        COUNT(DISTINCT CASE WHEN status = 'completed' THEN passenger_id END) as active_passengers,
        COUNT(DISTINCT CASE WHEN status = 'completed' THEN driver_id END) as active_drivers
      FROM rides
      WHERE created_at >= $1 AND created_at <= $2
    `, [startDate, endDate]);

    // Previous period summary query for delta calculations
    const prevSummaryRes = await query(`
      SELECT 
        COUNT(*) as total_rides,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_rides,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN COALESCE(final_fare, offered_fare, 0) ELSE 0 END), 0) as gross_revenue
      FROM rides
      WHERE created_at >= $1 AND created_at <= $2
    `, [prevStartDate, prevEndDate]);

    const curr = currentSummaryRes.rows[0] || {};
    const prev = prevSummaryRes.rows[0] || {};

    const totalRides = parseInt(curr.total_rides || '0', 10);
    const completedRides = parseInt(curr.completed_rides || '0', 10);
    const cancelledRides = parseInt(curr.cancelled_rides || '0', 10);
    const grossRevenue = parseFloat(curr.gross_revenue || '0');
    const platformCommission = Math.round((grossRevenue * (commissionPct / 100)) * 100) / 100;
    const netDriverEarnings = Math.round((grossRevenue - platformCommission) * 100) / 100;
    const completionRate = totalRides > 0 ? Math.round((completedRides / totalRides) * 1000) / 10 : 0;
    const activePassengers = parseInt(curr.active_passengers || '0', 10);
    const activeDrivers = parseInt(curr.active_drivers || '0', 10);

    const prevGrossRevenue = parseFloat(prev.gross_revenue || '0');
    const prevCompletedRides = parseInt(prev.completed_rides || '0', 10);

    const revenueGrowthPct = prevGrossRevenue > 0
      ? Math.round(((grossRevenue - prevGrossRevenue) / prevGrossRevenue) * 1000) / 10
      : (grossRevenue > 0 ? 100 : 0);

    const rideGrowthPct = prevCompletedRides > 0
      ? Math.round(((completedRides - prevCompletedRides) / prevCompletedRides) * 1000) / 10
      : (completedRides > 0 ? 100 : 0);

    // Time-series trend grouping
    const truncUnit = interval === 'month' ? 'month' : (interval === 'week' ? 'week' : 'day');
    const timeSeriesRes = await query(`
      SELECT 
        TO_CHAR(DATE_TRUNC('${truncUnit}', TO_TIMESTAMP(created_at / 1000)), 'YYYY-MM-DD') as date_label,
        COUNT(*) as total_rides,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_rides,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_rides,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN COALESCE(final_fare, offered_fare, 0) ELSE 0 END), 0) as revenue,
        COUNT(DISTINCT passenger_id) as active_users
      FROM rides
      WHERE created_at >= $1 AND created_at <= $2
      GROUP BY date_label
      ORDER BY date_label ASC
    `, [startDate, endDate]);

    res.status(200).json({
      summary: {
        grossRevenue,
        platformCommission,
        netDriverEarnings,
        commissionPct,
        totalRides,
        completedRides,
        cancelledRides,
        completionRate,
        activeDrivers,
        activePassengers,
        prevPeriodComparison: {
          revenueGrowthPct,
          rideGrowthPct,
          prevGrossRevenue,
          prevCompletedRides,
        },
      },
      timeSeries: timeSeriesRes.rows.map((r: any) => ({
        date: r.date_label,
        totalRides: parseInt(r.total_rides || '0', 10),
        completedRides: parseInt(r.completed_rides || '0', 10),
        cancelledRides: parseInt(r.cancelled_rides || '0', 10),
        revenue: parseFloat(r.revenue || '0'),
        activeUsers: parseInt(r.active_users || '0', 10),
      })),
    });
  } catch (error: any) {
    console.error('Fetch analytics overview error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics overview' });
  }
});

/**
 * GET /api/v1/admin/analytics/revenue
 * Returns comprehensive revenue breakdown by category and platform fee collection metrics.
 */
router.get('/revenue', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const now = Date.now();
    const endDate = Number(req.query.endDate) || now;
    const startDate = Number(req.query.startDate) || (endDate - 30 * 24 * 60 * 60 * 1000);

    if (isNaN(startDate) || isNaN(endDate) || startDate > endDate) {
      return res.status(400).json({ error: 'Invalid date range provided' });
    }

    const settingsRes = await query('SELECT commission_pct FROM admin_settings WHERE id = 1');
    const commissionPct = parseFloat(settingsRes.rows[0]?.commission_pct || '7.0');

    // Category breakdown
    const categoryRes = await query(`
      SELECT 
        vehicle_category,
        COUNT(*) as total_rides,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_rides,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN COALESCE(final_fare, offered_fare, 0) ELSE 0 END), 0) as revenue
      FROM rides
      WHERE created_at >= $1 AND created_at <= $2
      GROUP BY vehicle_category
      ORDER BY revenue DESC
    `, [startDate, endDate]);

    let totalRevenue = 0;
    categoryRes.rows.forEach((r: any) => {
      totalRevenue += parseFloat(r.revenue || '0');
    });

    const categoryBreakdown = categoryRes.rows.map((r: any) => {
      const rev = parseFloat(r.revenue || '0');
      const pct = totalRevenue > 0 ? Math.round((rev / totalRevenue) * 1000) / 10 : 0;
      return {
        category: r.vehicle_category,
        revenue: rev,
        completedRides: parseInt(r.completed_rides || '0', 10),
        totalRides: parseInt(r.total_rides || '0', 10),
        percentage: pct,
      };
    });

    // Payment collection stats from monthly_payments
    const paymentRes = await query(`
      SELECT 
        COALESCE(SUM(CASE WHEN status = 'paid' THEN platform_fee ELSE 0 END), 0) as collected_fees,
        COALESCE(SUM(CASE WHEN status IN ('submitted', 'pending') THEN platform_fee ELSE 0 END), 0) as pending_fees,
        COALESCE(SUM(CASE WHEN status = 'overdue' THEN platform_fee ELSE 0 END), 0) as overdue_fees,
        COALESCE(SUM(platform_fee), 0) as total_fees,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count,
        COUNT(CASE WHEN status IN ('submitted', 'pending') THEN 1 END) as pending_count,
        COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_count
      FROM monthly_payments
      WHERE created_at >= $1 AND created_at <= $2
    `, [startDate, endDate]);

    const pay = paymentRes.rows[0] || {};
    const collectedFees = parseFloat(pay.collected_fees || '0');
    const pendingFees = parseFloat(pay.pending_fees || '0');
    const overdueFees = parseFloat(pay.overdue_fees || '0');
    const totalFees = parseFloat(pay.total_fees || '0');
    const collectionRate = totalFees > 0 ? Math.round((collectedFees / totalFees) * 1000) / 10 : 100;

    const platformCommission = Math.round((totalRevenue * (commissionPct / 100)) * 100) / 100;
    const netDriverEarnings = Math.round((totalRevenue - platformCommission) * 100) / 100;

    res.status(200).json({
      commissionPct,
      grossRevenue: totalRevenue,
      platformCommission,
      netDriverEarnings,
      categoryBreakdown,
      paymentCollection: {
        collectedFees,
        pendingFees,
        overdueFees,
        totalFees,
        collectionRate,
        paidCount: parseInt(pay.paid_count || '0', 10),
        pendingCount: parseInt(pay.pending_count || '0', 10),
        overdueCount: parseInt(pay.overdue_count || '0', 10),
      },
    });
  } catch (error: any) {
    console.error('Fetch revenue analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch revenue analytics' });
  }
});

/**
 * GET /api/v1/admin/analytics/rides
 * Returns ride status breakdown, hourly 0-23h demand histogram, averages, and cancellation insights.
 */
router.get('/rides', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const now = Date.now();
    const endDate = Number(req.query.endDate) || now;
    const startDate = Number(req.query.startDate) || (endDate - 30 * 24 * 60 * 60 * 1000);
    const category = req.query.category as string;
    const status = req.query.status as string;

    if (isNaN(startDate) || isNaN(endDate) || startDate > endDate) {
      return res.status(400).json({ error: 'Invalid date range provided' });
    }

    let filterSql = 'WHERE created_at >= $1 AND created_at <= $2';
    const params: any[] = [startDate, endDate];

    if (category && category !== 'all') {
      params.push(category);
      filterSql += ` AND vehicle_category = $${params.length}`;
    }

    if (status && status !== 'all') {
      params.push(status);
      filterSql += ` AND status = $${params.length}`;
    }

    // Status breakdown
    const statusRes = await query(`
      SELECT status, COUNT(*) as count
      FROM rides
      ${filterSql}
      GROUP BY status
    `, params);

    const statusDistribution: Record<string, number> = {
      completed: 0,
      cancelled: 0,
      requested: 0,
      negotiating: 0,
      accepted: 0,
      arrived: 0,
      in_progress: 0,
    };
    statusRes.rows.forEach((r: any) => {
      statusDistribution[r.status] = parseInt(r.count || '0', 10);
    });

    // Hourly demand histogram (0-23)
    const hourlyRes = await query(`
      SELECT 
        EXTRACT(HOUR FROM TO_TIMESTAMP(created_at / 1000)) as hour_of_day,
        COUNT(*) as count,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN COALESCE(final_fare, offered_fare, 0) ELSE 0 END), 0) as revenue
      FROM rides
      ${filterSql}
      GROUP BY hour_of_day
      ORDER BY hour_of_day ASC
    `, params);

    const hourlyMap: Record<number, { count: number; revenue: number }> = {};
    for (let h = 0; h < 24; h++) {
      hourlyMap[h] = { count: 0, revenue: 0 };
    }
    hourlyRes.rows.forEach((r: any) => {
      const h = parseInt(r.hour_of_day, 10);
      if (h >= 0 && h < 24) {
        hourlyMap[h] = {
          count: parseInt(r.count || '0', 10),
          revenue: parseFloat(r.revenue || '0'),
        };
      }
    });

    const hourlyDemand = Object.keys(hourlyMap).map(h => ({
      hour: parseInt(h, 10),
      count: hourlyMap[parseInt(h, 10)].count,
      revenue: hourlyMap[parseInt(h, 10)].revenue,
    }));

    // General ride metrics (averages)
    const metricsRes = await query(`
      SELECT 
        COALESCE(AVG(distance_km), 0) as avg_distance,
        COALESCE(AVG(duration_min), 0) as avg_duration,
        COALESCE(AVG(CASE WHEN status = 'completed' THEN COALESCE(final_fare, offered_fare, 0) END), 0) as avg_fare,
        COUNT(CASE WHEN payment_method = 'cash' THEN 1 END) as cash_count
      FROM rides
      ${filterSql}
    `, params);

    const m = metricsRes.rows[0] || {};

    // Top cancellation reasons
    const cancellationRes = await query(`
      SELECT 
        COALESCE(cancellation_reason, 'No reason specified') as reason,
        COUNT(*) as count
      FROM rides
      WHERE created_at >= $1 AND created_at <= $2 AND status = 'cancelled'
      GROUP BY reason
      ORDER BY count DESC
      LIMIT 6
    `, [startDate, endDate]);

    // Top corridors / routes
    const corridorsRes = await query(`
      SELECT 
        pickup_label,
        dropoff_label,
        COUNT(*) as trip_count,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN COALESCE(final_fare, offered_fare, 0) ELSE 0 END), 0) as corridor_revenue
      FROM rides
      WHERE created_at >= $1 AND created_at <= $2
      GROUP BY pickup_label, dropoff_label
      ORDER BY trip_count DESC
      LIMIT 8
    `, [startDate, endDate]);

    res.status(200).json({
      statusDistribution,
      hourlyDemand,
      metrics: {
        avgDistanceKm: Math.round(parseFloat(m.avg_distance || '0') * 10) / 10,
        avgDurationMin: Math.round(parseFloat(m.avg_duration || '0') * 10) / 10,
        avgFare: Math.round(parseFloat(m.avg_fare || '0')),
        cashPaymentPct: statusDistribution.completed > 0 ? 100 : 0,
      },
      topCancellationReasons: cancellationRes.rows.map((r: any) => ({
        reason: r.reason,
        count: parseInt(r.count || '0', 10),
      })),
      topCorridors: corridorsRes.rows.map((r: any) => ({
        pickup: r.pickup_label,
        dropoff: r.dropoff_label,
        tripCount: parseInt(r.trip_count || '0', 10),
        revenue: parseFloat(r.corridor_revenue || '0'),
      })),
    });
  } catch (error: any) {
    console.error('Fetch ride analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch ride analytics' });
  }
});

/**
 * GET /api/v1/admin/analytics/drivers
 * Returns driver performance leaderboard with sorting, filtering, and pagination.
 */
router.get('/drivers', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const now = Date.now();
    const endDate = Number(req.query.endDate) || now;
    const startDate = Number(req.query.startDate) || (endDate - 30 * 24 * 60 * 60 * 1000);
    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string || '20', 10)));
    const sort = (req.query.sort as string) || 'rides';
    const offset = (page - 1) * limit;

    if (isNaN(startDate) || isNaN(endDate) || startDate > endDate) {
      return res.status(400).json({ error: 'Invalid date range provided' });
    }

    const settingsRes = await query('SELECT commission_pct FROM admin_settings WHERE id = 1');
    const commissionPct = parseFloat(settingsRes.rows[0]?.commission_pct || '7.0');

    // Determine ORDER BY clause
    let orderBy = 'completed_rides DESC';
    if (sort === 'earnings') orderBy = 'gross_earnings DESC';
    else if (sort === 'rating') orderBy = 'd.rating DESC, completed_rides DESC';
    else if (sort === 'cancellation') orderBy = 'cancellation_rate DESC';

    const driverQuery = `
      WITH driver_ride_stats AS (
        SELECT 
          driver_id,
          COUNT(*) as total_rides,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_rides,
          COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_rides,
          COALESCE(SUM(CASE WHEN status = 'completed' THEN COALESCE(final_fare, offered_fare, 0) ELSE 0 END), 0) as gross_earnings,
          COALESCE(AVG(CASE WHEN status = 'completed' THEN COALESCE(final_fare, offered_fare, 0) END), 0) as avg_fare
        FROM rides
        WHERE created_at >= $1 AND created_at <= $2 AND driver_id IS NOT NULL
        GROUP BY driver_id
      )
      SELECT 
        u.id as driver_id,
        u.name,
        u.phone,
        u.city,
        d.vehicle_category,
        d.vehicle_make,
        d.vehicle_model,
        d.rating,
        d.is_fee_suspended,
        d.is_online,
        COALESCE(s.total_rides, 0) as total_rides,
        COALESCE(s.completed_rides, 0) as completed_rides,
        COALESCE(s.cancelled_rides, 0) as cancelled_rides,
        COALESCE(s.gross_earnings, 0) as gross_earnings,
        COALESCE(s.avg_fare, 0) as avg_fare,
        CASE 
          WHEN COALESCE(s.total_rides, 0) > 0 
          THEN ROUND((COALESCE(s.cancelled_rides, 0)::numeric / s.total_rides) * 100, 1)
          ELSE 0 
        END as cancellation_rate
      FROM users u
      JOIN drivers d ON u.id = d.driver_id
      LEFT JOIN driver_ride_stats s ON u.id = s.driver_id
      WHERE u.verification_status = 'approved'
      ORDER BY ${orderBy}
      LIMIT $3 OFFSET $4
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM users u
      JOIN drivers d ON u.id = d.driver_id
      WHERE u.verification_status = 'approved'
    `;

    const [driversRes, countRes] = await Promise.all([
      query(driverQuery, [startDate, endDate, limit, offset]),
      query(countQuery),
    ]);

    const total = parseInt(countRes.rows[0]?.total || '0', 10);
    const totalPages = Math.ceil(total / limit) || 1;

    const drivers = driversRes.rows.map((d: any) => {
      const grossEarnings = parseFloat(d.gross_earnings || '0');
      const platformFee = Math.round((grossEarnings * (commissionPct / 100)) * 100) / 100;
      const netEarnings = Math.round((grossEarnings - platformFee) * 100) / 100;

      return {
        driverId: d.driver_id,
        name: d.name,
        phone: d.phone,
        city: d.city,
        vehicleTier: d.vehicle_category,
        vehicleModel: `${d.vehicle_make} ${d.vehicle_model}`.trim(),
        rating: parseFloat(d.rating || '0'),
        isFeeSuspended: d.is_fee_suspended,
        isOnline: d.is_online,
        totalRides: parseInt(d.total_rides || '0', 10),
        completedRides: parseInt(d.completed_rides || '0', 10),
        cancelledRides: parseInt(d.cancelled_rides || '0', 10),
        cancellationRate: parseFloat(d.cancellation_rate || '0'),
        grossEarnings,
        platformFee,
        netEarnings,
        avgFare: Math.round(parseFloat(d.avg_fare || '0')),
      };
    });

    res.status(200).json({
      drivers,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error: any) {
    console.error('Fetch driver analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch driver performance analytics' });
  }
});

/**
 * GET /api/v1/admin/analytics/safety-support
 * Returns SOS incidents, resolution durations, support ticket distributions, and rating analysis.
 */
router.get('/safety-support', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const now = Date.now();
    const endDate = Number(req.query.endDate) || now;
    const startDate = Number(req.query.startDate) || (endDate - 30 * 24 * 60 * 60 * 1000);

    if (isNaN(startDate) || isNaN(endDate) || startDate > endDate) {
      return res.status(400).json({ error: 'Invalid date range provided' });
    }

    // 1. SOS alerts metrics
    const sosRes = await query(`
      SELECT 
        COUNT(*) as total_incidents,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_count,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count,
        COUNT(CASE WHEN user_role = 'passenger' THEN 1 END) as passenger_incidents,
        COUNT(CASE WHEN user_role = 'driver' THEN 1 END) as driver_incidents,
        COALESCE(AVG(CASE WHEN status = 'resolved' AND resolved_at IS NOT NULL THEN (resolved_at - created_at) / 60000.0 END), 0) as avg_resolution_time_min
      FROM sos_alerts
      WHERE created_at >= $1 AND created_at <= $2
    `, [startDate, endDate]);

    const sos = sosRes.rows[0] || {};

    // 2. Support tickets metrics
    const ticketsRes = await query(`
      SELECT 
        COUNT(*) as total_tickets,
        COUNT(CASE WHEN status = 'open' THEN 1 END) as open_count,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_count,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_count
      FROM support_tickets
      WHERE created_at >= $1 AND created_at <= $2
    `, [startDate, endDate]);

    const ticketsCategoryRes = await query(`
      SELECT category, COUNT(*) as count
      FROM support_tickets
      WHERE created_at >= $1 AND created_at <= $2
      GROUP BY category
      ORDER BY count DESC
    `, [startDate, endDate]);

    const t = ticketsRes.rows[0] || {};

    // 3. Feedback metrics
    const feedbackRes = await query(`
      SELECT 
        COUNT(*) as total_feedback,
        COALESCE(AVG(rating), 5.0) as avg_rating,
        COUNT(CASE WHEN rating = 5 THEN 1 END) as star_5,
        COUNT(CASE WHEN rating = 4 THEN 1 END) as star_4,
        COUNT(CASE WHEN rating = 3 THEN 1 END) as star_3,
        COUNT(CASE WHEN rating = 2 THEN 1 END) as star_2,
        COUNT(CASE WHEN rating = 1 THEN 1 END) as star_1,
        COALESCE(AVG(CASE WHEN user_role = 'driver' THEN rating END), 5.0) as driver_avg_rating,
        COALESCE(AVG(CASE WHEN user_role = 'passenger' THEN rating END), 5.0) as passenger_avg_rating
      FROM feedbacks
      WHERE created_at >= $1 AND created_at <= $2
    `, [startDate, endDate]);

    const f = feedbackRes.rows[0] || {};

    res.status(200).json({
      sos: {
        totalIncidents: parseInt(sos.total_incidents || '0', 10),
        resolvedCount: parseInt(sos.resolved_count || '0', 10),
        activeCount: parseInt(sos.active_count || '0', 10),
        avgResolutionTimeMin: Math.round(parseFloat(sos.avg_resolution_time_min || '0') * 10) / 10,
        byRole: {
          passenger: parseInt(sos.passenger_incidents || '0', 10),
          driver: parseInt(sos.driver_incidents || '0', 10),
        },
      },
      support: {
        totalTickets: parseInt(t.total_tickets || '0', 10),
        open: parseInt(t.open_count || '0', 10),
        inProgress: parseInt(t.in_progress_count || '0', 10),
        resolved: parseInt(t.resolved_count || '0', 10),
        categoryBreakdown: ticketsCategoryRes.rows.map((r: any) => ({
          category: r.category,
          count: parseInt(r.count || '0', 10),
        })),
      },
      feedback: {
        totalFeedbacks: parseInt(f.total_feedback || '0', 10),
        avgRating: Math.round(parseFloat(f.avg_rating || '5.0') * 100) / 100,
        starDistribution: {
          5: parseInt(f.star_5 || '0', 10),
          4: parseInt(f.star_4 || '0', 10),
          3: parseInt(f.star_3 || '0', 10),
          2: parseInt(f.star_2 || '0', 10),
          1: parseInt(f.star_1 || '0', 10),
        },
        driverAvgRating: Math.round(parseFloat(f.driver_avg_rating || '5.0') * 100) / 100,
        passengerAvgRating: Math.round(parseFloat(f.passenger_avg_rating || '5.0') * 100) / 100,
      },
    });
  } catch (error: any) {
    console.error('Fetch safety & support analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch safety & support analytics' });
  }
});

/**
 * GET /api/v1/admin/analytics/export
 * Exports RFC 4180 compliant CSV attachments for Financials, Rides, Drivers, and Safety/Support reports.
 */
router.get('/export', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const type = (req.query.type as string) || 'financial';
    const now = Date.now();
    const endDate = Number(req.query.endDate) || now;
    const startDate = Number(req.query.startDate) || (endDate - 30 * 24 * 60 * 60 * 1000);

    if (isNaN(startDate) || isNaN(endDate) || startDate > endDate) {
      return res.status(400).json({ error: 'Invalid date range provided' });
    }

    const settingsRes = await query('SELECT commission_pct FROM admin_settings WHERE id = 1');
    const commissionPct = parseFloat(settingsRes.rows[0]?.commission_pct || '7.0');

    let csvContent = '';
    let fileName = `shedrive_${type}_report_${new Date().toISOString().split('T')[0]}.csv`;

    if (type === 'financial') {
      const rowsRes = await query(`
        SELECT 
          r.ride_id,
          TO_CHAR(TO_TIMESTAMP(r.created_at / 1000), 'YYYY-MM-DD HH24:MI:SS') as ride_date,
          r.vehicle_category,
          r.status,
          COALESCE(r.final_fare, r.offered_fare, 0) as gross_fare,
          u_p.name as passenger_name,
          u_d.name as driver_name,
          r.payment_method
        FROM rides r
        LEFT JOIN users u_p ON r.passenger_id = u_p.id
        LEFT JOIN users u_d ON r.driver_id = u_d.id
        WHERE r.created_at >= $1 AND r.created_at <= $2 AND r.status = 'completed'
        ORDER BY r.created_at DESC
        LIMIT 5000
      `, [startDate, endDate]);

      const headers = ['Ride ID', 'Date & Time', 'Vehicle Tier', 'Status', 'Gross Fare (PKR)', `Platform Commission (${commissionPct}%)`, 'Net Driver Payout (PKR)', 'Passenger Name', 'Driver Name', 'Payment Method'];
      csvContent = headers.map(sanitizeCsvField).join(',') + '\r\n';

      rowsRes.rows.forEach((r: any) => {
        const gross = parseFloat(r.gross_fare || '0');
        const comm = Math.round((gross * (commissionPct / 100)) * 100) / 100;
        const net = Math.round((gross - comm) * 100) / 100;

        const row = [
          r.ride_id,
          r.ride_date,
          r.vehicle_category,
          r.status,
          gross.toFixed(2),
          comm.toFixed(2),
          net.toFixed(2),
          r.passenger_name || 'N/A',
          r.driver_name || 'N/A',
          r.payment_method || 'cash',
        ];
        csvContent += row.map(sanitizeCsvField).join(',') + '\r\n';
      });
    } else if (type === 'rides') {
      const rowsRes = await query(`
        SELECT 
          r.ride_id,
          TO_CHAR(TO_TIMESTAMP(r.created_at / 1000), 'YYYY-MM-DD HH24:MI:SS') as ride_date,
          r.status,
          r.vehicle_category,
          r.pickup_label,
          r.dropoff_label,
          r.distance_km,
          r.duration_min,
          COALESCE(r.final_fare, r.offered_fare, 0) as fare,
          r.cancellation_reason,
          u_p.name as passenger_name,
          u_d.name as driver_name
        FROM rides r
        LEFT JOIN users u_p ON r.passenger_id = u_p.id
        LEFT JOIN users u_d ON r.driver_id = u_d.id
        WHERE r.created_at >= $1 AND r.created_at <= $2
        ORDER BY r.created_at DESC
        LIMIT 5000
      `, [startDate, endDate]);

      const headers = ['Ride ID', 'Date & Time', 'Status', 'Tier', 'Pickup Location', 'Dropoff Location', 'Distance (km)', 'Duration (min)', 'Fare (PKR)', 'Cancellation Reason', 'Passenger', 'Driver'];
      csvContent = headers.map(sanitizeCsvField).join(',') + '\r\n';

      rowsRes.rows.forEach((r: any) => {
        const row = [
          r.ride_id,
          r.ride_date,
          r.status,
          r.vehicle_category,
          r.pickup_label,
          r.dropoff_label,
          r.distance_km,
          r.duration_min,
          r.fare,
          r.cancellation_reason || '',
          r.passenger_name || 'N/A',
          r.driver_name || 'N/A',
        ];
        csvContent += row.map(sanitizeCsvField).join(',') + '\r\n';
      });
    } else if (type === 'drivers') {
      const rowsRes = await query(`
        SELECT 
          u.id as driver_id,
          u.name,
          u.phone,
          u.city,
          d.vehicle_category,
          d.rating,
          d.is_fee_suspended,
          d.is_online,
          COUNT(CASE WHEN r.status = 'completed' THEN 1 END) as completed_rides,
          COUNT(CASE WHEN r.status = 'cancelled' THEN 1 END) as cancelled_rides,
          COALESCE(SUM(CASE WHEN r.status = 'completed' THEN COALESCE(r.final_fare, r.offered_fare, 0) ELSE 0 END), 0) as gross_earnings
        FROM users u
        JOIN drivers d ON u.id = d.driver_id
        LEFT JOIN rides r ON u.id = r.driver_id AND r.created_at >= $1 AND r.created_at <= $2
        WHERE u.verification_status = 'approved'
        GROUP BY u.id, u.name, u.phone, u.city, d.vehicle_category, d.rating, d.is_fee_suspended, d.is_online
        ORDER BY gross_earnings DESC
        LIMIT 5000
      `, [startDate, endDate]);

      const headers = ['Driver ID', 'Name', 'Phone', 'City', 'Vehicle Tier', 'Rating', 'Online Status', 'Fee Suspended', 'Completed Rides', 'Cancelled Rides', 'Gross Earnings (PKR)', `Platform Fee (${commissionPct}%)`, 'Net Earnings (PKR)'];
      csvContent = headers.map(sanitizeCsvField).join(',') + '\r\n';

      rowsRes.rows.forEach((r: any) => {
        const gross = parseFloat(r.gross_earnings || '0');
        const fee = Math.round((gross * (commissionPct / 100)) * 100) / 100;
        const net = Math.round((gross - fee) * 100) / 100;

        const row = [
          r.driver_id,
          r.name,
          r.phone,
          r.city || 'Lahore',
          r.vehicle_category,
          r.rating || '0.00',
          r.is_online ? 'Online' : 'Offline',
          r.is_fee_suspended ? 'YES' : 'NO',
          r.completed_rides,
          r.cancelled_rides,
          gross.toFixed(2),
          fee.toFixed(2),
          net.toFixed(2),
        ];
        csvContent += row.map(sanitizeCsvField).join(',') + '\r\n';
      });
    } else if (type === 'safety') {
      const sosRes = await query(`
        SELECT 
          s.id,
          TO_CHAR(TO_TIMESTAMP(s.created_at / 1000), 'YYYY-MM-DD HH24:MI:SS') as incident_date,
          s.user_name,
          s.user_role,
          s.status,
          s.latitude,
          s.longitude,
          s.ride_id,
          CASE WHEN s.resolved_at IS NOT NULL THEN ROUND(((s.resolved_at - s.created_at) / 60000.0)::numeric, 1) ELSE NULL END as resolution_time_min
        FROM sos_alerts s
        WHERE s.created_at >= $1 AND s.created_at <= $2
        ORDER BY s.created_at DESC
        LIMIT 5000
      `, [startDate, endDate]);

      const headers = ['Alert ID', 'Incident Date', 'User Name', 'Role', 'Status', 'Latitude', 'Longitude', 'Ride ID', 'Resolution Time (Minutes)'];
      csvContent = headers.map(sanitizeCsvField).join(',') + '\r\n';

      sosRes.rows.forEach((s: any) => {
        const row = [
          s.id,
          s.incident_date,
          s.user_name || 'N/A',
          s.user_role,
          s.status,
          s.latitude,
          s.longitude,
          s.ride_id || 'N/A',
          s.resolution_time_min !== null ? `${s.resolution_time_min} mins` : 'Pending',
        ];
        csvContent += row.map(sanitizeCsvField).join(',') + '\r\n';
      });
    } else {
      return res.status(400).json({ error: `Unsupported export type: ${type}` });
    }

    // Audit log entry for export
    const auditId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const adminUser = (req as any).user;
    await query(
      'INSERT INTO audit_logs (id, user_id, action, details, timestamp) VALUES ($1, $2, $3, $4, $5)',
      [
        auditId,
        adminUser?.id || 'admin',
        'EXPORT_ANALYTICS_REPORT',
        `Exported ${type} report for date range ${new Date(startDate).toISOString().split('T')[0]} to ${new Date(endDate).toISOString().split('T')[0]}`,
        now,
      ]
    ).catch((e: any) => console.warn('Export audit log write failed (non-critical):', e?.message));

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.status(200).send(csvContent);
  } catch (error: any) {
    console.error('Export report CSV error:', error);
    res.status(500).json({ error: 'Failed to generate report export' });
  }
});

export default router;

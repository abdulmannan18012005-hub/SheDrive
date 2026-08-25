import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

import { requestLogger, errorLogger } from './middleware/logger';
import { query } from './config/db';
import { sendPushNotification } from './services/notificationService';
import healthRoutes from './routes/v1/health.routes';
import authRoutes from './routes/v1/auth.routes';
import rideRoutes from './routes/v1/ride.routes';
import uploadRoutes from './routes/v1/upload.routes';
import vehiclesRoutes from './routes/v1/vehicles.routes';
import savedPlacesRoutes from './routes/v1/saved_places.routes';
import supportRoutes from './routes/v1/support.routes';
import adminRoutes from './routes/v1/admin.routes';
import driverRoutes from './routes/v1/driver.routes';
import paymentRoutes from './routes/v1/payment.routes';
import userRoutes from './routes/v1/user.routes';
import notificationRoutes from './routes/v1/notification.routes';
import appRoutes from './routes/v1/app.routes';
import safetyRoutes from './routes/v1/safety.routes';
import analyticsRoutes from './routes/v1/analytics.routes';
import complianceRoutes from './routes/v1/compliance.routes';
import disputeRoutes from './routes/v1/dispute.routes';

dotenv.config();

const allowedOrigins: string[] = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:8080', 'https://shedrive.onrender.com'];

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});

const PORT = process.env.PORT || 3000;

// Express Global Middlewares
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

// Phase 11: Production Security Headers Middleware
app.use((_req: any, res: any, next: any) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.set('etag', false); // Disable ETag to prevent 304 stale data in Admin Portal
app.use('/api', (_req: any, res: any, next: any) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  next();
});
app.use(requestLogger);

// Global Root Health Checks & API v1 Version Prefix Routing
app.use('/', healthRoutes);
app.use('/health', healthRoutes);
app.use('/api/v1', healthRoutes);
app.use('/api/v1/app', appRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/rides', rideRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/vehicles', vehiclesRoutes);
app.use('/api/v1/saved-places', savedPlacesRoutes);
app.use('/api/v1/user/saved-places', savedPlacesRoutes); // Alias: mobile app calls /user/saved-places
app.use('/api/v1/support', supportRoutes);
app.use('/api/v1/admin/analytics', analyticsRoutes);
app.use('/api/v1/admin/compliance', complianceRoutes);
app.use('/api/v1/admin/disputes', disputeRoutes);
app.use('/api/v1/admin/payments', paymentRoutes); // Alias: admin portal calls /admin/payments/transactions
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/driver', driverRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/safety', safetyRoutes);
app.use('/api/v1/notifications', notificationRoutes);

// Real-Time Socket.io Connection Handler
io.on('connection', (socket) => {
  console.log(`[WebSocket Connected] Socket ID: ${socket.id}`);

  // Driver Location Live Tracking Update Event
  socket.on('update_location', (data: { driverId: string; lat: number; lng: number; heading?: number }) => {
    socket.broadcast.emit(`driver_location_${data.driverId}`, data);
    io.emit('driver_location_broadcast', data);
  });

  // Real-Time Bidding Offer Event with Push Notification Dispatch
  socket.on('send_fare_bid', async (data: { rideId: string; senderId: string; amount: number; role: string }) => {
    io.emit(`ride_bid_${data.rideId}`, data);

    try {
      const rideRes = await query('SELECT passenger_id, driver_id FROM rides WHERE ride_id = $1', [data.rideId]);
      if (rideRes.rows.length > 0) {
        const { passenger_id, driver_id } = rideRes.rows[0];
        const recipientId = data.role === 'driver' ? passenger_id : driver_id;
        if (recipientId && recipientId !== data.senderId) {
          sendPushNotification({
            userId: recipientId,
            title: data.role === 'driver' ? '💬 Driver Counter Offer' : '💬 Passenger Bid Received',
            body: `Offer: Rs. ${data.amount}. Tap to review and accept.`,
            data: { type: 'counter_bid', rideId: data.rideId, amount: String(data.amount) },
          }).catch(e => console.warn('[FCM] Bid push error:', e?.message));
        }
      }
    } catch (dbErr) {
      console.warn('[FCM] Bid push notification DB lookup error:', dbErr);
    }
  });

  // Real-Time Ride Lifecycle Status Transition Event with Push Notification Dispatch
  socket.on('ride_status_update', async (data: { rideId: string; status: string; driverId?: string; pin?: string }) => {
    io.emit(`ride_status_${data.rideId}`, data);
    io.emit('admin_live_ride_update', data);

    try {
      const rideRes = await query('SELECT passenger_id, driver_id, driver_name, offered_fare, current_fare FROM rides WHERE ride_id = $1', [data.rideId]);
      if (rideRes.rows.length > 0) {
        const { passenger_id, driver_id, driver_name, offered_fare, current_fare } = rideRes.rows[0];
        const fare = current_fare || offered_fare || 0;

        if (data.status === 'accepted' && driver_id) {
          sendPushNotification({
            userId: driver_id,
            title: '🎉 Ride Offer Accepted!',
            body: `Passenger accepted your offer of Rs. ${fare}. Navigate to pickup now.`,
            data: { type: 'ride_accepted', rideId: data.rideId },
          }).catch(e => console.warn('[FCM] Accept push error:', e?.message));
        } else if (data.status === 'arrived' && passenger_id) {
          sendPushNotification({
            userId: passenger_id,
            title: '📍 Driver Has Arrived',
            body: `Your verified driver ${driver_name || 'Partner'} is waiting at the pickup location.`,
            data: { type: 'driver_arrived', rideId: data.rideId },
          }).catch(e => console.warn('[FCM] Arrived push error:', e?.message));
        } else if (data.status === 'in_progress' && passenger_id) {
          sendPushNotification({
            userId: passenger_id,
            title: '🛣️ Trip Started',
            body: 'Your ride is in progress. You can share your live journey with trusted contacts.',
            data: { type: 'ride_started', rideId: data.rideId },
          }).catch(e => console.warn('[FCM] Trip start push error:', e?.message));
        } else if (data.status === 'completed' && passenger_id) {
          sendPushNotification({
            userId: passenger_id,
            title: '🏁 Trip Completed',
            body: `You have arrived at your destination! Total fare: Rs. ${fare}. Please rate your driver.`,
            data: { type: 'ride_completed', rideId: data.rideId },
          }).catch(e => console.warn('[FCM] Complete push error:', e?.message));
        } else if (data.status === 'cancelled') {
          if (passenger_id) {
            sendPushNotification({
              userId: passenger_id,
              title: '⚠️ Ride Cancelled',
              body: 'Your ride has been cancelled.',
              data: { type: 'ride_cancelled', rideId: data.rideId },
            }).catch(e => console.warn('[FCM] Cancel push error:', e?.message));
          }
          if (driver_id) {
            sendPushNotification({
              userId: driver_id,
              title: '⚠️ Ride Cancelled',
              body: 'The ride was cancelled.',
              data: { type: 'ride_cancelled', rideId: data.rideId },
            }).catch(e => console.warn('[FCM] Cancel push error:', e?.message));
          }
        }
      }
    } catch (statusErr) {
      console.warn('[FCM] Ride status push notification error:', statusErr);
    }
  });

  // Emergency SOS Broadcast Event with Admin Push Notification Dispatch
  socket.on('trigger_sos', (data: { userId: string; userName: string; lat: number; lng: number; rideId?: string }) => {
    console.warn(`[🚨 EMERGENCY SOS TRIGGERED] User: ${data.userName} (${data.userId})`);
    io.emit('admin_sos_alert', data);
  });

  socket.on('disconnect', () => {
    console.log(`[WebSocket Disconnected] Socket ID: ${socket.id}`);
  });
});

// Global Centralized Error Logger
app.use(errorLogger);

// Phase 11: Periodic Background Stale Pending Payment Cleanup Runner (every 15 minutes)
const cleanStalePendingPayments = async () => {
  try {
    const staleThreshold = Date.now() - (60 * 60 * 1000); // 60 minutes old
    const res = await query(
      `UPDATE payment_transactions 
       SET status = 'failed', updated_at = $1 
       WHERE status IN ('pending', 'pending_user_auth') AND created_at < $2`,
      [Date.now(), staleThreshold]
    );
    if (res && res.rowCount && res.rowCount > 0) {
      console.log(`[PAYMENT CLEANUP] Expired ${res.rowCount} stale pending payment transactions.`);
    }
  } catch (err: any) {
    console.warn('[PAYMENT CLEANUP] Error cleaning stale transactions:', err?.message);
  }
};
const cleanupInterval = setInterval(cleanStalePendingPayments, 15 * 60 * 1000);
if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

// Global Process Resilience Handlers
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('[FATAL PROCESS] Unhandled Promise Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err: Error) => {
  console.error('[FATAL PROCESS] Uncaught Exception thrown:', err.message, err.stack);
});

// Graceful Shutdown
const gracefulShutdown = (signal: string) => {
  console.log(`[SHUTDOWN] Received ${signal}. Closing HTTP server gracefully...`);
  clearInterval(cleanupInterval);
  server.close(() => {
    console.log('[SHUTDOWN] HTTP server closed cleanly. Exiting process.');
    process.exit(0);
  });
  // Force shutdown after 10s if hanging
  setTimeout(() => {
    console.error('[SHUTDOWN] Forcefully terminating after timeout.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

server.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`===================================================`);
  console.log(`🚀 SheDrive Always-Online Node.js Express API Server`);
  console.log(`🌐 Listening on Port: ${PORT}`);
  console.log(`🔗 API Base Version Endpoint: http://localhost:${PORT}/api/v1`);
  console.log(`===================================================`);
});


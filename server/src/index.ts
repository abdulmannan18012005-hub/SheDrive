import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

import { requestLogger, errorLogger } from './middleware/logger';
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

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

const PORT = process.env.PORT || 3000;

// Express Global Middlewares
app.use(cors());
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
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/rides', rideRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/vehicles', vehiclesRoutes);
app.use('/api/v1/saved-places', savedPlacesRoutes);
app.use('/api/v1/support', supportRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/driver', driverRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/user', userRoutes);

// Real-Time Socket.io Connection Handler
io.on('connection', (socket) => {
  console.log(`[WebSocket Connected] Socket ID: ${socket.id}`);

  // Driver Location Live Tracking Update Event
  socket.on('update_location', (data: { driverId: string; lat: number; lng: number; heading?: number }) => {
    socket.broadcast.emit(`driver_location_${data.driverId}`, data);
    io.emit('driver_location_broadcast', data);
  });

  // Real-Time Bidding Offer Event
  socket.on('send_fare_bid', (data: { rideId: string; senderId: string; amount: number; role: string }) => {
    io.emit(`ride_bid_${data.rideId}`, data);
  });

  // Real-Time Ride Lifecycle Status Transition Event
  socket.on('ride_status_update', (data: { rideId: string; status: string; driverId?: string; pin?: string }) => {
    io.emit(`ride_status_${data.rideId}`, data);
    io.emit('admin_live_ride_update', data);
  });

  // Emergency SOS Broadcast Event
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

server.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`===================================================`);
  console.log(`🚀 SheDrive Always-Online Node.js Express API Server`);
  console.log(`🌐 Listening on Port: ${PORT}`);
  console.log(`🔗 API Base Version Endpoint: http://localhost:${PORT}/api/v1`);
  console.log(`===================================================`);
});

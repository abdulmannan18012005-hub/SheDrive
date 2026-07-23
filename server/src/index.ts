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
app.use(requestLogger);

// API v1 Version Prefix Routing
app.use('/api/v1', healthRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/rides', rideRoutes);
app.use('/api/v1/upload', uploadRoutes);

// Real-Time Socket.io Connection Handler
io.on('connection', (socket) => {
  console.log(`[WebSocket Connected] Socket ID: ${socket.id}`);

  // Driver Location Live Tracking Update Event
  socket.on('update_location', (data: { driverId: string; lat: number; lng: number }) => {
    socket.broadcast.emit(`driver_location_${data.driverId}`, data);
  });

  // Real-Time Bidding Offer Event
  socket.on('send_fare_bid', (data: { rideId: string; senderId: string; amount: number }) => {
    io.emit(`ride_bid_${data.rideId}`, data);
  });

  socket.on('disconnect', () => {
    console.log(`[WebSocket Disconnected] Socket ID: ${socket.id}`);
  });
});

// Global Centralized Error Logger
app.use(errorLogger);

server.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`🚀 SheDrive Always-Online Node.js Express API Server`);
  console.log(`🌐 Listening on Port: ${PORT}`);
  console.log(`🔗 API Base Version Endpoint: http://localhost:${PORT}/api/v1`);
  console.log(`===================================================`);
});

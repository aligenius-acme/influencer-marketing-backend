import { createServer } from 'http';
import app from './app.js';
import { config } from './config/index.js';
import { connectMongoDB } from './config/mongodb.js';
import { connectPostgres } from './config/postgres.js';
import { connectRedis } from './config/redis.js';
import { initializeSocket } from './config/socket.js';

const startServer = async () => {
  try {
    // Connect to databases
    console.log('Connecting to databases...');

    await connectPostgres();
    console.log('PostgreSQL connected');

    await connectMongoDB();
    console.log('MongoDB connected');

    await connectRedis();
    console.log('Redis connected');

    // Create HTTP server for Socket.IO
    const httpServer = createServer(app);

    // Initialize Socket.IO
    initializeSocket(httpServer);

    // Start server
    httpServer.listen(config.port, () => {
      console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 Influencer Marketing Platform API                    ║
║                                                           ║
║   Environment: ${config.env.padEnd(40)}║
║   Port: ${config.port.toString().padEnd(47)}║
║   API: http://localhost:${config.port}${config.apiPrefix.padEnd(28)}║
║   WebSocket: ws://localhost:${config.port.toString().padEnd(26)}║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

startServer();

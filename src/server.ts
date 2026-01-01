import app from './app.js';
import { config } from './config/index.js';
import { connectMongoDB } from './config/mongodb.js';
import { connectPostgres } from './config/postgres.js';
import { connectRedis } from './config/redis.js';

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

    // Start server
    app.listen(config.port, () => {
      console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 Influencer Marketing Platform API                    ║
║                                                           ║
║   Environment: ${config.env.padEnd(40)}║
║   Port: ${config.port.toString().padEnd(47)}║
║   API: http://localhost:${config.port}${config.apiPrefix.padEnd(28)}║
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

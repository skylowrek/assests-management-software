require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const { connectDB } = require('./config/db');
const { APP_CONFIG } = require('./config/constants');

const authRoutes = require('./routes/auth');
const identityRoutes = require('./routes/identities');
const assetRoutes = require('./routes/assets');
const roleRoutes = require('./routes/roles');
const auditRoutes = require('./routes/audit');
const transactionRoutes = require('./routes/transactions');
const verifyRoutes = require('./routes/verify');
const notificationRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/users');
const { errorHandler } = require('./middleware/errorHandler');
const { startBlockchainPoller } = require('./services/blockchainPoller');

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy for IP extraction
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || origin.startsWith('http://localhost') || origin.includes('vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Health check
app.get('/api/v1/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' } });
});

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/identities', identityRoutes);
app.use('/api/v1/assets', assetRoutes);
app.use('/api/v1/roles', roleRoutes);
app.use('/api/v1/audit', auditRoutes);
app.use('/api/v1/transactions', transactionRoutes);
app.use('/api/v1/verify', verifyRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/users', userRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Endpoint not found' } });
});

// Error handler
app.use(errorHandler);

// Start server
const server = app.listen(PORT, async () => {
  console.log(`\n🚀 ${APP_CONFIG.BRAND_NAME} API running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Database: ${process.env.DATABASE_URL ? 'configured' : 'NOT configured'}\n`);

  // Start blockchain poller after server is ready
  if (process.env.NODE_ENV !== 'test') {
    try {
      await startBlockchainPoller();
      console.log('⛓  Blockchain poller started');
    } catch (err) {
      console.warn('⚠  Blockchain poller failed to start:', err.message);
    }
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = app;

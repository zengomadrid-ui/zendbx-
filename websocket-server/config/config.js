module.exports = {
  port: process.env.PORT || 8001,
  corsOrigin: process.env.CORS_ORIGIN || '*',
  logLevel: process.env.LOG_LEVEL || 'info'
};

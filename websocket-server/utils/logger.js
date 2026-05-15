const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const currentLevel = logLevels[process.env.LOG_LEVEL] || logLevels.info;

function log(level, message, data = {}) {
  if (logLevels[level] <= currentLevel) {
    const timestamp = new Date().toISOString();
    const logData = Object.keys(data).length > 0 ? JSON.stringify(data) : '';
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message} ${logData}`);
  }
}

module.exports = {
  error: (msg, data) => log('error', msg, data),
  warn: (msg, data) => log('warn', msg, data),
  info: (msg, data) => log('info', msg, data),
  debug: (msg, data) => log('debug', msg, data)
};

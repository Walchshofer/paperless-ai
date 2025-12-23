const format = (level, message, meta) => {
  if (meta === undefined) {
    return message;
  }
  return { level, message, meta };
};

module.exports = {
  info(message, meta) {
    console.log(format('info', message, meta));
  },
  warn(message, meta) {
    console.warn(format('warn', message, meta));
  },
  error(message, meta) {
    console.error(format('error', message, meta));
  },
  debug(message, meta) {
    if (process.env.LOG_LEVEL === 'debug') {
      console.debug(format('debug', message, meta));
    }
  }
};

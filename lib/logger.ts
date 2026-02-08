import Constants from 'expo-constants';

// Determine if we're in development mode
// In Expo/React Native, __DEV__ is automatically set to true in development
const isDevelopment = typeof __DEV__ !== 'undefined' ? __DEV__ : true;
// In production, respect app.config extra.enableLogging
const enableLogging = Constants.expoConfig?.extra?.enableLogging !== false;
const shouldLog = isDevelopment ? true : enableLogging;

// Logger utility with environment-based logging.
// In dev (__DEV__) we always log to console so API calls are visible in Metro/browser console.
export const logger = {
  log: (...args: any[]) => {
    if (isDevelopment || shouldLog) {
      console.log(...args);
    }
  },

  error: (...args: any[]) => {
    // Always log errors, but sanitize in production
    if (isDevelopment || shouldLog) {
      console.error(...args);
    } else {
      // In production, log errors but sanitize sensitive data
      const sanitized = args.map(arg => {
        if (typeof arg === 'string') {
          // Remove potential sensitive patterns
          return arg.replace(/password[=:]\s*['"]?[^'"]+['"]?/gi, 'password=[REDACTED]')
                    .replace(/token[=:]\s*['"]?[^'"]+['"]?/gi, 'token=[REDACTED]')
                    .replace(/authorization[=:]\s*['"]?[^'"]+['"]?/gi, 'authorization=[REDACTED]');
        }
        return arg;
      });
      console.error(...sanitized);
    }
  },

  warn: (...args: any[]) => {
    if (isDevelopment || shouldLog) {
      console.warn(...args);
    }
  },

  info: (...args: any[]) => {
    if (isDevelopment || shouldLog) {
      console.info(...args);
    }
  },

  debug: (...args: any[]) => {
    if (isDevelopment || shouldLog) {
      console.debug(...args);
    }
  },
};

export default logger;

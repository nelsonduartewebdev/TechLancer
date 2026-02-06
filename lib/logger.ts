import Constants from 'expo-constants';

// Determine if we're in development mode
// In Expo/React Native, __DEV__ is automatically set to true in development
// Also check for explicit enableLogging flag
const isDevelopment = typeof __DEV__ !== 'undefined' ? __DEV__ : true; // Default to true if __DEV__ is undefined
const enableLogging = Constants.expoConfig?.extra?.enableLogging !== false; // Default to true unless explicitly disabled
const shouldLog = isDevelopment && enableLogging;

// Logger utility with environment-based logging
export const logger = {
  log: (...args: any[]) => {
    if (shouldLog) {
      console.log(...args);
    }
  },

  error: (...args: any[]) => {
    // Always log errors, but sanitize in production
    if (shouldLog) {
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
    if (shouldLog) {
      console.warn(...args);
    }
  },

  info: (...args: any[]) => {
    if (shouldLog) {
      console.info(...args);
    }
  },

  debug: (...args: any[]) => {
    if (shouldLog) {
      console.debug(...args);
    }
  },
};

export default logger;

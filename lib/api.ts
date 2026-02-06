import Constants from 'expo-constants';
import { supabase } from './supabase';
import logger from './logger';

// Get API base URL from environment variables
// Try app.config.js extra first, then process.env, fallback to localhost
const API_BASE_URL = 
  Constants.expoConfig?.extra?.apiBaseUrl || 
  process.env.EXPO_PUBLIC_API_BASE_URL || 
  'http://localhost:3000/api/v1';

// Log API configuration on module load
logger.log('[API] Initialized with base URL:', API_BASE_URL);

// Custom error class to match axios error structure
class ApiError extends Error {
  response?: {
    status: number;
    data: any;
  };
  status?: number;

  constructor(message: string, status?: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    if (status && data) {
      this.response = { status, data };
    }
  }
}

// Helper function to sanitize request body (remove sensitive data from logs)
const sanitizeRequestBody = (body: any): any => {
  if (!body || typeof body !== 'object') return body;
  const sanitized = { ...body };
  // Remove sensitive fields from logs
  if (sanitized.password) {
    sanitized.password = '[REDACTED]';
  }
  if (sanitized.repeatPassword) {
    sanitized.repeatPassword = '[REDACTED]';
  }
  if (sanitized.token) {
    sanitized.token = '[REDACTED]';
  }
  if (sanitized.access_token) {
    sanitized.access_token = '[REDACTED]';
  }
  return sanitized;
};

// Helper function to build URL with query parameters
const buildUrl = (baseUrl: string, url: string, params?: any): string => {
  const fullUrl = `${baseUrl}${url}`;
  if (!params) return fullUrl;
  
  const queryString = Object.keys(params)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');
  
  return queryString ? `${fullUrl}?${queryString}` : fullUrl;
};

// Helper function to make fetch requests with timeout and auth
const makeRequest = async (
  url: string,
  options: RequestInit = {},
  params?: any
): Promise<Response> => {
  // Build full URL with query params for GET requests
  const fullUrl = buildUrl(API_BASE_URL, url, params);
  const method = options.method || 'GET';
  const startTime = Date.now();
  
  // Log request details
  logger.log(`[API] ${method} ${fullUrl}`);
  if (params && Object.keys(params).length > 0) {
    logger.log(`[API] Query params:`, params);
  }
  
  // Get auth token
  let authToken: string | null = null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    authToken = session?.access_token || null;
    if (authToken) {
      logger.log(`[API] Auth token: ${authToken.substring(0, 20)}...`);
    } else {
      logger.log(`[API] No auth token found`);
    }
  } catch (error) {
    logger.error('[API] Error getting session:', error);
  }

  // Prepare headers
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  // Log request body if present (sanitize sensitive data)
  if (options.body) {
    try {
      const bodyData = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
      const sanitizedBody = sanitizeRequestBody(bodyData);
      logger.log(`[API] Request body:`, JSON.stringify(sanitizedBody, null, 2));
    } catch (e) {
      // Don't log raw body if it's not JSON (might contain sensitive data)
      logger.log(`[API] Request body: [non-JSON data]`);
    }
  }

  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  try {
    const response = await fetch(fullUrl, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;

    // Log response details
    logger.log(`[API] Response: ${response.status} ${response.statusText} (${duration}ms)`);
    
    // Handle 401 unauthorized
    if (response.status === 401) {
      logger.warn('[API] Unauthorized request - 401');
    }

    // Log response headers (useful for debugging)
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    logger.log(`[API] Response headers:`, responseHeaders);

    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;
    
    if (error.name === 'AbortError') {
      logger.error(`[API] Request timeout after ${duration}ms: ${method} ${fullUrl}`);
      throw new ApiError('Request timeout', 408);
    }
    logger.error(`[API] Request failed after ${duration}ms:`, error);
    throw error;
  }
};

// API service methods using fetch API
export const apiService = {
  // Generic request methods
  get: async <T>(url: string, params?: any): Promise<T> => {
    logger.log(`[API] GET request: ${url}`);
    const response = await makeRequest(url, { method: 'GET' }, params);
    
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: response.statusText };
      }
      logger.error(`[API] GET ${url} failed:`, {
        status: response.status,
        error: errorData,
      });
      throw new ApiError(errorData.message || 'Request failed', response.status, errorData);
    }

    let data;
    try {
      data = await response.json();
      logger.log(`[API] GET ${url} success:`, JSON.stringify(data, null, 2));
    } catch (e) {
      logger.warn(`[API] GET ${url} - Response is not JSON`);
      data = {};
    }
    return data;
  },

  post: async <T>(url: string, data?: any): Promise<T> => {
    logger.log(`[API] POST request: ${url}`);
    const response = await makeRequest(url, {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: response.statusText };
      }
      logger.error(`[API] POST ${url} failed:`, {
        status: response.status,
        error: errorData,
        requestData: sanitizeRequestBody(data),
      });
      throw new ApiError(errorData.message || 'Request failed', response.status, errorData);
    }

    let responseData;
    try {
      responseData = await response.json();
      logger.log(`[API] POST ${url} success:`, JSON.stringify(responseData, null, 2));
    } catch (e) {
      logger.warn(`[API] POST ${url} - Response is not JSON`);
      responseData = {} as T;
    }
    return responseData;
  },

  put: async <T>(url: string, data?: any): Promise<T> => {
    logger.log(`[API] PUT request: ${url}`);
    const response = await makeRequest(url, {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: response.statusText };
      }
      logger.error(`[API] PUT ${url} failed:`, {
        status: response.status,
        error: errorData,
        requestData: sanitizeRequestBody(data),
      });
      throw new ApiError(errorData.message || 'Request failed', response.status, errorData);
    }

    let responseData;
    try {
      responseData = await response.json();
      logger.log(`[API] PUT ${url} success:`, JSON.stringify(responseData, null, 2));
    } catch (e) {
      logger.warn(`[API] PUT ${url} - Response is not JSON`);
      responseData = {} as T;
    }
    return responseData;
  },

  delete: async <T>(url: string): Promise<T> => {
    logger.log(`[API] DELETE request: ${url}`);
    const response = await makeRequest(url, { method: 'DELETE' });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: response.statusText };
      }
      logger.error(`[API] DELETE ${url} failed:`, {
        status: response.status,
        error: errorData,
      });
      throw new ApiError(errorData.message || 'Request failed', response.status, errorData);
    }

    // DELETE might not return data
    try {
      const responseData = await response.json();
      logger.log(`[API] DELETE ${url} success:`, JSON.stringify(responseData, null, 2));
      return responseData;
    } catch {
      logger.log(`[API] DELETE ${url} success (no response body)`);
      return {} as T;
    }
  },

  // Example API endpoints (adjust based on your backend)
  // Players
  getPlayers: () => {
    logger.log('[API] Calling getPlayers()');
    return apiService.get('/players');
  },
  getPlayer: (id: string) => {
    logger.log(`[API] Calling getPlayer(${id})`);
    return apiService.get(`/players/${id}`);
  },
  createPlayer: (data: any) => {
    logger.log(`[API] Calling createPlayer()`, sanitizeRequestBody(data));
    return apiService.post('/players', data);
  },
  updatePlayer: (id: string, data: any) => {
    logger.log(`[API] Calling updatePlayer(${id})`, sanitizeRequestBody(data));
    return apiService.put(`/players/${id}`, data);
  },
  deletePlayer: (id: string) => {
    logger.log(`[API] Calling deletePlayer(${id})`);
    return apiService.delete(`/players/${id}`);
  },

  // Matches
  getMatches: (params?: any) => {
    logger.log(`[API] Calling getMatches()`, params);
    return apiService.get('/matches', params);
  },
  getMatch: (id: string) => {
    logger.log(`[API] Calling getMatch(${id})`);
    return apiService.get(`/matches/${id}`);
  },
  createMatch: (data: any) => {
    logger.log(`[API] Calling createMatch()`, sanitizeRequestBody(data));
    return apiService.post('/matches', data);
  },
  simulateMatch: (id: string, mode: 'auto' | 'watch') => {
    logger.log(`[API] Calling simulateMatch(${id}, ${mode})`);
    return apiService.post(`/matches/${id}/simulate`, { mode });
  },

  // Health check
  checkHealth: async (): Promise<boolean> => {
    logger.log('[API] Calling checkHealth()');
    try {
      // Extract base domain from API_BASE_URL (remove /api/v1 if present)
      const baseDomain = API_BASE_URL.replace(/\/api\/v1\/?$/, '');
      const healthUrl = `${baseDomain}/api/db-test`;
      
      logger.log(`[API] Health check URL: ${healthUrl}`);
      const response = await fetch(healthUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const isHealthy = response.status === 200;
      if (isHealthy) {
        try {
          const data = await response.json();
          logger.log(`[API] Health check response:`, data);
        } catch (e) {
          // Response might not be JSON, that's okay
        }
      }
      logger.log(`[API] Health check result: ${isHealthy ? 'healthy' : 'unhealthy'}`);
      return isHealthy;
    } catch (error) {
      logger.error('[API] Health check failed:', error);
      return false;
    }
  },

  // Auth endpoints
  register: async (data: {
    email: string;
    password: string;
    nome: string;
    data_nascimento: string;
    tipo: 'client' | 'agent';
  }) => {
    logger.log(`[API] Calling register()`, sanitizeRequestBody(data));
    // Extract base domain from API_BASE_URL (remove /api/v1 if present)
    const baseDomain = API_BASE_URL.replace(/\/api\/v1\/?$/, '');
    const registerUrl = `${baseDomain}/api/auth/register`;
    
    logger.log(`[API] Register URL: ${registerUrl}`);
    
    // Get auth token
    let authToken: string | null = null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      authToken = session?.access_token || null;
      if (authToken) {
        logger.log(`[API] Auth token: ${authToken.substring(0, 20)}...`);
      } else {
        logger.log(`[API] No auth token found`);
      }
    } catch (error) {
      logger.error('[API] Error getting session:', error);
    }

    // Prepare headers
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    // Log request body (sanitize sensitive data)
    const sanitizedBody = sanitizeRequestBody(data);
    logger.log(`[API] Request body:`, JSON.stringify(sanitizedBody, null, 2));

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const startTime = Date.now();

    try {
      const response = await fetch(registerUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      logger.log(`[API] Response: ${response.status} ${response.statusText} (${duration}ms)`);

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { message: response.statusText };
        }
        logger.error(`[API] POST /api/auth/register failed:`, {
          status: response.status,
          error: errorData,
          requestData: sanitizeRequestBody(data),
        });
        throw new ApiError(errorData.message || 'Request failed', response.status, errorData);
      }

      let responseData;
      try {
        responseData = await response.json();
        logger.log(`[API] POST /api/auth/register success:`, JSON.stringify(responseData, null, 2));
      } catch (e) {
        logger.warn(`[API] POST /api/auth/register - Response is not JSON`);
        responseData = {};
      }
      return responseData;
    } catch (error: any) {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      
      if (error.name === 'AbortError') {
        logger.error(`[API] Request timeout after ${duration}ms: POST ${registerUrl}`);
        throw new ApiError('Request timeout', 408);
      }
      logger.error(`[API] Request failed after ${duration}ms:`, error);
      throw error;
    }
  },

  login: async (data: { email: string; password: string }) => {
    logger.log(`[API] Calling login()`, { email: data.email });
    // Extract base domain from API_BASE_URL (remove /api/v1 if present)
    const baseDomain = API_BASE_URL.replace(/\/api\/v1\/?$/, '');
    const loginUrl = `${baseDomain}/api/auth/login`;
    
    logger.log(`[API] Login URL: ${loginUrl}`);
    
    // Get auth token
    let authToken: string | null = null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      authToken = session?.access_token || null;
      if (authToken) {
        logger.log(`[API] Auth token: ${authToken.substring(0, 20)}...`);
      } else {
        logger.log(`[API] No auth token found`);
      }
    } catch (error) {
      logger.error('[API] Error getting session:', error);
    }

    // Prepare headers
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    // Log request body (sanitize sensitive data)
    const sanitizedBody = sanitizeRequestBody(data);
    logger.log(`[API] Request body:`, JSON.stringify(sanitizedBody, null, 2));

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const startTime = Date.now();

    try {
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      logger.log(`[API] Response: ${response.status} ${response.statusText} (${duration}ms)`);

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { message: response.statusText };
        }
        logger.error(`[API] POST /api/auth/login failed:`, {
          status: response.status,
          error: errorData,
          requestData: sanitizeRequestBody(data),
        });
        throw new ApiError(errorData.message || 'Request failed', response.status, errorData);
      }

      let responseData;
      try {
        responseData = await response.json();
        logger.log(`[API] POST /api/auth/login success:`, JSON.stringify(responseData, null, 2));
      } catch (e) {
        logger.warn(`[API] POST /api/auth/login - Response is not JSON`);
        responseData = {};
      }
      return responseData;
    } catch (error: any) {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      
      if (error.name === 'AbortError') {
        logger.error(`[API] Request timeout after ${duration}ms: POST ${loginUrl}`);
        throw new ApiError('Request timeout', 408);
      }
      logger.error(`[API] Request failed after ${duration}ms:`, error);
      throw error;
    }
  },
};

// Export for backward compatibility (if needed elsewhere)
export default apiService;

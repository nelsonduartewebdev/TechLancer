import Constants from 'expo-constants';
import { supabase } from './supabase';
import logger from './logger';

// Get API base URL from environment variables
// Try app.config.js extra first, then process.env, fallback to localhost
const API_BASE_URL = 
  Constants.expoConfig?.extra?.apiBaseUrl || 
  process.env.EXPO_PUBLIC_API_BASE_URL || 
  'http://localhost:3000/api/v1';

// Base URL for /api/* routes (profiles, tickets) - no /v1
const baseDomain = API_BASE_URL.replace(/\/api\/v1\/?$/, '');
const API_BASE = `${baseDomain}/api`;

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
  params?: any,
  baseUrl: string = API_BASE_URL
): Promise<Response> => {
  // Build full URL with query params for GET requests
  const fullUrl = buildUrl(baseUrl, url, params);
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
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
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
    response.headers.forEach((value: string, key: string) => {
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
      const healthUrl = `${API_BASE}/db-test`;
      
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
    full_name: string;
    date_of_birth: string;
    role: 'client' | 'agent';
    city?: string;
  }) => {
    logger.log(`[API] Calling register()`, sanitizeRequestBody(data));
    const registerUrl = `${API_BASE}/register`;
    
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
    const headers: Record<string, string> = {
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
        logger.error(`[API] POST /api/register failed:`, {
          status: response.status,
          error: errorData,
          requestData: sanitizeRequestBody(data),
        });
        throw new ApiError(errorData.message || 'Request failed', response.status, errorData);
      }

      let responseData;
      try {
        responseData = await response.json();
        logger.log(`[API] POST /api/register success:`, JSON.stringify(responseData, null, 2));
      } catch (e) {
        logger.warn(`[API] POST /api/register - Response is not JSON`);
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

  // --- Profiles (GET /api/profiles/{id}) ---
  getProfile: async <T = any>(id: string): Promise<T> => {
    logger.log(`[API] Calling getProfile(${id})`);
    const response = await makeRequest(`/profiles/${id}`, { method: 'GET' }, undefined, API_BASE);
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: response.statusText };
      }
      throw new ApiError(errorData.message || 'Request failed', response.status, errorData);
    }
    try {
      return await response.json();
    } catch {
      return {} as T;
    }
  },

  // --- Categories (optional backend list; mock fallback when endpoint fails) ---
  getCategories: async (): Promise<{ id: string; name: string; label_pt?: string; label_en?: string; description_pt?: string; description_en?: string }[]> => {
    const MOCK_CATEGORIES: { id: string; name: string; label_pt: string; label_en: string; description_pt: string; description_en: string }[] = [
      { id: 'laptop_repair', name: 'laptop_repair', label_pt: 'Reparação de Portáteis', label_en: 'Laptop Repair', description_pt: 'Reparação de ecrãs, teclados e hardware interno de portáteis.', description_en: 'Fixing screens, keyboards, and internal hardware for laptops.' },
      { id: 'smartphone_screen', name: 'smartphone_screen', label_pt: 'Ecrã de Smartphone', label_en: 'Smartphone Screen Replacement', description_pt: 'Reparação de ecrãs partidos em iPhones e dispositivos Android.', description_en: 'Cracked screen repairs for iPhones and Android devices.' },
      { id: 'os_installation', name: 'os_installation', label_pt: 'Instalação de Sistema', label_en: 'OS Installation', description_pt: 'Instalação limpa de Windows, macOS ou Linux.', description_en: 'Fresh install of Windows, macOS, or Linux.' },
      { id: 'virus_removal', name: 'virus_removal', label_pt: 'Remoção de Vírus', label_en: 'Virus & Malware Removal', description_pt: 'Limpeza profunda de sistemas infetados e configuração de segurança.', description_en: 'Deep cleaning of infected systems and security setup.' },
      { id: 'data_recovery', name: 'data_recovery', label_pt: 'Recuperação de Dados', label_en: 'Data Recovery', description_pt: 'Recuperação de ficheiros perdidos em discos danificados ou partições apagadas.', description_en: 'Retrieving lost files from damaged disks or deleted partitions.' },
      { id: 'network_setup', name: 'network_setup', label_pt: 'Configuração de Redes/Wi-Fi', label_en: 'Network & Wi-Fi Setup', description_pt: 'Configuração de routers e otimização do sinal.', description_en: 'Router configuration and signal optimization.' },
      { id: 'cctv_installation', name: 'cctv_installation', label_pt: 'Instalação de CCTV', label_en: 'CCTV & Security Cameras', description_pt: 'Instalação e configuração de sistemas de videovigilância.', description_en: 'Setup and configuration of security camera systems.' },
      { id: 'pc_build', name: 'pc_build', label_pt: 'Montagem de Computadores', label_en: 'Custom PC Building', description_pt: 'Montagem de PCs de secretária para gaming ou trabalho.', description_en: 'Expert assembly of gaming or workstation desktop PCs.' },
      { id: 'printer_fix', name: 'printer_fix', label_pt: 'Reparação de Impressoras', label_en: 'Printer Troubleshooting', description_pt: 'Resolução de problemas de ligação, papel encravado e drivers.', description_en: 'Fixing connectivity, paper jams, and driver issues.' },
      { id: 'smart_home', name: 'smart_home', label_pt: 'Domótica / Smart Home', label_en: 'Smart Home Integration', description_pt: 'Configuração de luzes inteligentes, fechaduras e assistentes de voz.', description_en: 'Setup of smart lights, locks, and voice assistants.' },
      { id: 'battery_replacement', name: 'battery_replacement', label_pt: 'Substituição de Bateria', label_en: 'Battery Replacement', description_pt: 'Substituição de baterias em portáteis, tablets e smartphones.', description_en: 'New batteries for laptops, tablets, and smartphones.' },
      { id: 'web_development', name: 'web_development', label_pt: 'Desenvolvimento Web', label_en: 'Web Development', description_pt: 'Correções rápidas ou projetos de desenvolvimento de websites.', description_en: 'Small fixes or custom website development projects.' },
      { id: 'software_bugs', name: 'software_bugs', label_pt: 'Resolução de Bugs', label_en: 'Software Bug Fixing', description_pt: 'Correção de erros em aplicações ou scripts personalizados.', description_en: 'Debugging custom applications or scripts.' },
      { id: 'gaming_console', name: 'gaming_console', label_pt: 'Consolas de Jogos', label_en: 'Gaming Console Repair', description_pt: 'Reparação de portas HDMI, sobreaquecimento ou leitores de disco.', description_en: 'Fixing HDMI ports, overheating, or disk drive issues.' },
      { id: 'pos_systems', name: 'pos_systems', label_pt: 'Sistemas POS', label_en: 'POS System Support', description_pt: 'Suporte técnico a sistemas de ponto de venda.', description_en: 'Technical support for point-of-sale retail systems.' },
      { id: 'cloud_storage', name: 'cloud_storage', label_pt: 'Configuração de Cloud', label_en: 'Cloud Storage Setup', description_pt: 'Configuração de iCloud, Google Drive ou servidores NAS locais.', description_en: 'Setting up iCloud, Google Drive, or local NAS servers.' },
      { id: 'hardware_cleaning', name: 'hardware_cleaning', label_pt: 'Limpeza de Hardware', label_en: 'Deep Hardware Cleaning', description_pt: 'Remoção de pó e reaplicação de pasta térmica.', description_en: 'Dust removal and thermal paste re-application.' },
      { id: 'email_config', name: 'email_config', label_pt: 'Configuração de Email', label_en: 'Email Configuration', description_pt: 'Configuração de contas de email profissionais Outlook/empresarial.', description_en: 'Setting up professional outlook/business email accounts.' },
      { id: 'tablet_repair', name: 'tablet_repair', label_pt: 'Reparação de Tablets', label_en: 'Tablet Repair', description_pt: 'Suporte de hardware e software para iPads e tablets.', description_en: 'Hardware and software support for iPads and tablets.' },
      { id: 'remote_support', name: 'remote_support', label_pt: 'Suporte Remoto', label_en: 'General Remote Support', description_pt: 'Correções rápidas via TeamViewer ou AnyDesk.', description_en: 'Quick fixes that can be done via TeamViewer or AnyDesk.' },
    ];
    try {
      const response = await makeRequest('/categories', { method: 'GET' }, undefined, API_BASE);
      if (!response.ok) return MOCK_CATEGORIES;
      const raw = await response.json();
      const list = Array.isArray(raw) ? raw : raw?.data ?? raw?.categories ?? [];
      if ((list || []).length === 0) return MOCK_CATEGORIES;
      return (list || []).map((c: any) => ({
        id: c.id,
        name: c.name ?? c.id,
        label_pt: c.label_pt ?? c.name,
        label_en: c.label_en ?? c.name,
        description_pt: c.description_pt ?? c.description ?? null,
        description_en: c.description_en ?? c.description ?? null,
      }));
    } catch {
      return MOCK_CATEGORIES;
    }
  },

  // --- Tickets ---
  getTickets: async <T = any>(params?: {
    category_id?: string;
    status?: string;
    urgency?: string;
    is_remote?: boolean;
    search?: string;
    page?: number;
  }): Promise<T> => {
    logger.log(`[API] Calling getTickets()`, params);
    const response = await makeRequest('/tickets/', { method: 'GET' }, params, API_BASE);
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: response.statusText };
      }
      throw new ApiError(errorData.message || 'Request failed', response.status, errorData);
    }
    try {
      return await response.json();
    } catch {
      return {} as T;
    }
  },

  createTicket: async <T = any>(data: {
    title: string;
    description: string;
    category_id: string;
    location_id?: string;
    city?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    device_brand?: string;
    device_model?: string;
    urgency?: string;
    is_remote?: boolean;
  }): Promise<T> => {
    logger.log(`[API] Calling createTicket()`, sanitizeRequestBody(data));
    const response = await makeRequest('/tickets/', {
      method: 'POST',
      body: JSON.stringify(data),
    }, undefined, API_BASE);
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: response.statusText };
      }
      throw new ApiError(errorData.message || 'Request failed', response.status, errorData);
    }
    try {
      return await response.json();
    } catch {
      return {} as T;
    }
  },

  getTicket: async <T = any>(id: string): Promise<T> => {
    logger.log(`[API] Calling getTicket(${id})`);
    const response = await makeRequest(`/tickets/${id}`, { method: 'GET' }, undefined, API_BASE);
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: response.statusText };
      }
      throw new ApiError(errorData.message || 'Request failed', response.status, errorData);
    }
    try {
      return await response.json();
    } catch {
      return {} as T;
    }
  },

  updateTicket: async <T = any>(id: string, data: Record<string, any>): Promise<T> => {
    logger.log(`[API] Calling updateTicket(${id})`, sanitizeRequestBody(data));
    const response = await makeRequest(`/tickets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }, undefined, API_BASE);
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: response.statusText };
      }
      throw new ApiError(errorData.message || 'Request failed', response.status, errorData);
    }
    try {
      return await response.json();
    } catch {
      return {} as T;
    }
  },

  createBid: async <T = any>(ticketId: string, data: { amount: string | number; description: string }): Promise<T> => {
    logger.log(`[API] Calling createBid(${ticketId})`, sanitizeRequestBody(data));
    const response = await makeRequest(`/tickets/${ticketId}/bids`, {
      method: 'POST',
      body: JSON.stringify(data),
    }, undefined, API_BASE);
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: response.statusText };
      }
      throw new ApiError(errorData.message || 'Request failed', response.status, errorData);
    }
    try {
      return await response.json();
    } catch {
      return {} as T;
    }
  },

  // Locations (saved places: Home, Office, custom)
  getLocations: async <T = any[]>(): Promise<T> => {
    logger.log('[API] Calling getLocations()');
    const response = await makeRequest('/locations/', { method: 'GET' }, undefined, API_BASE);
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: response.statusText };
      }
      throw new ApiError(errorData.message || 'Request failed', response.status, errorData);
    }
    try {
      const data = await response.json();
      const list = Array.isArray(data) ? data : (data?.data ?? data?.locations ?? []);
      return list as T;
    } catch {
      return [] as T;
    }
  },

  createLocation: async <T = any>(data: {
    label: string;
    address?: string;
    city: string;
    country?: string;
    latitude?: number;
    longitude?: number;
    postal_code?: string;
  }): Promise<T> => {
    logger.log('[API] Calling createLocation()', sanitizeRequestBody(data));
    const response = await makeRequest('/locations/', {
      method: 'POST',
      body: JSON.stringify(data),
    }, undefined, API_BASE);
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: response.statusText };
      }
      throw new ApiError(errorData.message || 'Request failed', response.status, errorData);
    }
    try {
      return await response.json();
    } catch {
      return {} as T;
    }
  },

  updateLocation: async <T = any>(id: string, data: Partial<{
    label: string;
    address: string;
    city: string;
    country: string;
    latitude: number;
    longitude: number;
    postal_code: string;
  }>): Promise<T> => {
    logger.log('[API] Calling updateLocation()', id, sanitizeRequestBody(data));
    const response = await makeRequest(`/locations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }, undefined, API_BASE);
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: response.statusText };
      }
      throw new ApiError(errorData.message || 'Request failed', response.status, errorData);
    }
    try {
      return await response.json();
    } catch {
      return {} as T;
    }
  },

  deleteLocation: async (id: string): Promise<void> => {
    logger.log('[API] Calling deleteLocation()', id);
    const response = await makeRequest(`/locations/${id}`, { method: 'DELETE' }, undefined, API_BASE);
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: response.statusText };
      }
      throw new ApiError(errorData.message || 'Request failed', response.status, errorData);
    }
  },

  login: async (data: { email: string; password: string }) => {
    logger.log(`[API] Calling login()`, { email: data.email });
    const loginUrl = `${API_BASE}/login`;
    
    logger.log(`[API] Login URL: ${loginUrl}`);

    // Login is unauthenticated — do NOT send Authorization header so backend accepts the request
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

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
        logger.error(`[API] POST /api/login failed:`, {
          status: response.status,
          error: errorData,
          requestData: sanitizeRequestBody(data),
        });
        throw new ApiError(errorData.message || 'Request failed', response.status, errorData);
      }

      let responseData;
      try {
        responseData = await response.json();
        logger.log(`[API] POST /api/login success:`, JSON.stringify(responseData, null, 2));
      } catch (e) {
        logger.warn(`[API] POST /api/login - Response is not JSON`);
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

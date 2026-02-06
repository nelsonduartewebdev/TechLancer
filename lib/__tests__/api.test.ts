import { apiService } from '../api';

// Mock fetch globally
global.fetch = jest.fn();

// Mock supabase
jest.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: null },
      }),
    },
  },
}));

describe('API Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  describe('register', () => {
    it('should call POST /auth/register with correct data', async () => {
      const mockResponse = { success: true, user: { id: '123' } };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
      });

      const registerData = {
        email: 'test@example.com',
        password: 'Password123!',
        nome: 'Test User',
        data_nascimento: '2000-01-01',
        tipo: 'client' as const,
      };

      const result = await apiService.register(registerData);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toContain('/auth/register');
      expect(callArgs[1]?.method).toBe('POST');
      expect(JSON.parse(callArgs[1]?.body)).toEqual(registerData);
      expect(result).toEqual(mockResponse);
    });

    it('should handle registration errors', async () => {
      const errorResponse = { message: 'Email already exists' };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => errorResponse,
        headers: new Headers(),
      });

      const registerData = {
        email: 'existing@example.com',
        password: 'Password123!',
        nome: 'Test User',
        data_nascimento: '2000-01-01',
        tipo: 'client' as const,
      };

      await expect(apiService.register(registerData)).rejects.toThrow();
    });
  });

  describe('login', () => {
    it('should call POST /auth/login with email and password', async () => {
      const mockResponse = { success: true, token: 'mock-token' };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
      });

      const loginData = {
        email: 'test@example.com',
        password: 'Password123!',
      };

      const result = await apiService.login(loginData);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toContain('/auth/login');
      expect(callArgs[1]?.method).toBe('POST');
      expect(JSON.parse(callArgs[1]?.body)).toEqual(loginData);
      expect(result).toEqual(mockResponse);
    });

    it('should handle login errors', async () => {
      const errorResponse = { message: 'Invalid credentials' };
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => errorResponse,
        headers: new Headers(),
      });

      const loginData = {
        email: 'test@example.com',
        password: 'WrongPassword',
      };

      await expect(apiService.login(loginData)).rejects.toThrow();
    });
  });
});

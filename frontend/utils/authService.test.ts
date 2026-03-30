import { authService } from './authService';
import { supabase } from './supabaseClient';

// Mock Supabase client
jest.mock('./supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn(),
    },
  },
}));

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('signIn', () => {
    it('returns user and session on successful sign-in', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      const mockSession = { access_token: 'token-abc' };
      
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValueOnce({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      const result = await authService.signIn('test@example.com', 'password123');

      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
      expect(result.user).toEqual(mockUser);
      expect(result.session).toEqual(mockSession);
      expect(result.error).toBeNull();
    });

    it('returns an error on failed sign-in', async () => {
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'Invalid credentials' },
      });

      const result = await authService.signIn('test@example.com', 'wrong-password');

      expect(supabase.auth.signInWithPassword).toHaveBeenCalled();
      expect(result.user).toBeNull();
      expect(result.session).toBeNull();
      expect(result.error).toBe('Invalid credentials');
    });
  });

  describe('signOut', () => {
    it('returns success on successful sign-out', async () => {
      (supabase.auth.signOut as jest.Mock).mockResolvedValueOnce({ error: null });

      const result = await authService.signOut();

      expect(supabase.auth.signOut).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
    });

    it('returns error on failed sign-out', async () => {
      (supabase.auth.signOut as jest.Mock).mockResolvedValueOnce({ 
        error: { message: 'Network error during sign-out' } 
      });

      const result = await authService.signOut();

      expect(supabase.auth.signOut).toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error during sign-out');
    });
  });

  describe('getSession', () => {
    it('returns session if exists', async () => {
      const mockSession = { access_token: 'active-session' };
      (supabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      const result = await authService.getSession();

      expect(supabase.auth.getSession).toHaveBeenCalled();
      expect(result.session).toEqual(mockSession);
      expect(result.error).toBeNull();
    });
  });
});

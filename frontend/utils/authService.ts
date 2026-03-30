import { supabase } from './supabaseClient';

/**
 * Authentication service for Stellar Raise.
 * Handles user sign-in and sign-out using Supabase Auth.
 */
export const authService = {
  /**
   * Signs in a user with email and password.
   * @param email The user's email address.
   * @param password The user's password.
   */
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      return { user: null, session: null, error: error.message };
    }
    
    return { user: data.user, session: data.session, error: null };
  },

  /**
   * Signs out the current user.
   */
  async signOut() {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return { success: true, error: null };
  },

  /**
   * Gets the current user session.
   */
  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      return { session: null, error: error.message };
    }
    
    return { session: data.session, error: null };
  }
};

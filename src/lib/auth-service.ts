import { supabase, isSupabaseEnabled } from './supabase';
import type { User } from '@supabase/supabase-js';

export type UserRole = 'practitioner' | 'admin' | 'client';

export interface AuthUser extends User {
  role?: UserRole;
}

export class AuthService {
  /**
   * Ensure Supabase is configured
   */
  private static ensureSupabase() {
    if (!isSupabaseEnabled || !supabase) {
      throw new Error('Supabase is not configured. Please check your environment variables.');
    }
    return supabase;
  }

  /**
   * Sign up with email and password
   * Note: Supabase will create a session immediately if email confirmation is disabled.
   * If email confirmation is enabled in Supabase settings, session will only be created
   * after the user clicks the verification link in their email.
   */
  static async signUp(email: string, password: string, fullName?: string, role: UserRole = 'practitioner', invitationCode?: string) {
    const client = this.ensureSupabase();
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
          invitation_code: invitationCode,
        },
        emailRedirectTo: `${window.location.origin}/`,
      },
    });

    if (error) throw error;
    return data;
  }

  /**
   * Sign in with email and password
   */
  static async signIn(email: string, password: string) {
    const client = this.ensureSupabase();
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  }

  /**
   * Sign in with role validation (for role-specific login pages)
   */
  static async signInWithRole(email: string, password: string, expectedRole: UserRole) {
    const client = this.ensureSupabase();
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    const userRole = data.user?.user_metadata?.role as UserRole;
    
    // Validate role matches expected
    if (userRole !== expectedRole) {
      // Sign out the user since they used the wrong portal
      await this.signOut();
      throw new Error(`This account is not registered as a ${expectedRole}. Please use the correct login portal.`);
    }

    return data;
  }

  /**
   * Sign out
   */
  static async signOut() {
    const client = this.ensureSupabase();
    const { error } = await client.auth.signOut();
    if (error) throw error;
  }

  /**
   * Get current user with role
   */
  static async getCurrentUser(): Promise<AuthUser | null> {
    const client = this.ensureSupabase();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return null;

    return {
      ...user,
      role: user.user_metadata?.role as UserRole,
    };
  }

  /**
   * Get user role
   */
  static getUserRole(user: User | null): UserRole {
    if (!user) return 'practitioner';
    return user.user_metadata?.role as UserRole || 'practitioner';
  }

  /**
   * Request password reset
   */
  static async resetPassword(email: string) {
    const client = this.ensureSupabase();
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) throw error;
  }

  /**
   * Update password
   */
  static async updatePassword(newPassword: string) {
    const client = this.ensureSupabase();
    const { error } = await client.auth.updateUser({
      password: newPassword,
    });

    if (error) throw error;
  }

  /**
   * Resend verification email
   */
  static async resendVerificationEmail() {
    const client = this.ensureSupabase();
    const { data: { user } } = await client.auth.getUser();
    
    if (!user?.email) {
      throw new Error('No user email found');
    }

    const { error } = await client.auth.resend({
      type: 'signup',
      email: user.email,
    });

    if (error) throw error;
  }

  /**
   * Social login (Google)
   * Note: This handles both signup and signin automatically.
   * If the email doesn't exist, Supabase creates a new account.
   * If the email exists, Supabase logs them in.
   */
  static async signInWithGoogle() {
    const client = this.ensureSupabase();
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) throw error;
  }

  /**
   * Social login (Apple)
   * Note: This handles both signup and signin automatically.
   * If the email doesn't exist, Supabase creates a new account.
   * If the email exists, Supabase logs them in.
   */
  static async signInWithApple() {
    const client = this.ensureSupabase();
    const { error } = await client.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });

    if (error) throw error;
  }

  /**
   * Listen to auth state changes
   */
  static onAuthStateChange(callback: (user: AuthUser | null) => void) {
    const client = this.ensureSupabase();
    return client.auth.onAuthStateChange(async (event, session) => {
      const user = session?.user;
      if (user) {
        let role = user.user_metadata?.role as UserRole;
        
        // If user signed up via OAuth and doesn't have a role, set default to 'practitioner'
        if (!role && (event === 'SIGNED_IN' || event === 'USER_UPDATED')) {
          role = 'practitioner';
          // Update user metadata with default role
          try {
            await client.auth.updateUser({
              data: { role: 'practitioner' }
            });
          } catch (error) {
            console.error('Failed to set default role:', error);
          }
        }
        
        callback({
          ...user,
          role: role || 'practitioner',
        });
      } else {
        callback(null);
      }
    });
  }

  /**
   * Check if user is admin
   */
  static isAdmin(user: User | null): boolean {
    return this.getUserRole(user) === 'admin';
  }

  /**
   * Check if user is practitioner
   */
  static isPractitioner(user: User | null): boolean {
    return this.getUserRole(user) === 'practitioner';
  }

  /**
   * Check if user is client
   */
  static isClient(user: User | null): boolean {
    return this.getUserRole(user) === 'client';
  }
}

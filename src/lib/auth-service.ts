import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';

export type UserRole = 'practitioner' | 'admin' | 'client';

export interface AuthUser extends User {
  role?: UserRole;
}

export class AuthService {
  /**
   * Sign up with email and password
   */
  static async signUp(email: string, password: string, fullName?: string, role: UserRole = 'practitioner', invitationCode?: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
          invitation_code: invitationCode,
        },
      },
    });

    if (error) throw error;
    return data;
  }

  /**
   * Sign in with email and password
   */
  static async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
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
    const { data, error } = await supabase.auth.signInWithPassword({
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
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  /**
   * Get current user with role
   */
  static async getCurrentUser(): Promise<AuthUser | null> {
    const { data: { user } } = await supabase.auth.getUser();
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
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) throw error;
  }

  /**
   * Update password
   */
  static async updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) throw error;
  }

  /**
   * Social login (Google)
   */
  static async signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (error) throw error;
  }

  /**
   * Social login (Apple)
   */
  static async signInWithApple() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (error) throw error;
  }

  /**
   * Listen to auth state changes
   */
  static onAuthStateChange(callback: (user: AuthUser | null) => void) {
    return supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      if (user) {
        callback({
          ...user,
          role: user.user_metadata?.role as UserRole,
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

/**
 * Audit Logging Service
 * Provides client-side audit logging capabilities
 */

import { supabase } from './supabase';

export type AuditAction =
  | 'login'
  | 'logout'
  | 'login_failed'
  | 'create_client'
  | 'update_client'
  | 'delete_client'
  | 'create_analysis'
  | 'update_analysis'
  | 'delete_analysis'
  | 'update_settings'
  | 'create_benchmark'
  | 'update_benchmark'
  | 'delete_benchmark';

export type AuditResourceType = 'auth' | 'client' | 'analysis' | 'settings' | 'benchmark';

export type AuditStatus = 'success' | 'failure' | 'error';

export interface AuditLogEntry {
  action: AuditAction;
  resource_type?: AuditResourceType;
  resource_id?: string;
  status: AuditStatus;
  error_message?: string;
  metadata?: Record<string, any>;
}

class AuditLogger {
  private static instance: AuditLogger;
  private pendingLogs: AuditLogEntry[] = [];
  private flushInterval: ReturnType<typeof setInterval> | null = null;

  private constructor() {
    // Flush pending logs every 5 seconds
    this.flushInterval = setInterval(() => this.flush(), 5000);

    // Flush on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.flush());
    }
  }

  public static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  /**
   * Log an audit event
   */
  public async log(entry: AuditLogEntry): Promise<void> {
    if (!supabase) {
      console.warn('[AuditLogger] Supabase not configured, skipping audit log');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        // Store in pending queue if user not authenticated yet
        this.pendingLogs.push(entry);
        return;
      }

      const user = session.user;

      const logData = {
        user_id: user.id,
        user_email: user.email,
        action: entry.action,
        resource_type: entry.resource_type,
        resource_id: entry.resource_id,
        status: entry.status,
        error_message: entry.error_message,
        metadata: entry.metadata || {}
      };

      // Insert audit log
      const { error } = await supabase
        .from('audit_logs')
        .insert(logData);

      if (error) {
        console.error('[AuditLogger] Failed to write audit log:', error);
        // Store in localStorage as fallback
        this.storeInLocalStorage(logData);
      }
    } catch (error) {
      console.error('[AuditLogger] Error logging audit event:', error);
      this.storeInLocalStorage(entry);
    }
  }

  /**
   * Log a successful action
   */
  public async logSuccess(
    action: AuditAction,
    resource_type?: AuditResourceType,
    resource_id?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    return this.log({
      action,
      resource_type,
      resource_id,
      status: 'success',
      metadata
    });
  }

  /**
   * Log a failed action
   */
  public async logFailure(
    action: AuditAction,
    error_message: string,
    resource_type?: AuditResourceType,
    resource_id?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    return this.log({
      action,
      resource_type,
      resource_id,
      status: 'failure',
      error_message,
      metadata
    });
  }

  /**
   * Log an error
   */
  public async logError(
    action: AuditAction,
    error: Error | unknown,
    resource_type?: AuditResourceType,
    resource_id?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return this.log({
      action,
      resource_type,
      resource_id,
      status: 'error',
      error_message: errorMessage,
      metadata
    });
  }

  /**
   * Flush pending logs
   */
  private async flush(): Promise<void> {
    if (this.pendingLogs.length === 0) return;

    const logsToFlush = [...this.pendingLogs];
    this.pendingLogs = [];

    for (const log of logsToFlush) {
      await this.log(log);
    }
  }

  /**
   * Store in localStorage as fallback when database is unavailable
   */
  private storeInLocalStorage(logData: any): void {
    try {
      const key = 'audit_log_fallback';
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      existing.push({
        ...logData,
        timestamp: new Date().toISOString()
      });
      // Keep only last 100 entries
      const recent = existing.slice(-100);
      localStorage.setItem(key, JSON.stringify(recent));
    } catch (e) {
      console.error('[AuditLogger] Failed to store in localStorage:', e);
    }
  }

  /**
   * Get recent audit logs for current user
   */
  public async getRecentLogs(limit: number = 50): Promise<any[]> {
    if (!supabase) return [];

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return [];

      const user = session.user;

      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[AuditLogger] Failed to fetch audit logs:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[AuditLogger] Error fetching audit logs:', error);
      return [];
    }
  }

  /**
   * Get failed actions for security monitoring
   */
  public async getFailedActions(limit: number = 50): Promise<any[]> {
    if (!supabase) return [];

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return [];

      const user = session.user;

      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['failure', 'error'])
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[AuditLogger] Failed to fetch failed actions:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[AuditLogger] Error fetching failed actions:', error);
      return [];
    }
  }

  /**
   * Cleanup: Stop flush interval
   */
  public destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }
}

// Export singleton instance
export const auditLogger = AuditLogger.getInstance();

// Convenience functions
export async function logAuditSuccess(
  action: AuditAction,
  resource_type?: AuditResourceType,
  resource_id?: string,
  metadata?: Record<string, any>
): Promise<void> {
  return auditLogger.logSuccess(action, resource_type, resource_id, metadata);
}

export async function logAuditFailure(
  action: AuditAction,
  error_message: string,
  resource_type?: AuditResourceType,
  resource_id?: string,
  metadata?: Record<string, any>
): Promise<void> {
  return auditLogger.logFailure(action, error_message, resource_type, resource_id, metadata);
}

export async function logAuditError(
  action: AuditAction,
  error: Error | unknown,
  resource_type?: AuditResourceType,
  resource_id?: string,
  metadata?: Record<string, any>
): Promise<void> {
  return auditLogger.logError(action, error, resource_type, resource_id, metadata);
}

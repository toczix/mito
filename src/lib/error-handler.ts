/**
 * Centralized error handling and logging utility
 */

export const ErrorSeverity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
} as const;

export type ErrorSeverity = typeof ErrorSeverity[keyof typeof ErrorSeverity];

export interface ErrorContext {
  userId?: string;
  clientId?: string;
  analysisId?: string;
  component?: string;
  action?: string;
  [key: string]: any;
}

export interface ErrorReport {
  message: string;
  severity: ErrorSeverity;
  context?: ErrorContext;
  timestamp: string;
  stack?: string;
  userAgent: string;
  url: string;
}

class ErrorHandler {
  private static instance: ErrorHandler;
  private errorQueue: ErrorReport[] = [];
  private isInitialized = false;

  private constructor() {
    this.initialize();
  }

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  private initialize() {
    if (this.isInitialized) return;

    // Global error handlers
    window.addEventListener('error', (event) => {
      this.handleError(event.error || new Error(event.message), {
        severity: ErrorSeverity.HIGH,
        context: {
          component: 'window',
          action: 'global_error'
        }
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(
        event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
        {
          severity: ErrorSeverity.HIGH,
          context: {
            component: 'window',
            action: 'unhandled_promise_rejection'
          }
        }
      );
    });

    this.isInitialized = true;
    console.log('[ErrorHandler] Initialized');
  }

  public handleError(
    error: Error | unknown,
    options: {
      severity?: ErrorSeverity;
      context?: ErrorContext;
      silent?: boolean;
    } = {}
  ) {
    const {
      severity = ErrorSeverity.MEDIUM,
      context = {},
      silent = false
    } = options;

    const errorObj = error instanceof Error ? error : new Error(String(error));

    const report: ErrorReport = {
      message: errorObj.message,
      severity,
      context,
      timestamp: new Date().toISOString(),
      stack: errorObj.stack,
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    // Log to console based on severity
    if (!silent) {
      this.logToConsole(report);
    }

    // Store in queue
    this.errorQueue.push(report);

    // Store in localStorage for debugging
    this.storeInLocalStorage(report);

    // Send to monitoring service (if configured)
    this.sendToMonitoring(report);

    return report;
  }

  private logToConsole(report: ErrorReport) {
    const prefix = `[${report.severity.toUpperCase()}]`;
    const message = `${prefix} ${report.message}`;

    switch (report.severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        console.error(message, report);
        break;
      case ErrorSeverity.MEDIUM:
        console.warn(message, report);
        break;
      case ErrorSeverity.LOW:
        console.log(message, report);
        break;
    }
  }

  private storeInLocalStorage(report: ErrorReport) {
    try {
      const key = 'error_log';
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      existing.push(report);
      // Keep only last 50 errors
      const recentErrors = existing.slice(-50);
      localStorage.setItem(key, JSON.stringify(recentErrors));
    } catch (e) {
      console.error('Failed to store error in localStorage:', e);
    }
  }

  private async sendToMonitoring(report: ErrorReport) {
    // TODO: Integrate with monitoring service (e.g., Sentry, LogRocket)
    // For now, this is a placeholder

    // Only send HIGH and CRITICAL errors to avoid noise
    if (report.severity === ErrorSeverity.HIGH || report.severity === ErrorSeverity.CRITICAL) {
      // Example: Send to Supabase Edge Function for logging
      try {
        // Uncomment when ready to implement
        /*
        const { supabase } = await import('./supabase');
        if (supabase) {
          await supabase.functions.invoke('log-error', {
            body: report
          });
        }
        */
      } catch (e) {
        console.error('Failed to send error to monitoring:', e);
      }
    }
  }

  public getErrorLog(): ErrorReport[] {
    return [...this.errorQueue];
  }

  public clearErrorLog() {
    this.errorQueue = [];
    try {
      localStorage.removeItem('error_log');
    } catch (e) {
      console.error('Failed to clear error log:', e);
    }
  }

  public getStoredErrors(): ErrorReport[] {
    try {
      return JSON.parse(localStorage.getItem('error_log') || '[]');
    } catch (e) {
      console.error('Failed to retrieve stored errors:', e);
      return [];
    }
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();

// Convenience functions
export function logError(error: Error | unknown, context?: ErrorContext) {
  return errorHandler.handleError(error, {
    severity: ErrorSeverity.MEDIUM,
    context
  });
}

export function logCriticalError(error: Error | unknown, context?: ErrorContext) {
  return errorHandler.handleError(error, {
    severity: ErrorSeverity.CRITICAL,
    context
  });
}

export function logWarning(error: Error | unknown, context?: ErrorContext) {
  return errorHandler.handleError(error, {
    severity: ErrorSeverity.LOW,
    context,
    silent: true
  });
}

// Authentication specific error handling
export function handleAuthError(error: Error | unknown, action: string) {
  return errorHandler.handleError(error, {
    severity: ErrorSeverity.HIGH,
    context: {
      component: 'auth',
      action
    }
  });
}

// Database operation error handling
export function handleDatabaseError(error: Error | unknown, table: string, operation: string) {
  return errorHandler.handleError(error, {
    severity: ErrorSeverity.HIGH,
    context: {
      component: 'database',
      action: `${operation}_${table}`
    }
  });
}

// API error handling
export function handleApiError(error: Error | unknown, endpoint: string) {
  return errorHandler.handleError(error, {
    severity: ErrorSeverity.MEDIUM,
    context: {
      component: 'api',
      action: endpoint
    }
  });
}

/**
 * Deployment Readiness Verification Script
 * Checks that all prerequisites are met before deployment
 *
 * Usage: npx tsx scripts/verify-deployment-readiness.ts
 */

import { createClient } from '@supabase/supabase-js';
import { existsSync } from 'fs';
import { resolve } from 'path';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function success(message: string) {
  log(`✅ ${message}`, colors.green);
}

function error(message: string) {
  log(`❌ ${message}`, colors.red);
}

function warning(message: string) {
  log(`⚠️  ${message}`, colors.yellow);
}

function info(message: string) {
  log(`ℹ️  ${message}`, colors.cyan);
}

function header(message: string) {
  console.log();
  log('='.repeat(60), colors.blue);
  log(message, colors.blue);
  log('='.repeat(60), colors.blue);
  console.log();
}

let checksPassed = 0;
let checksFailed = 0;
let checksWarning = 0;

async function checkEnvironmentVariables() {
  header('Environment Variables');

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const authDisabled = process.env.VITE_AUTH_DISABLED;

  if (supabaseUrl) {
    success(`VITE_SUPABASE_URL: ${supabaseUrl.substring(0, 30)}...`);
    checksPassed++;
  } else {
    error('VITE_SUPABASE_URL: Not set');
    checksFailed++;
  }

  if (supabaseAnonKey) {
    success(`VITE_SUPABASE_ANON_KEY: ${supabaseAnonKey.substring(0, 20)}...`);
    checksPassed++;
  } else {
    error('VITE_SUPABASE_ANON_KEY: Not set');
    checksFailed++;
  }

  if (supabaseServiceKey) {
    success(`SUPABASE_SERVICE_ROLE_KEY: ${supabaseServiceKey.substring(0, 20)}...`);
    checksPassed++;
  } else {
    warning('SUPABASE_SERVICE_ROLE_KEY: Not set (required for scripts)');
    checksWarning++;
  }

  if (authDisabled === 'true') {
    success('VITE_AUTH_DISABLED: true (correct for pre-deployment)');
    checksPassed++;
  } else if (authDisabled === 'false') {
    warning('VITE_AUTH_DISABLED: false (auth is enabled - should be true before deployment)');
    checksWarning++;
  } else {
    warning('VITE_AUTH_DISABLED: not set (will default to enabled)');
    checksWarning++;
  }
}

async function checkMigrationFiles() {
  header('Migration Files');

  const migrations = [
    '20251104000001_fix_settings_schema.sql',
    '20251104000002_enable_auth_safely.sql',
    '20251104000003_rollback_auth.sql',
    '20251104000004_create_audit_logs.sql',
  ];

  for (const migration of migrations) {
    const path = resolve(process.cwd(), 'supabase/migrations', migration);
    if (existsSync(path)) {
      success(`Migration file exists: ${migration}`);
      checksPassed++;
    } else {
      error(`Migration file missing: ${migration}`);
      checksFailed++;
    }
  }
}

async function checkApplicationFiles() {
  header('Application Files');

  const files = [
    'src/components/ErrorBoundary.tsx',
    'src/lib/error-handler.ts',
    'src/lib/audit-logger.ts',
    'src/lib/supabase.ts',
    'src/lib/client-service.ts',
    'src/App.tsx',
    'src/pages/LoginPage.tsx',
  ];

  for (const file of files) {
    const path = resolve(process.cwd(), file);
    if (existsSync(path)) {
      success(`Application file exists: ${file}`);
      checksPassed++;
    } else {
      error(`Application file missing: ${file}`);
      checksFailed++;
    }
  }
}

async function checkScripts() {
  header('Deployment Scripts');

  const scripts = [
    'scripts/assign-clients.ts',
    'scripts/verify-deployment-readiness.ts',
  ];

  for (const script of scripts) {
    const path = resolve(process.cwd(), script);
    if (existsSync(path)) {
      success(`Script exists: ${script}`);
      checksPassed++;
    } else {
      error(`Script missing: ${script}`);
      checksFailed++;
    }
  }
}

async function checkDocumentation() {
  header('Documentation Files');

  const docs = [
    'PRODUCTION_DEPLOYMENT_GUIDE.md',
    'AUTHENTICATION_IMPLEMENTATION_SUMMARY.md',
    'PRE_DEPLOYMENT_CHECKLIST.md',
  ];

  for (const doc of docs) {
    const path = resolve(process.cwd(), doc);
    if (existsSync(path)) {
      success(`Documentation exists: ${doc}`);
      checksPassed++;
    } else {
      error(`Documentation missing: ${doc}`);
      checksFailed++;
    }
  }
}

async function checkDatabaseConnection() {
  header('Database Connection');

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    error('Cannot check database connection: Missing credentials');
    checksFailed++;
    return;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Try to query a simple table
    const { data, error } = await supabase
      .from('clients')
      .select('id', { count: 'exact', head: true });

    if (error) {
      error(`Database connection failed: ${error.message}`);
      checksFailed++;
    } else {
      success('Database connection successful');
      checksPassed++;
    }
  } catch (err) {
    error(`Database connection error: ${err}`);
    checksFailed++;
  }
}

async function checkCurrentDatabaseState() {
  header('Current Database State');

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    warning('Skipping database state check: Missing credentials');
    checksWarning++;
    return;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Check data counts
    const { count: clientsCount } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true });

    const { count: analysesCount } = await supabase
      .from('analyses')
      .select('*', { count: 'exact', head: true });

    const { count: benchmarksCount } = await supabase
      .from('custom_benchmarks')
      .select('*', { count: 'exact', head: true });

    info(`Current data counts:`);
    info(`  Clients: ${clientsCount || 0}`);
    info(`  Analyses: ${analysesCount || 0}`);
    info(`  Custom Benchmarks: ${benchmarksCount || 0}`);

    // Check for NULL user_ids
    const { count: nullClients } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .is('user_id', null);

    const { count: nullAnalyses } = await supabase
      .from('analyses')
      .select('*', { count: 'exact', head: true })
      .is('user_id', null);

    const { count: nullBenchmarks } = await supabase
      .from('custom_benchmarks')
      .select('*', { count: 'exact', head: true })
      .is('user_id', null);

    info(`Records with NULL user_id:`);
    info(`  Clients: ${nullClients || 0}`);
    info(`  Analyses: ${nullAnalyses || 0}`);
    info(`  Custom Benchmarks: ${nullBenchmarks || 0}`);

    const totalData = (clientsCount || 0) + (analysesCount || 0) + (benchmarksCount || 0);
    const totalNull = (nullClients || 0) + (nullAnalyses || 0) + (nullBenchmarks || 0);

    if (totalData === 0) {
      warning('No data in database - this is fine for new deployments');
      checksWarning++;
    } else if (totalNull === totalData) {
      success('All data has NULL user_id (expected before assignment)');
      checksPassed++;
    } else if (totalNull === 0) {
      warning('All data is already assigned - migrations may have already been run');
      checksWarning++;
    } else {
      warning('Some data assigned, some not - verify state before proceeding');
      checksWarning++;
    }
  } catch (err) {
    error(`Database state check error: ${err}`);
    checksFailed++;
  }
}

async function checkMigrationStatus() {
  header('Migration Status');

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    warning('Skipping migration status check: Missing credentials');
    checksWarning++;
    return;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Check if helper functions exist
    const { data: functions } = await supabase
      .from('pg_proc')
      .select('proname')
      .in('proname', [
        'safely_enable_rls',
        'assign_data_to_practitioner',
        'verify_auth_migration',
      ]);

    if (functions && functions.length === 3) {
      warning('Migration helper functions already exist - migrations may have been applied');
      checksWarning++;
    } else if (functions && functions.length > 0) {
      warning(`Some migration functions exist (${functions.length}/3) - partial migration?`);
      checksWarning++;
    } else {
      success('No migration functions found (clean state)');
      checksPassed++;
    }
  } catch (err) {
    // This error is expected if schema is not accessible
    info('Could not check migration status - this is normal if migrations not yet applied');
  }
}

async function generateSummary() {
  header('Summary');

  const total = checksPassed + checksFailed + checksWarning;
  info(`Total checks: ${total}`);
  success(`Passed: ${checksPassed}`);
  if (checksWarning > 0) warning(`Warnings: ${checksWarning}`);
  if (checksFailed > 0) error(`Failed: ${checksFailed}`);

  console.log();

  if (checksFailed === 0 && checksWarning === 0) {
    success('✅ ALL CHECKS PASSED - Ready for deployment!');
    console.log();
    info('Next steps:');
    info('1. Review PRE_DEPLOYMENT_CHECKLIST.md');
    info('2. Create database backup');
    info('3. Follow PRODUCTION_DEPLOYMENT_GUIDE.md');
    return true;
  } else if (checksFailed === 0) {
    warning(`⚠️  All checks passed with ${checksWarning} warning(s)`);
    console.log();
    info('Review warnings above before proceeding with deployment.');
    return true;
  } else {
    error(`❌ ${checksFailed} check(s) FAILED - NOT ready for deployment`);
    console.log();
    error('Fix failed checks before proceeding.');
    return false;
  }
}

async function main() {
  console.log();
  log('╔════════════════════════════════════════════════════════════╗', colors.blue);
  log('║     DEPLOYMENT READINESS VERIFICATION                      ║', colors.blue);
  log('║     Mito Analysis - Authentication System                  ║', colors.blue);
  log('╚════════════════════════════════════════════════════════════╝', colors.blue);

  await checkEnvironmentVariables();
  await checkMigrationFiles();
  await checkApplicationFiles();
  await checkScripts();
  await checkDocumentation();
  await checkDatabaseConnection();
  await checkCurrentDatabaseState();
  await checkMigrationStatus();

  const ready = await generateSummary();

  process.exit(ready && checksFailed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('\n❌ Fatal error during verification:', error);
  process.exit(1);
});

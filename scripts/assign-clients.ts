/**
 * Client Assignment Script
 * Assigns existing clients, analyses, and benchmarks to a practitioner account
 *
 * Usage:
 *   npx tsx scripts/assign-clients.ts chris@mitobio.co
 *   npx tsx scripts/assign-clients.ts --all-to=chris@mitobio.co
 *   npx tsx scripts/assign-clients.ts --dry-run chris@mitobio.co
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables:');
  if (!supabaseUrl) console.error('  - VITE_SUPABASE_URL');
  if (!supabaseServiceKey) console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  console.error('\nPlease set these in your .env.local file or environment');
  process.exit(1);
}

// Create Supabase client with service role key (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

interface AssignmentResult {
  clients: number;
  analyses: number;
  benchmarks: number;
  settings_created: boolean;
}

async function findUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
  const { data, error } = await supabase.auth.admin.listUsers();

  if (error) {
    console.error('❌ Error fetching users:', error.message);
    return null;
  }

  const user = data.users.find(u => u.email === email);
  if (!user) {
    console.error(`❌ No user found with email: ${email}`);
    console.log('\n💡 User must sign up first before data can be assigned');
    return null;
  }

  return { id: user.id, email: user.email! };
}

async function validateAssignment(email: string): Promise<boolean> {
  console.log('\n🔍 Pre-assignment validation...\n');

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

  console.log('Records without user_id:');
  console.log(`  Clients:           ${nullClients || 0}`);
  console.log(`  Analyses:          ${nullAnalyses || 0}`);
  console.log(`  Custom Benchmarks: ${nullBenchmarks || 0}`);

  const totalUnassigned = (nullClients || 0) + (nullAnalyses || 0) + (nullBenchmarks || 0);

  if (totalUnassigned === 0) {
    console.log('\n✅ All data is already assigned to users');
    return false;
  }

  console.log(`\nTotal unassigned records: ${totalUnassigned}`);
  console.log(`\n📋 Will assign all unassigned data to: ${email}`);

  return true;
}

async function assignData(
  email: string,
  dryRun: boolean = false
): Promise<AssignmentResult | null> {
  const user = await findUserByEmail(email);
  if (!user) return null;

  console.log(`\n✓ Found user: ${user.email} (${user.id})`);

  if (dryRun) {
    console.log('\n🔍 DRY RUN MODE - No changes will be made\n');
  }

  // Call the database function to assign data
  if (dryRun) {
    console.log('Would execute: assign_data_to_practitioner()');
    console.log('Checking what would be assigned...\n');

    // Preview what would be assigned
    const { count: clientsCount } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .is('user_id', null);

    const { count: analysesCount } = await supabase
      .from('analyses')
      .select('*', { count: 'exact', head: true })
      .is('user_id', null);

    const { count: benchmarksCount } = await supabase
      .from('custom_benchmarks')
      .select('*', { count: 'exact', head: true })
      .is('user_id', null);

    console.log('Would assign:');
    console.log(`  ${clientsCount || 0} clients`);
    console.log(`  ${analysesCount || 0} analyses`);
    console.log(`  ${benchmarksCount || 0} custom benchmarks`);

    return {
      clients: clientsCount || 0,
      analyses: analysesCount || 0,
      benchmarks: benchmarksCount || 0,
      settings_created: false
    };
  }

  // Execute assignment
  console.log('\n📝 Assigning data...\n');

  const { data, error } = await supabase.rpc('assign_data_to_practitioner', {
    practitioner_email: email,
    include_null_only: true
  });

  if (error) {
    console.error('❌ Error assigning data:', error.message);
    return null;
  }

  // Parse results
  const result: AssignmentResult = {
    clients: 0,
    analyses: 0,
    benchmarks: 0,
    settings_created: false
  };

  if (data && Array.isArray(data)) {
    for (const row of data) {
      if (row.operation === 'clients_assigned') result.clients = row.rows_affected;
      if (row.operation === 'analyses_assigned') result.analyses = row.rows_affected;
      if (row.operation === 'benchmarks_assigned') result.benchmarks = row.rows_affected;
      if (row.operation === 'settings_ensured') result.settings_created = row.rows_affected > 0;
    }
  }

  return result;
}

async function verifyAssignment(email: string): Promise<boolean> {
  console.log('\n🔍 Post-assignment verification...\n');

  const user = await findUserByEmail(email);
  if (!user) return false;

  // Check that no NULL user_ids remain
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

  // Check data assigned to this user
  const { count: userClients } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  const { count: userAnalyses } = await supabase
    .from('analyses')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  const { count: userBenchmarks } = await supabase
    .from('custom_benchmarks')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  console.log('Remaining NULL user_ids:');
  console.log(`  Clients:           ${nullClients || 0}`);
  console.log(`  Analyses:          ${nullAnalyses || 0}`);
  console.log(`  Custom Benchmarks: ${nullBenchmarks || 0}`);

  console.log(`\nData assigned to ${email}:`);
  console.log(`  Clients:           ${userClients || 0}`);
  console.log(`  Analyses:          ${userAnalyses || 0}`);
  console.log(`  Custom Benchmarks: ${userBenchmarks || 0}`);

  const hasNullRecords = (nullClients || 0) + (nullAnalyses || 0) + (nullBenchmarks || 0) > 0;

  if (hasNullRecords) {
    console.log('\n⚠️  Warning: Some records still have NULL user_id');
    return false;
  } else {
    console.log('\n✅ All records have been assigned');
    return true;
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Client Assignment Script
========================

Assigns existing clients, analyses, and benchmarks to a practitioner account.

Usage:
  npx tsx scripts/assign-clients.ts <email>
  npx tsx scripts/assign-clients.ts --dry-run <email>

Options:
  --dry-run    Preview what would be assigned without making changes

Examples:
  npx tsx scripts/assign-clients.ts chris@mitobio.co
  npx tsx scripts/assign-clients.ts --dry-run chris@mitobio.co

Prerequisites:
  - Practitioner must have signed up first
  - VITE_SUPABASE_URL environment variable must be set
  - SUPABASE_SERVICE_ROLE_KEY environment variable must be set
`);
    process.exit(0);
  }

  const dryRun = args.includes('--dry-run');
  const email = args.find(arg => !arg.startsWith('--'));

  if (!email) {
    console.error('❌ Error: Email address is required');
    console.log('Usage: npx tsx scripts/assign-clients.ts <email>');
    process.exit(1);
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.error(`❌ Error: Invalid email format: ${email}`);
    process.exit(1);
  }

  console.log('========================================');
  console.log('CLIENT ASSIGNMENT SCRIPT');
  console.log('========================================');

  // Validate there's data to assign
  const hasDataToAssign = await validateAssignment(email);
  if (!hasDataToAssign) {
    console.log('\nNothing to assign. Exiting.');
    process.exit(0);
  }

  // Assign data
  const result = await assignData(email, dryRun);

  if (!result) {
    console.error('\n❌ Assignment failed');
    process.exit(1);
  }

  console.log('\n✅ Assignment completed:');
  console.log(`  Clients assigned:           ${result.clients}`);
  console.log(`  Analyses assigned:          ${result.analyses}`);
  console.log(`  Custom benchmarks assigned: ${result.benchmarks}`);
  console.log(`  Settings created:           ${result.settings_created ? 'Yes' : 'No'}`);

  if (!dryRun) {
    // Verify assignment
    const verified = await verifyAssignment(email);

    if (verified) {
      console.log('\n========================================');
      console.log('✅ SUCCESS: Data assignment complete');
      console.log('========================================');
      console.log('\nNext steps:');
      console.log('1. Run: SELECT safely_enable_rls();');
      console.log('2. Set VITE_AUTH_DISABLED=false in .env.local');
      console.log('3. Restart the application');
    } else {
      console.log('\n⚠️  Warning: Verification failed');
      console.log('Some data may not have been assigned correctly.');
      process.exit(1);
    }
  } else {
    console.log('\n========================================');
    console.log('DRY RUN COMPLETE - No changes made');
    console.log('========================================');
    console.log('\nRun without --dry-run to execute assignment');
  }
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});

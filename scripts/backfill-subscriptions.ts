/**
 * Backfill Subscriptions Script
 * 
 * This script creates subscription records for existing users who don't have one.
 * Run this ONCE after deploying the subscription schema migration.
 * 
 * Usage:
 *   npx tsx scripts/backfill-subscriptions.ts [--dry-run] [--grandfather-pro]
 * 
 * Options:
 *   --dry-run          Preview changes without applying them
 *   --grandfather-pro  Give existing users Pro plan for 90 days (default: free trial)
 */

import { createClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing environment variables:');
  console.error('   VITE_SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface BackfillOptions {
  dryRun: boolean;
  grandfatherPro: boolean;
}

async function backfillSubscriptions(options: BackfillOptions) {
  console.log('========================================');
  console.log('SUBSCRIPTION BACKFILL SCRIPT');
  console.log('========================================\n');

  if (options.dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  if (options.grandfatherPro) {
    console.log('🎁 GRANDFATHER MODE - Existing users get Pro for 90 days\n');
  }

  // Step 1: Get all users from auth.users
  console.log('📊 Fetching all users...');
  const { data: users, error: usersError } = await supabase.auth.admin.listUsers();

  if (usersError) {
    console.error('❌ Error fetching users:', usersError);
    process.exit(1);
  }

  console.log(`   Found ${users.users.length} total users\n`);

  // Step 2: Get existing subscriptions
  console.log('📊 Fetching existing subscriptions...');
  const { data: existingSubscriptions, error: subsError } = await supabase
    .from('subscriptions')
    .select('user_id');

  if (subsError) {
    console.error('❌ Error fetching subscriptions:', subsError);
    process.exit(1);
  }

  const existingUserIds = new Set(existingSubscriptions?.map(s => s.user_id) || []);
  console.log(`   Found ${existingUserIds.size} existing subscriptions\n`);

  // Step 3: Find users without subscriptions
  const usersNeedingSubscriptions = users.users.filter(
    user => !existingUserIds.has(user.id)
  );

  console.log('========================================');
  console.log('ANALYSIS SUMMARY');
  console.log('========================================');
  console.log(`Total users:                 ${users.users.length}`);
  console.log(`Already have subscriptions:  ${existingUserIds.size}`);
  console.log(`Need subscriptions:          ${usersNeedingSubscriptions.length}`);
  console.log('========================================\n');

  if (usersNeedingSubscriptions.length === 0) {
    console.log('✅ All users already have subscriptions. Nothing to do!');
    return;
  }

  // Step 4: Create subscription records
  const now = new Date();
  const grandfatherExpiry = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days

  const newSubscriptions = usersNeedingSubscriptions.map(user => ({
    user_id: user.id,
    status: options.grandfatherPro ? 'active' : 'trialing',
    plan: options.grandfatherPro ? 'pro' : 'free',
    current_period_start: options.grandfatherPro ? now.toISOString() : null,
    current_period_end: options.grandfatherPro ? grandfatherExpiry.toISOString() : null,
    cancel_at_period_end: options.grandfatherPro ? true : false,
  }));

  console.log('Subscriptions to create:');
  console.log('----------------------------------------');
  newSubscriptions.slice(0, 5).forEach((sub, idx) => {
    console.log(`${idx + 1}. User: ${sub.user_id}`);
    console.log(`   Plan: ${sub.plan}`);
    console.log(`   Status: ${sub.status}`);
    if (sub.current_period_end) {
      console.log(`   Expires: ${sub.current_period_end}`);
    }
    console.log('');
  });
  if (newSubscriptions.length > 5) {
    console.log(`   ... and ${newSubscriptions.length - 5} more\n`);
  }
  console.log('========================================\n');

  if (options.dryRun) {
    console.log('🔍 DRY RUN COMPLETE - No changes were made');
    console.log('   Run without --dry-run to apply these changes\n');
    return;
  }

  // Insert subscriptions
  console.log('💾 Creating subscription records...');
  const { data: inserted, error: insertError } = await supabase
    .from('subscriptions')
    .insert(newSubscriptions)
    .select();

  if (insertError) {
    console.error('❌ Error creating subscriptions:', insertError);
    process.exit(1);
  }

  console.log(`✅ Successfully created ${inserted?.length || 0} subscriptions\n`);

  // Step 5: Verify
  console.log('🔍 Verifying backfill...');
  const { count: finalCount, error: countError } = await supabase
    .from('subscriptions')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('❌ Error verifying:', countError);
    process.exit(1);
  }

  console.log(`   Total subscriptions now: ${finalCount}\n`);

  console.log('========================================');
  console.log('✅ BACKFILL COMPLETE!');
  console.log('========================================');
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: BackfillOptions = {
  dryRun: args.includes('--dry-run'),
  grandfatherPro: args.includes('--grandfather-pro'),
};

// Run the backfill
backfillSubscriptions(options).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

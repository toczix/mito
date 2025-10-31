#!/usr/bin/env node

/**
 * Admin Script: Assign Existing Clients to a Practitioner
 *
 * Usage:
 *   node scripts/assign-clients.js chris@example.com
 *
 * This script assigns all unassigned (user_id IS NULL) data to a specific practitioner.
 */

import { createClient } from '@supabase/supabase-js';
import * as readline from 'readline';

// Get Supabase credentials from environment
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing Supabase credentials');
  console.error('');
  console.error('Please set environment variables:');
  console.error('  VITE_SUPABASE_URL=https://your-project.supabase.co');
  console.error('  SUPABASE_SERVICE_KEY=your-service-role-key');
  console.error('');
  console.error('Get the service key from: Supabase Dashboard → Settings → API');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const email = process.argv[2];

if (!email) {
  console.error('❌ Error: No email provided');
  console.error('');
  console.error('Usage:');
  console.error('  node scripts/assign-clients.js chris@example.com');
  process.exit(1);
}

async function assignClients() {
  console.log('🔍 Looking up user:', email);
  console.log('');

  // Find user by email
  const { data: users, error: userError } = await supabase.auth.admin.listUsers();

  if (userError) {
    console.error('❌ Error fetching users:', userError.message);
    process.exit(1);
  }

  const user = users.users.find(u => u.email === email);

  if (!user) {
    console.error('❌ User not found:', email);
    console.error('');
    console.error('Make sure the user has signed up first!');
    process.exit(1);
  }

  console.log('✅ Found user:');
  console.log('   ID:', user.id);
  console.log('   Email:', user.email);
  console.log('   Created:', new Date(user.created_at).toLocaleString());
  console.log('');

  // Count unassigned data
  const { count: clientCount } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .is('user_id', null);

  const { count: analysisCount } = await supabase
    .from('analyses')
    .select('*', { count: 'exact', head: true })
    .is('user_id', null);

  console.log('📊 Unassigned data:');
  console.log(`   Clients: ${clientCount || 0}`);
  console.log(`   Analyses: ${analysisCount || 0}`);
  console.log('');

  if ((clientCount || 0) === 0 && (analysisCount || 0) === 0) {
    console.log('ℹ️  No unassigned data found. Nothing to do!');
    process.exit(0);
  }

  // Ask for confirmation
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const answer = await new Promise(resolve => {
    rl.question(`⚠️  Assign all unassigned data to ${email}? (yes/no): `, resolve);
  });

  rl.close();

  if (answer.toLowerCase() !== 'yes') {
    console.log('❌ Cancelled');
    process.exit(0);
  }

  console.log('');
  console.log('📝 Assigning data...');

  // Assign clients
  const { error: clientError } = await supabase
    .from('clients')
    .update({ user_id: user.id })
    .is('user_id', null);

  if (clientError) {
    console.error('❌ Error assigning clients:', clientError.message);
  } else {
    console.log(`✅ Assigned ${clientCount || 0} clients`);
  }

  // Assign analyses
  const { error: analysisError } = await supabase
    .from('analyses')
    .update({ user_id: user.id })
    .is('user_id', null);

  if (analysisError) {
    console.error('❌ Error assigning analyses:', analysisError.message);
  } else {
    console.log(`✅ Assigned ${analysisCount || 0} analyses`);
  }

  // Assign custom benchmarks (if any)
  const { error: benchmarkError } = await supabase
    .from('custom_benchmarks')
    .update({ user_id: user.id })
    .is('user_id', null);

  if (benchmarkError && benchmarkError.code !== 'PGRST116') {
    console.error('❌ Error assigning benchmarks:', benchmarkError.message);
  } else {
    console.log('✅ Assigned custom benchmarks');
  }

  console.log('');
  console.log('🎉 Done! All data assigned to', email);
}

assignClients().catch(err => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});

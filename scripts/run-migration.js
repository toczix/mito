#!/usr/bin/env node

/**
 * Run the authentication migration directly via Supabase client
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

async function runMigration() {
  console.log('📖 Reading migration file...');

  const migrationPath = join(__dirname, '..', 'supabase-auth-migration.sql');
  const sql = readFileSync(migrationPath, 'utf-8');

  console.log('🔧 Running migration...');
  console.log('');

  // Split by semicolon and filter out comments and empty statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];

    // Skip comment-only blocks
    if (statement.split('\n').every(line => line.trim().startsWith('--') || line.trim() === '')) {
      continue;
    }

    try {
      const { error } = await supabase.rpc('exec_sql', { sql: statement });

      if (error) {
        console.error(`❌ Error in statement ${i + 1}:`, error.message);
        errorCount++;
      } else {
        console.log(`✅ Statement ${i + 1} executed successfully`);
        successCount++;
      }
    } catch (err) {
      console.error(`❌ Error in statement ${i + 1}:`, err.message);
      errorCount++;
    }
  }

  console.log('');
  console.log('📊 Results:');
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);

  if (errorCount === 0) {
    console.log('');
    console.log('🎉 Migration completed successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Enable Email auth in Supabase Dashboard');
    console.log('2. Deploy your app');
    console.log('3. Have Chris Voutsas sign up');
    console.log('4. Run: node scripts/assign-clients.js chris@example.com');
  }
}

runMigration().catch(err => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});

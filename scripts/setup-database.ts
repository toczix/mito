import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables:');
  if (!supabaseUrl) console.error('  - VITE_SUPABASE_URL');
  if (!supabaseServiceKey) console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create Supabase client with service role key (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  db: {
    schema: 'public'
  }
});

console.log('🚀 Starting Mito database setup...\n');

async function executeSql(sql: string, description: string): Promise<boolean> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'apikey': supabaseServiceKey!,
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Prefer': 'return=minimal'
    };
    
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query: sql })
    });
    
    if (!response.ok) {
      console.log(`  ⚠️  ${description}: Using alternative method`);
      return false;
    }
    
    console.log(`  ✅ ${description}`);
    return true;
  } catch (error) {
    console.log(`  ⚠️  ${description}: ${error instanceof Error ? error.message : 'Failed'}`);
    return false;
  }
}

async function checkTableExists(tableName: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from(tableName)
      .select('id', { count: 'exact', head: true })
      .limit(0);
    
    return !error || error.code !== 'PGRST204'; // Table exists if no error or error is not "relation does not exist"
  } catch {
    return false;
  }
}

async function setupDatabase() {
  try {
    console.log('📋 Checking existing tables...\n');
    
    const tables = ['clients', 'analyses', 'custom_benchmarks', 'settings', 'audit_logs'];
    const existingTables: string[] = [];
    
    for (const table of tables) {
      const exists = await checkTableExists(table);
      if (exists) {
        console.log(`  ✅ ${table} already exists`);
        existingTables.push(table);
      } else {
        console.log(`  ➕ ${table} needs to be created`);
      }
    }
    
    if (existingTables.length === tables.length) {
      console.log('\n✅ All tables already exist!');
      await verifySetup();
      console.log('\n🎉 Database is ready to use!');
      return;
    }
    
    console.log('\n📦 Creating missing tables via Supabase Dashboard SQL...\n');
    console.log('⚠️  Important: Please run the following SQL in your Supabase Dashboard:');
    const projectRef = supabaseUrl?.match(/https:\/\/(.+?)\.supabase\.co/)?.[1] || 'your-project';
    console.log('   1. Go to: https://supabase.com/dashboard/project/' + projectRef + '/sql');
    console.log('   2. Click "New Query"');
    console.log('   3. Copy and paste the SQL from MAGIC_LINK_SETUP.md');
    console.log('   4. Click "Run"');
    console.log('\nOr run: npm run setup-db-manual\n');
    
    // Try to enable email authentication programmatically
    console.log('📧 Checking authentication settings...');
    console.log('   Please ensure Email authentication is enabled in:');
    console.log('   Supabase Dashboard → Authentication → Providers → Email\n');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Setup check failed:', error);
    process.exit(1);
  }
}

async function verifySetup() {
  console.log('\n🔍 Verifying database setup...\n');
  
  const tables = ['clients', 'analyses', 'custom_benchmarks', 'settings', 'audit_logs'];
  let allGood = true;
  
  for (const tableName of tables) {
    const { count, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log(`  ❌ ${tableName}: Not accessible (${error.message})`);
      allGood = false;
    } else {
      console.log(`  ✅ ${tableName}: Ready (${count || 0} rows)`);
    }
  }
  
  if (allGood) {
    console.log('\n✅ All database tables are properly configured!');
  }
  
  return allGood;
}

// Run the setup
setupDatabase().catch(console.error);

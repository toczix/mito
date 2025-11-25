import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function backfillSubscriptions() {
  console.log('========================================');
  console.log('SUBSCRIPTION BACKFILL (SIMPLE VERSION)');
  console.log('========================================\n');

  try {
    // Get all unique user_ids from clients table
    console.log('📊 Finding users from clients table...');
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('user_id')
      .not('user_id', 'is', null);

    if (clientsError) {
      console.error('❌ Error fetching clients:', clientsError);
      return;
    }

    const uniqueUserIds = [...new Set(clients.map(c => c.user_id))];
    console.log(`✅ Found ${uniqueUserIds.length} unique users\n`);

    // Check which users already have subscriptions
    console.log('🔍 Checking existing subscriptions...');
    const { data: existingSubs, error: subsError } = await supabase
      .from('subscriptions')
      .select('user_id');

    if (subsError) {
      console.error('❌ Error fetching subscriptions:', subsError);
      return;
    }

    const existingUserIds = new Set(existingSubs.map(s => s.user_id));
    const usersNeedingSubs = uniqueUserIds.filter(id => !existingUserIds.has(id));

    console.log(`✅ ${existingSubs.length} users already have subscriptions`);
    console.log(`📝 ${usersNeedingSubs.length} users need subscriptions\n`);

    if (usersNeedingSubs.length === 0) {
      console.log('✅ All users already have subscriptions! Nothing to do.');
      return;
    }

    // Create subscriptions for users who don't have them
    console.log('📝 Creating subscriptions for users...');
    const newSubscriptions = usersNeedingSubs.map(userId => ({
      user_id: userId,
      status: 'trialing',
      plan: 'free',
    }));

    const { data: created, error: insertError } = await supabase
      .from('subscriptions')
      .insert(newSubscriptions)
      .select();

    if (insertError) {
      console.error('❌ Error creating subscriptions:', insertError);
      return;
    }

    console.log(`✅ Created ${created.length} new subscription records\n`);

    // Summary
    console.log('========================================');
    console.log('BACKFILL COMPLETE');
    console.log('========================================');
    console.log(`Total users: ${uniqueUserIds.length}`);
    console.log(`Already had subscriptions: ${existingSubs.length}`);
    console.log(`Newly created: ${created.length}`);
    console.log('\n✅ All users now have subscription records!');

  } catch (error: any) {
    console.error('❌ Unexpected error:', error.message);
  }
}

backfillSubscriptions();

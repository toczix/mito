import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const PRICE_ID = 'price_1SXQgMGf0SbKVsWnrJgbC6zm';

async function updatePriceId() {
  console.log('🔄 Updating Stripe price ID in Supabase config...\n');

  const { data, error } = await supabase
    .from('stripe_config')
    .update({ value: PRICE_ID })
    .eq('key', 'pro_monthly_price_id')
    .select();

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('✅ Updated successfully!');
  console.log('Price ID:', PRICE_ID);
  console.log('\nConfig record:', data);
}

updatePriceId();

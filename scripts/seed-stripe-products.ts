/**
 * Seed Stripe Products Script
 * 
 * This script creates the Mito Pro subscription product and price in Stripe.
 * Run this ONCE in development to create your products.
 * 
 * Usage:
 *   npx tsx scripts/seed-stripe-products.ts
 * 
 * The script is idempotent - it checks if products exist before creating.
 */

import { getUncachableStripeClient } from '../src/server/stripeClient';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function createProducts() {
  console.log('========================================');
  console.log('STRIPE PRODUCT SEEDING');
  console.log('========================================\n');

  try {
    const stripe = await getUncachableStripeClient();
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if product already exists
    console.log('🔍 Checking for existing products...');
    const existingProducts = await stripe.products.search({
      query: "name:'Mito Pro'",
    });

    let product;
    if (existingProducts.data.length > 0) {
      product = existingProducts.data[0];
      console.log(`✅ Found existing product: ${product.id}`);
    } else {
      console.log('🔄 Creating Mito Pro product...');
      product = await stripe.products.create({
        name: 'Mito Pro',
        description: 'Unlimited biomarker analyses for your entire patient panel',
        metadata: {
          tier: 'pro',
          features: JSON.stringify([
            'Unlimited analyses per patient',
            'Full biomarker history & trends',
            'Priority processing',
            'Cancel anytime',
          ]),
        },
      });
      console.log(`✅ Created product: ${product.id}`);
    }

    // Check if price already exists for this product
    console.log('\n🔍 Checking for existing prices...');
    const existingPrices = await stripe.prices.list({
      product: product.id,
      active: true,
    });

    let price;
    const monthlyPrice = existingPrices.data.find(
      p => p.recurring?.interval === 'month' && p.unit_amount === 2900
    );

    if (monthlyPrice) {
      price = monthlyPrice;
      console.log(`✅ Found existing monthly price: ${price.id}`);
    } else {
      console.log('🔄 Creating monthly price ($29/month)...');
      price = await stripe.prices.create({
        product: product.id,
        unit_amount: 2900, // $29.00 in cents
        currency: 'usd',
        recurring: {
          interval: 'month',
        },
        metadata: {
          plan: 'pro_monthly',
        },
      });
      console.log(`✅ Created price: ${price.id}`);
    }

    // Update Supabase config with price ID
    console.log('\n🔄 Updating Supabase config with price ID...');
    const { error: configError } = await supabase
      .from('stripe_config')
      .upsert({
        key: 'pro_monthly_price_id',
        value: price.id,
        description: 'Stripe Price ID for Pro Plan Monthly Subscription',
      });

    if (configError) {
      console.error('❌ Error updating config:', configError);
    } else {
      console.log('✅ Config updated');
    }

    console.log('\n========================================');
    console.log('SUMMARY');
    console.log('========================================');
    console.log(`Product ID:  ${product.id}`);
    console.log(`Product Name: ${product.name}`);
    console.log(`Price ID:     ${price.id}`);
    console.log(`Amount:       $${(price.unit_amount! / 100).toFixed(2)}/month`);
    console.log('========================================\n');

    console.log('✅ Stripe products seeded successfully!');
    console.log('\n💡 Next steps:');
    console.log('   1. Verify products in Stripe Dashboard');
    console.log('   2. Test checkout flow in development');
    console.log('   3. Configure webhook endpoints');

  } catch (error) {
    console.error('\n❌ Error seeding products:', error);
    process.exit(1);
  }
}

createProducts().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

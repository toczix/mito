import { getStripeSync } from './stripeClient';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string, uuid: string): Promise<void> {
    // Validate payload is a Buffer
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    // Process webhook with stripe-replit-sync
    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature, uuid);

    // Additional custom webhook handling for subscription updates
    // Parse the event to update our subscriptions table
    const stripe = await import('stripe');
    const stripeClient = new stripe.default(process.env.STRIPE_SECRET_KEY || await import('./stripeClient').then(m => m.getStripeSecretKey()), {
      apiVersion: '2025-11-17.clover',
    });

    const event = stripeClient.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET || '');

    await this.handleSubscriptionEvents(event);
  }

  private static async handleSubscriptionEvents(event: any): Promise<void> {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          const userId = session.client_reference_id || session.metadata?.user_id;
          const customerId = session.customer as string;

          if (userId && customerId) {
            // Update subscription with customer ID and subscription ID
            await supabase
              .from('subscriptions')
              .update({
                stripe_customer_id: customerId,
                stripe_subscription_id: session.subscription as string,
                status: 'active',
                plan: 'pro',
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', userId);
          }
          break;
        }

        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
          const subscription = event.data.object;
          const customerId = subscription.customer as string;

          // Find user by customer ID
          const { data: existingSub } = await supabase
            .from('subscriptions')
            .select('user_id')
            .eq('stripe_customer_id', customerId)
            .single();

          if (existingSub) {
            await supabase
              .from('subscriptions')
              .update({
                stripe_subscription_id: subscription.id,
                status: subscription.status === 'active' ? 'active' : subscription.status,
                plan: subscription.status === 'active' ? 'pro' : 'free',
                current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
                cancel_at_period_end: subscription.cancel_at_period_end || false,
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', existingSub.user_id);
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object;
          const customerId = subscription.customer as string;

          // Find user by customer ID and downgrade to free
          const { data: existingSub } = await supabase
            .from('subscriptions')
            .select('user_id')
            .eq('stripe_customer_id', customerId)
            .single();

          if (existingSub) {
            await supabase
              .from('subscriptions')
              .update({
                status: 'canceled',
                plan: 'free',
                stripe_subscription_id: null,
                current_period_start: null,
                current_period_end: null,
                cancel_at_period_end: false,
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', existingSub.user_id);
          }
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object;
          const subscriptionId = invoice.subscription as string;

          if (subscriptionId) {
            await supabase
              .from('subscriptions')
              .update({
                status: 'past_due',
                updated_at: new Date().toISOString(),
              })
              .eq('stripe_subscription_id', subscriptionId);
          }
          break;
        }
      }
    } catch (error) {
      console.error('Error handling subscription event:', error);
      // Don't throw - webhook should still return 200 to Stripe
    }
  }
}

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { getStripeClient, getStripeWebhookSecret } from './stripeClient';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const stripe = getStripeClient();
    const webhookSecret = getStripeWebhookSecret();

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err: any) {
      console.error('❌ Webhook signature verification failed:', err.message);
      throw new Error(`Webhook signature verification failed: ${err.message}`);
    }

    console.log('✅ Webhook signature verified, event type:', event.type);
    await this.handleSubscriptionEvents(event);
  }

  private static async handleSubscriptionEvents(event: Stripe.Event): Promise<void> {
    console.log('📨 Handling subscription event:', event.type);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          console.log('💳 Checkout completed:', {
            session_id: session.id,
            customer: session.customer,
            user_id: session.client_reference_id || session.metadata?.user_id,
          });
          
          const userId = session.client_reference_id || session.metadata?.user_id;
          const customerId = session.customer as string;

          if (userId && customerId) {
            const { data, error } = await supabase
              .from('subscriptions')
              .update({
                stripe_customer_id: customerId,
                stripe_subscription_id: session.subscription as string,
                status: 'active',
                plan: 'pro',
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', userId)
              .select();
            
            if (error) {
              console.error('❌ Failed to update subscription:', error);
            } else {
              console.log('✅ Subscription updated to Pro:', data);
            }
          } else {
            console.warn('⚠️ Missing userId or customerId in checkout session');
          }
          break;
        }

        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;

          const { data: existingSub } = await supabase
            .from('subscriptions')
            .select('user_id')
            .eq('stripe_customer_id', customerId)
            .single();

          if (existingSub) {
            const subAny = subscription as any;
            await supabase
              .from('subscriptions')
              .update({
                stripe_subscription_id: subscription.id,
                status: subscription.status === 'active' ? 'active' : subscription.status,
                plan: subscription.status === 'active' ? 'pro' : 'free',
                current_period_start: subAny.current_period_start ? new Date(subAny.current_period_start * 1000).toISOString() : null,
                current_period_end: subAny.current_period_end ? new Date(subAny.current_period_end * 1000).toISOString() : null,
                cancel_at_period_end: subscription.cancel_at_period_end || false,
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', existingSub.user_id);
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;

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
          const invoice = event.data.object as any;
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
    }
  }
}

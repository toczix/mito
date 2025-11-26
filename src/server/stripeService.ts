import { storage } from './storage';
import { getStripeClient } from './stripeClient';

export class StripeService {
  async createCustomer(email: string, userId: string) {
    const stripe = getStripeClient();
    return await stripe.customers.create({
      email,
      metadata: { user_id: userId },
    });
  }

  async createCheckoutSession(
    userId: string,
    email: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string
  ) {
    const stripe = getStripeClient();

    // Get or create customer
    const subscription = await storage.getUserSubscription(userId);
    let customerId = subscription?.stripe_customer_id;

    if (!customerId) {
      const customer = await this.createCustomer(email, userId);
      customerId = customer.id;

      // Update subscription with customer ID
      await storage.updateUserSubscription(userId, {
        stripe_customer_id: customerId,
      });
    }

    // Create checkout session
    // Use client_reference_id to pass user ID (reliable in webhooks)
    return await stripe.checkout.sessions.create({
      customer: customerId,
      client_reference_id: userId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        user_id: userId,
      },
    });
  }

  async createCustomerPortalSession(customerId: string, returnUrl: string) {
    const stripe = getStripeClient();
    return await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
  }

  async getProduct(productId: string) {
    return await storage.getProduct(productId);
  }

  async getSubscription(subscriptionId: string) {
    return await storage.getStripeSubscription(subscriptionId);
  }
}

export const stripeService = new StripeService();

import express from 'express';
import cors from 'cors';
import { runMigrations } from 'stripe-replit-sync';
import routes from './routes';
import { getStripeSync } from './stripeClient';
import { WebhookHandlers } from './webhookHandlers';

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration
app.use(cors({
  origin: process.env.VITE_FRONTEND_URL || 'http://localhost:5000',
  credentials: true,
}));

/**
 * Initialize Stripe schema and sync data on startup
 */
async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL environment variable is required for Stripe integration. ' +
      'Please create a PostgreSQL database first.'
    );
  }

  try {
    console.log('🔄 Initializing Stripe schema...');
    await runMigrations({ 
      databaseUrl,
      schema: 'stripe',
    });
    console.log('✅ Stripe schema ready');

    // Get StripeSync instance
    const stripeSync = await getStripeSync();

    // Set up managed webhook
    console.log('🔄 Setting up managed webhook...');
    const replitDomains = process.env.REPLIT_DOMAINS || process.env.REPL_SLUG;
    const webhookBaseUrl = replitDomains 
      ? `https://${replitDomains.split(',')[0]}` 
      : 'http://localhost:3001';
    
    const { webhook, uuid } = await stripeSync.findOrCreateManagedWebhook(
      `${webhookBaseUrl}/api/stripe/webhook`,
      {
        enabled_events: ['*'],
        description: 'Managed webhook for Mito subscription sync',
      }
    );
    console.log(`✅ Webhook configured: ${webhook.url} (UUID: ${uuid})`);

    // Sync all existing Stripe data in the background
    console.log('🔄 Starting Stripe data sync...');
    stripeSync.syncBackfill()
      .then(() => {
        console.log('✅ Stripe data synced');
      })
      .catch((err: Error) => {
        console.error('❌ Error syncing Stripe data:', err);
      });
  } catch (error) {
    console.error('❌ Failed to initialize Stripe:', error);
    throw error;
  }
}

// Initialize Stripe on startup
await initStripe();

// Register Stripe webhook route BEFORE express.json()
// This is critical - webhook needs raw Buffer, not parsed JSON
app.post(
  '/api/stripe/webhook/:uuid',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature' });
    }

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;

      // Validate that req.body is a Buffer (not parsed JSON)
      if (!Buffer.isBuffer(req.body)) {
        const errorMsg = 'STRIPE WEBHOOK ERROR: req.body is not a Buffer. ' +
          'This means express.json() ran before this webhook route. ' +
          'FIX: Move this webhook route registration BEFORE app.use(express.json()) in your code.';
        console.error(errorMsg);
        return res.status(500).json({ error: 'Webhook processing error' });
      }

      const { uuid } = req.params;
      await WebhookHandlers.processWebhook(req.body as Buffer, sig, uuid);

      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('❌ Webhook error:', error.message);

      // Log helpful error message if it's the common "payload must be Buffer" error
      if (error.message && error.message.includes('payload must be provided as a string or a Buffer')) {
        const helpfulMsg = 'STRIPE WEBHOOK ERROR: Payload is not a Buffer. ' +
          'This usually means express.json() parsed the body before the webhook handler. ' +
          'FIX: Ensure the webhook route is registered BEFORE app.use(express.json()).';
        console.error(helpfulMsg);
      }

      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

// Now apply JSON middleware for all other routes
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Register API routes
app.use(routes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'mito-backend' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Mito backend server running on port ${PORT}`);
  console.log(`📍 API endpoint: http://localhost:${PORT}/api`);
});

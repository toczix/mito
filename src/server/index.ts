import express from 'express';
import cors from 'cors';
import routes from './routes';
import { WebhookHandlers } from './webhookHandlers';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.VITE_FRONTEND_URL || 'http://localhost:5000',
  credentials: true,
}));

async function initServer() {
  const requiredEnvVars = [
    'STRIPE_SECRET_KEY',
    'STRIPE_PUBLISHABLE_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'VITE_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];

  const missing = requiredEnvVars.filter(v => !process.env[v]);
  if (missing.length > 0) {
    console.warn('⚠️ Missing environment variables:', missing.join(', '));
    console.warn('Some features may not work correctly.');
  }

  console.log('✅ Server initialized');
}

await initServer();

const webhookHandler = async (req: express.Request, res: express.Response) => {
  console.log('🔔 Webhook received:', {
    path: req.path,
    hasSignature: !!req.headers['stripe-signature'],
    bodyType: Buffer.isBuffer(req.body) ? 'Buffer' : typeof req.body,
  });

  const signature = req.headers['stripe-signature'];

  if (!signature) {
    console.error('❌ Missing stripe-signature header');
    return res.status(400).json({ error: 'Missing stripe-signature' });
  }

  try {
    const sig = Array.isArray(signature) ? signature[0] : signature;

    if (!Buffer.isBuffer(req.body)) {
      const errorMsg = 'STRIPE WEBHOOK ERROR: req.body is not a Buffer. ' +
        'This means express.json() ran before this webhook route.';
      console.error(errorMsg);
      return res.status(500).json({ error: 'Webhook processing error' });
    }

    await WebhookHandlers.processWebhook(req.body as Buffer, sig);

    console.log('✅ Webhook processed successfully');
    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('❌ Webhook error:', error.message);
    res.status(400).json({ error: 'Webhook processing error' });
  }
};

app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), webhookHandler);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(routes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'mito-backend' });
});

app.listen(PORT, () => {
  console.log(`🚀 Mito backend server running on port ${PORT}`);
  console.log(`📍 API endpoint: http://localhost:${PORT}/api`);
});

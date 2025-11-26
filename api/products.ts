import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const products = await stripe.products.list({ active: true, limit: 20 });
    const prices = await stripe.prices.list({ active: true, limit: 100 });

    const productsMap = new Map();
    
    for (const product of products.data) {
      const productPrices = prices.data.filter(p => p.product === product.id);
      productsMap.set(product.id, {
        id: product.id,
        name: product.name,
        description: product.description,
        active: product.active,
        metadata: product.metadata,
        prices: productPrices.map(price => ({
          id: price.id,
          unit_amount: price.unit_amount,
          currency: price.currency,
          recurring: price.recurring,
          active: price.active,
          metadata: price.metadata,
        })),
      });
    }

    return res.status(200).json({ data: Array.from(productsMap.values()) });
  } catch (error: any) {
    console.error('Error fetching products:', error);
    return res.status(500).json({ error: error.message });
  }
}

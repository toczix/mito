# Mito - Clinical Pathology Analysis Portal

## Overview
Mito is a React-based web application designed to automate the analysis of clinical pathology lab reports. It utilizes Claude AI to extract biomarker values and compare them against optimal reference ranges, providing comprehensive clinical interpretations. The application supports multilingual processing, various file formats (PDF, DOCX, images), and offers an optional Supabase integration for client management. Mito aims to streamline the analysis process for practitioners, offering features like custom benchmark editing, multi-tenant data isolation, and a professional user interface. The project has a business vision to provide a scalable tool for health practitioners, improving efficiency and accuracy in lab report analysis with a tiered subscription model for broader market reach.

## User Preferences
I prefer simple language. I want iterative development. Ask before making major changes. I prefer detailed explanations.

## System Architecture

### UI/UX Decisions
The application features a professional light/dark mode with the official Mito color palette, ensuring consistency and readability. Out-of-range biomarker rows are highlighted with theme-aware backgrounds. Dark mode specifically uses neutral surfaces for table row highlights to avoid a muddy color appearance, with status indicated via badges/icons. Theme switching is smooth and persistent, utilizing CSS variables and `localStorage`. UI components are built using shadcn/ui primitives.

### Technical Implementations
- **Frontend**: React 19 with TypeScript, built using Vite 7.1.
- **Styling**: Tailwind CSS v3.4 and shadcn/ui.
- **AI Integration**: Claude Haiku 4.5 via Anthropic SDK for biomarker extraction and analysis.
- **Data Processing**: Parallel processing of files, intelligently categorizing them for optimal speed:
    - Good text files: Claude Haiku (high concurrency).
    - Poor/no text files: Vision API (lower concurrency).
- **Authentication**: Email/password authentication with role-based access (practitioner, admin, client). Supports signup, password reset, and invitation requests. Authentication can be enabled/disabled via environment variables.
- **Biomarker Management**: Tracks 55 biomarkers with comprehensive clinical interpretations (low and high reasons), optimal ranges, and unit normalization. Includes alias improvements for lab-specific variations.
- **File Processing**: PDF.js for PDF text extraction, Mammoth for DOCX parsing, and Tesseract.js for OCR on images.
- **Security**: Implemented multi-tenant data isolation, ensuring each user only sees their own client data. Client-side processing is prioritized for privacy.

### Feature Specifications
- **Core Analysis**: Upload and AI-powered extraction of biomarker data from various report formats.
- **55 Biomarkers Tracked**: Comprehensive coverage across CBC, metabolic, liver, lipids, thyroid, iron, vitamins, hormones, minerals, electrolytes, enzymes, cardiovascular, and kidney function.
- **Client Management (Optional)**: Track patients and their analysis history, with secure user_id filtering.
- **Custom Benchmarks**: Editable and syncable optimal reference ranges.
- **Multilingual Support**: Ability to process reports in any language.
- **Subscription System**: Tiered model (Free, Pro) with Stripe integration for payments, usage tracking, and customer portal management.
- **API Key Management**: Claude API keys are stored securely per user in Supabase.

### System Design Choices
The application is primarily client-side, with direct API calls to Claude. A lightweight Express.js backend handles Stripe webhooks. The architecture emphasizes privacy by performing PDF processing in the browser. Vite is configured for port 5000, 0.0.0.0 host, and HMR. Deployable to any platform (Vercel, etc.) via GitHub.

### Admin Dashboard
- Located at `/admin` route, accessible only to users with `role: admin` in their Supabase user metadata
- Features: View all users, subscription status, grant/revoke free Pro access
- Admin users see an "Admin" tab in the navigation

## External Dependencies
- **AI Service**: Anthropic Claude Haiku 4.5
- **Database**: Supabase PostgreSQL (all data: auth, clients, subscriptions, API keys)
- **Payment Gateway**: Stripe (direct SDK integration, no third-party sync libraries)
- **File Processing Libraries**:
    - `pdfjs-dist` (for PDF text extraction)
    - `mammoth` (for DOCX parsing)
    - `tesseract.js` (for OCR on images)
- **UI Libraries**: `@radix-ui/*` (for UI component primitives).
- **Development Tools**: Vite (build tool).

## Environment Variables Required
### Supabase
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (backend only)

### Stripe
- `STRIPE_SECRET_KEY` - Stripe secret key (sk_test_... or sk_live_...)
- `STRIPE_PUBLISHABLE_KEY` - Stripe publishable key (pk_test_... or pk_live_...)
- `STRIPE_WEBHOOK_SECRET` - Webhook signing secret from Stripe dashboard

### Optional
- `VITE_AUTH_DISABLED` - Set to "true" to disable auth in development

## Deployment Architecture

### Development Environment (Replit)
- Frontend: Vite dev server on port 5000
- Backend: Express server on port 3001
- Vite proxy forwards `/api/*` requests to Express backend

### Production Environment (Vercel)
- Frontend: Static build served by Vercel
- Backend: Vercel serverless functions in `/api` folder
- All API routes are TypeScript serverless functions

### API Routes (Vercel Serverless)
Located in `/api` folder:
- `api/stripe/webhook.ts` - Stripe webhook handler (raw body parsing)
- `api/stripe/config.ts` - Returns Stripe publishable key
- `api/checkout.ts` - Creates Stripe checkout session
- `api/portal.ts` - Creates Stripe customer portal session
- `api/subscription.ts` - Gets user subscription status
- `api/can-analyze.ts` - Checks if user can analyze (limit enforcement)
- `api/products.ts` - Lists Stripe products/prices
- `api/sync-subscription.ts` - Manual subscription sync from Stripe
- `api/admin/users.ts` - List all users (admin only)
- `api/admin/subscription.ts` - Grant/revoke Pro access (admin only)

## Deployment Steps

### Vercel Deployment
1. Push code to GitHub
2. Connect GitHub repo to Vercel
3. Set environment variables in Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `STRIPE_SECRET_KEY`
   - `STRIPE_PUBLISHABLE_KEY`
   - `STRIPE_WEBHOOK_SECRET`
4. Configure Stripe webhook URL: `https://your-domain.vercel.app/api/stripe/webhook`

### Supabase Setup
1. Run migrations in Supabase SQL Editor
2. Set admin user: `UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || '{"role": "admin"}'::jsonb WHERE email = 'your-email';`
3. Update `stripe_config` table with actual Stripe Price ID

### Stripe Configuration
1. Create Pro product with $29/month price
2. Copy Price ID to Supabase `stripe_config` table
3. Configure webhook endpoint for events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
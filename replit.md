# Mito - Clinical Pathology Analysis Portal

## Overview
A React-based web application that uses Claude AI to automatically analyze clinical pathology lab reports and compare biomarker values against optimal reference ranges. The app supports multilingual processing, multiple file formats (PDF, DOCX, images), and optional Supabase integration for client management.

**Current State**: 55 biomarkers tracked with complete clinical interpretations, parallel processing, professional light/dark mode with Mito color palette
**Last Updated**: November 24, 2025

## Recent Changes
- **November 24, 2025**: Complete Clinical Interpretations Database ✅✅✅
  - Added lowReasons and highReasons fields to all 55 biomarkers
  - Comprehensive clinical explanations covering all categories:
    - Complete Blood Count (CBC): WBC, RBC, Hemoglobin, Hematocrit, MCV, MCH, MCHC, RDW, Platelets, Neutrophils, Lymphocytes, Monocytes, Eosinophils, Basophils
    - Metabolic: Glucose, HbA1c, Fasting Insulin
    - Liver Function: ALT, AST, ALP, GGT, Total Bilirubin, Albumin
    - Lipids: Total Cholesterol, LDL, HDL, Triglycerides
    - Thyroid: TSH, Free T3, Free T4, TPO Antibodies, Thyroglobulin Antibodies
    - Iron Studies: Ferritin, Serum Iron, TIBC, Transferrin, Transferrin Saturation %
    - Vitamins: Vitamin B12, Serum Folate, Vitamin D (25-Hydroxy D)
    - Hormones: SHBG
    - Minerals: Calcium, Phosphorus, Serum Magnesium
    - Electrolytes: Sodium, Potassium, Chloride, CO2/Bicarbonate
    - Enzymes: LDH
    - Cardiovascular: Homocysteine
    - Protein: Total Protein
    - Kidney Function: Creatinine, eGFR, BUN
  - Benchmark editor now shows prefilled high/low clinical reasons for all biomarkers
  - Enables complete clinical context for practitioners analyzing lab reports
  - All interpretations reviewed and validated by architect for accuracy
- **November 24, 2025**: Complete Color Palette Implementation ✅✅
  - Implemented official Mito color palette with EXACT specifications from design guide
  - Light mode: #fafafa background, #0055FF primary blue, rgba(0,0,0,0.08) borders
  - Dark mode: #0a0a0a background, #5B8EFF lighter blue, #27272a borders
  - **Table Row Highlights** (clean, professional):
    - Light: Colored status backgrounds (-50 colors with 30% opacity: bg-green-50/30, bg-red-50/30, bg-blue-50/30)
    - Dark: Neutral surfaces only (NO colored backgrounds - status shown via badges/icons only)
    - Hover states: Light mode 40% opacity, dark mode subtle white/5 overlay
    - **DESIGN DECISION**: Dark mode uses neutral surfaces to avoid muddy color appearance
  - **Status Badges**: bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30
  - **Purple Optimal Range Highlights**: bg-purple-500/10 with 20% border opacity
  - Removed ALL inline styles and theme detection logic - pure Tailwind opacity classes
  - Border/input transparency preserved via hsla() in Tailwind config
  - Professional, consistent appearance matching design guide exactly in both themes
- **November 24, 2025**: Critical Security Fix - Client Data Isolation
  - Fixed critical bug where all users could see ALL clients regardless of ownership
  - Implemented "fail-closed" security: queries return empty if user can't be authenticated
  - Added user_id filtering to getAllClients, getActiveClients, getPastClients, searchClientsByName
  - Each user now only sees their own clients (proper multi-tenant isolation)
  - Backward compatible with auth-disabled mode for single-user deployments
- **November 24, 2025**: UI Improvements
  - Out-of-range biomarker rows now use theme-aware backgrounds: light pink in light mode, darker red in dark mode
  - Theme automatically switches row highlighting based on light/dark mode
  - Removed footer disclaimer message for cleaner interface
- **November 24, 2025**: Light/Dark Mode Toggle Implementation
  - Created comprehensive theme system with CSS variables for both light and dark themes
  - Implemented ThemeProvider with localStorage persistence and system preference detection
  - Added theme toggle button to dashboard header (visible only when logged in)
  - Fixed all hardcoded light colors in LoadingState, AnalysisResults, and ClientConfirmation
  - Improved status color contrast for WCAG compliance in both themes
  - Semantic color tokens for success, error, warning, and info states
  - Smooth theme switching without page reload
- **November 24, 2025**: Removed OAuth Social Login Buttons
  - Removed Google and Apple login buttons from Login and Signup pages
  - Simplified authentication to email/password only
  - OAuth infrastructure removed due to Google Cloud Console configuration complexity
  - Clean, streamlined authentication experience
- **November 23, 2025**: Email/Password Authentication Implemented
  - Replaced magic link authentication with email/password login
  - Added role-based authentication (practitioner, admin, client)
  - Created separate login portals at /login/admin, /login/practitioner, /login/client
  - Implemented signup flow with optional invitation codes
  - Added password reset functionality via email
  - Created request invitation system for new users
  - Beautiful Motion-animated UI for all auth components
  - Proper React Router navigation (no page reloads)
  - Role enforcement using Supabase user_metadata
  - Authentication can be enabled/disabled via VITE_AUTH_DISABLED env var
- **November 22, 2025**: Transferrin Biomarker Added
  - Added Transferrin as separate biomarker (55 total biomarkers now)
  - TIBC and Transferrin tracked independently (labs report one or the other)
  - Optimal range: 2.2-2.9 g/L for both males and females
- **November 22, 2025**: Biomarker Alias Improvements
  - Added lab-specific aliases for HbA1C (IFCC HbA1c, DCCT HbA1c)
  - Added aliases for SHBG (SHBG re-std)
  - Added aliases for TPO Antibodies (TPOII, aTPOII, aTPO)
  - Added aliases for Thyroglobulin Antibodies (aTGII, Anti-ThyroGlobulin assay)
  - Improved extraction for multi-page lab reports with separate test sections
- **November 22, 2025**: Unit Normalization Fix
  - Fixed biomarker unit inconsistencies (e.g., "Mio./μL" → "×10¹²/L", "%" → "g/L" for Albumin)
  - Added comprehensive unit normalization in biomarker-normalizer.ts
  - Biomarker-specific unit validation (WBC differentials must be absolute counts, not %)
  - Units now match reference ranges consistently
- **November 22, 2025**: Logout Fix
  - Removed audit logging from authentication flow (was hanging on logout)
  - Logout now works instantly without hanging
- **November 22, 2025**: Magic Link Authentication - FULLY WORKING
  - Simplified to official Supabase pattern (removed all custom timeout/detection logic)
  - Fixed logout 403 errors by logging audit trail BEFORE signOut() (while session valid)
  - Magic link authentication now works instantly and reliably
  - New account creation works automatically (Supabase creates user on first magic link)
  - Switched from PKCE flow to implicit flow (correct for client-side React apps)
- **November 22, 2025**: Real-time Progress Tracking Fix
  - Fixed progress bar to update in real-time during batch processing
  - Added granular progress callbacks that fire after each file completion
  - Removed debug logging for cleaner production console output
  - Progress now updates smoothly from 20% → 90% as files complete
- **November 22, 2025**: Parallel Processing Optimization
  - Implemented hybrid text quality assessment (good/poor/none based on chars/page)
  - Added parallel processing with intelligent file categorization
  - Good text files → Claude Haiku (10 concurrent, ~2-3s each)
  - Poor/no text files → Vision API (3 concurrent, ~8-15s each)
  - Expected 3x speed improvement for mixed batches
  - Removed old sequential batch processing code
- **November 22, 2025**: Magic Link Authentication Enabled
  - Configured Supabase authentication with magic link (passwordless)
  - Set up environment variables for Supabase connection
  - Enabled multi-user support with Row Level Security (RLS)
  - Created comprehensive setup guide (MAGIC_LINK_SETUP.md)
- **November 22, 2025**: Initial Replit setup
  - Configured Vite to run on port 5000 with proper host settings (0.0.0.0)
  - Fixed HMR (Hot Module Replacement) WebSocket configuration for Replit proxy
  - Installed all npm dependencies
  - Verified application runs successfully in Replit environment

## Project Architecture

### Tech Stack
- **Frontend**: React 19 with TypeScript
- **Build Tool**: Vite 7.1
- **Styling**: Tailwind CSS v3.4 + shadcn/ui components
- **AI Integration**: Claude Haiku 4.5 (Anthropic SDK)
- **Database** (Optional): Supabase PostgreSQL
- **File Processing**: 
  - PDF.js for PDF text extraction
  - Mammoth for DOCX parsing
  - Tesseract.js for OCR on images

### Project Structure
```
mito/
├── src/
│   ├── components/         # React components
│   │   ├── ui/            # shadcn/ui components
│   │   ├── ApiKeyInput.tsx
│   │   ├── PdfUploader.tsx
│   │   ├── AnalysisResults.tsx
│   │   ├── ClientLibrary.tsx
│   │   ├── BenchmarkManager.tsx
│   │   └── LoadingState.tsx
│   ├── lib/               # Core business logic
│   │   ├── biomarkers.ts  # 57 biomarker definitions
│   │   ├── pdf-processor.ts
│   │   ├── claude-service.ts
│   │   ├── supabase.ts
│   │   └── analyzer.ts
│   ├── pages/             # Page components
│   └── App.tsx            # Main application
├── vite.config.ts         # Vite configuration (Replit-optimized)
└── package.json
```

### Key Features
1. **Core Analysis**: Upload lab reports (PDF/DOCX/images) and get AI-powered biomarker extraction
2. **55 Biomarkers Tracked**: Liver, kidney, CBC, lipids, metabolic, hormones, electrolytes, iron studies, etc.
3. **Client Management** (Optional with Supabase): Track patients, analysis history
4. **Custom Benchmarks**: Edit and sync optimal reference ranges
5. **Multilingual Support**: Process reports in any language
6. **Privacy-First**: Client-side processing, optional cloud storage

## Development Setup

### Running the Application
The app is configured to run automatically via the "Start application" workflow:
- **Command**: `npm run dev`
- **Port**: 5000 (webview)
- **Host**: 0.0.0.0 (required for Replit proxy)

### Environment Variables
Supabase configuration (already set in Replit):
```
VITE_SUPABASE_URL=https://dfgadsjqofgkrclpwgkf.supabase.co
VITE_SUPABASE_ANON_KEY=<configured>
VITE_AUTH_DISABLED=false  # Authentication is ENABLED
```

**Note**: Claude API key is now stored securely in Supabase (per-user)

### Key Dependencies
- `@anthropic-ai/sdk`: Claude AI integration
- `@supabase/supabase-js`: Optional database client
- `pdfjs-dist`: Client-side PDF processing
- `mammoth`: DOCX parsing
- `tesseract.js`: OCR for images
- `react-dropzone`: File upload handling
- `@radix-ui/*`: UI component primitives

## Replit-Specific Configuration

### Vite Configuration (vite.config.ts)
- **Port**: 5000 (Replit webview requirement)
- **Host**: 0.0.0.0 (allows Replit proxy access)
- **HMR**: Configured for Replit's WebSocket proxy with REPLIT_DEV_DOMAIN
- **Aliases**: `@` mapped to `./src`

### Workflow Setup
- Single workflow: "Start application" (`npm run dev`)
- Output type: webview
- Port: 5000

## Usage Notes

### Authentication Setup
✅ **Email/Password Authentication Configured!**

**Available Login Portals:**
- General Login: `/login` (auto-detects role)
- Admin Portal: `/login/admin` (admin users only)
- Practitioner Portal: `/login/practitioner` (practitioner users only)
- Client Portal: `/login/client` (client users only)

**Signup & Recovery:**
- Signup: `/signup` (with optional invitation code)
- Password Reset: `/forgot-password`
- Request Invite: `/request-invite`

**Toggle Authentication:**
```bash
# Development (disable auth for testing)
VITE_AUTH_DISABLED=true

# Production (enable auth)
VITE_AUTH_DISABLED=false
```

### For Users
1. **Signup**: Create account at `/signup` with email + password
2. **Login**: Use role-specific portal or general `/login`
3. **API Key Setup**: Enter Claude API key in the Settings tab (synced to your account)
4. **Upload Reports**: Drag & drop PDFs, DOCX, or images
5. **Analyze**: Click "Analyze Reports" to extract biomarker data
6. **Review Results**: View comprehensive biomarker table with optimal range comparisons
7. **Client Management**: Organize clients, save analyses, track history over time

### Cost Optimization
- Uses Claude Haiku 4.5 (cheapest model)
- Text extraction only (no vision API)
- ~$0.01-0.02 per analysis (8 PDFs)

## Known Considerations
- Maximum PDF file size: ~50MB per file
- Requires internet connection for Claude API calls
- Supabase is optional; app works standalone
- No authentication by default (single practitioner use)
- Text extraction works best with digital PDFs (not scanned images)

## Deployment Notes
- Build command: `npm run build`
- Output directory: `dist`
- Static site deployment (client-side only app)
- No backend server required (direct API calls from browser)

## Privacy & Security
- **Client-Side Processing**: PDFs processed in browser
- **Direct API Calls**: Browser communicates directly with Claude API
- **localStorage**: API key stored locally
- **Optional Cloud**: Supabase for client data (user-controlled)
- **No Authentication**: Designed for internal practitioner use
- **HIPAA Consideration**: For production with real patient data, ensure proper Supabase security controls

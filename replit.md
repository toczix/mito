# Mito - Clinical Pathology Analysis Portal

## Overview
A React-based web application that uses Claude AI to automatically analyze clinical pathology lab reports and compare biomarker values against optimal reference ranges. The app supports multilingual processing, multiple file formats (PDF, DOCX, images), and optional Supabase integration for client management.

**Current State**: Successfully imported and configured to run in Replit environment
**Last Updated**: November 22, 2025

## Recent Changes
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
2. **57 Biomarkers Tracked**: Liver, kidney, CBC, lipids, metabolic, hormones, electrolytes, etc.
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
Optional Supabase configuration (create `.env` file):
```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_AUTH_DISABLED=true
```

**Note**: Claude API key is stored in browser localStorage or Supabase (not in .env)

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

### For Users
1. **API Key Setup**: Enter Claude API key in the Settings tab (starts with `sk-ant-`)
2. **Upload Reports**: Drag & drop PDFs, DOCX, or images
3. **Analyze**: Click "Analyze Reports" to extract biomarker data
4. **Review Results**: View comprehensive biomarker table with optimal range comparisons
5. **Client Management** (Optional): Requires Supabase setup (see SUPABASE_SETUP.md)

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

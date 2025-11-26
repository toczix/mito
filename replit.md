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
The application is primarily client-side, with direct API calls to Claude. A lightweight Express.js backend handles Stripe webhooks. The architecture emphasizes privacy by performing PDF processing in the browser. Replit-specific configurations ensure proper development and deployment within the Replit environment, including Vite setup for port 5000, 0.0.0.0 host, and HMR.

## External Dependencies
- **AI Service**: Anthropic Claude Haiku 4.5
- **Database**: Supabase PostgreSQL (for client management, user authentication, and API key storage), Replit PostgreSQL (for Stripe subscription data).
- **Payment Gateway**: Stripe (integrated via `stripe-replit-sync`).
- **File Processing Libraries**:
    - `pdfjs-dist` (for PDF text extraction)
    - `mammoth` (for DOCX parsing)
    - `tesseract.js` (for OCR on images)
- **UI Libraries**: `@radix-ui/*` (for UI component primitives).
- **Development Tools**: Vite (build tool).
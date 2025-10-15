# Mito - Clinical Pathology Analysis Portal

A modern web application that uses Claude AI to automatically analyze clinical pathology lab reports and compare biomarker values against optimal reference ranges.

## Features

### Core Analysis
- **AI-Powered PDF Analysis** - Upload multiple lab report PDFs and let Claude AI extract biomarker data (text extraction only for low API costs)
- **Comprehensive Biomarker Coverage** - Tracks 57 essential biomarkers across multiple categories
- **Custom Benchmarks** - Edit and manage your own biomarker optimal ranges
- **Optimal Range Comparison** - Compares patient values against evidence-based optimal ranges (male/female)
- **Visual Status Indicators** - Easily identify which biomarkers are in range, out of range, or missing
- **Export Capabilities** - Copy or download results as markdown tables for easy sharing

### Client Management (Supabase)
- **Client Library** - Organize patients into Active and Past clients
- **Analysis History** - Save and track biomarker analyses per client over time
- **Detailed Records** - Store client info (name, email, DOB, gender, notes)
- **Quick Save** - Save analysis results directly to client records with notes

### Data Sync (Optional)
- **API Key Sync** - Store your Claude API key in Supabase (synced across devices)
- **Benchmark Sync** - Sync custom biomarker ranges across all your devices
- **Cloud Backup** - All client data automatically backed up to Supabase

### Privacy & Flexibility
- **Passwordless** - No authentication required (internal practitioner tool)
- **Works Offline** - Supabase is optional; app works without it
- **Client-Side Processing** - PDFs processed in your browser, not on servers

## Tech Stack

- **React 19** with TypeScript
- **Vite** - Lightning-fast build tool
- **Tailwind CSS v3.4** - Utility-first styling
- **shadcn/ui** - Beautiful, accessible UI components
- **Claude 3.5 Haiku** (Anthropic) - Fast, cost-effective AI document analysis
- **Supabase** (Optional) - PostgreSQL database for client records and data sync
- **PDF.js** - Client-side PDF text extraction
- **Inter Font** - Clean, modern typography

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Claude API key ([Get one here](https://console.anthropic.com/settings/keys))
- (Optional) A Supabase account for client management ([Sign up here](https://supabase.com))

### Installation

1. Clone or download this repository

2. Install dependencies:
```bash
npm install
```

3. **(Optional)** Set up Supabase for client management:
   - Follow the guide in [SUPABASE_SETUP.md](SUPABASE_SETUP.md)
   - Create `.env.local` with your Supabase credentials
   - Run the SQL schema in your Supabase dashboard

4. Start the development server:
```bash
npm run dev
```

5. Open [http://localhost:5173](http://localhost:5173) in your browser

### Building for Production

```bash
npm run build
npm run preview
```

## How to Use

### Analysis Tab

**Step 1: Enter API Key**
- Enter your Claude API key (starts with `sk-ant-`)
- The key is stored in localStorage (or Supabase if enabled)
- [Get your API key here](https://console.anthropic.com/settings/keys)

**Step 2: Upload Lab Reports**
- Drag and drop or click to select PDF files
- Upload multiple PDFs at once (max 50MB per file)
- Supported format: PDF laboratory results

**Step 3: Analyze**
- Click "Analyze Reports" to process the documents
- App extracts text from PDFs (fast and cheap!)
- Claude AI identifies and extracts biomarker values
- Processing typically takes 5-15 seconds

**Step 4: Review & Save Results**
- View comprehensive table with all 57 biomarkers
- Compare values against optimal ranges (gender-specific)
- Visual indicators for in-range/out-of-range values
- **Save to Client** - Link results to a client record (if Supabase enabled)
- Export as markdown or copy to clipboard

### Clients Tab (Requires Supabase)

**Manage Client Records**
- **Add Client** - Create new patient record with details
- **Active Clients** - Current patients you're working with
- **Past Clients** - Archived patient records
- **Edit/Archive** - Update client info or change status
- Each client stores: name, email, DOB, gender, notes

**View Analysis History**
- Click on a client to see all past analyses
- Track biomarker changes over time
- Review notes from each analysis session

### Benchmarks Tab

**Customize Optimal Ranges**
- View and edit the 57 default biomarker ranges
- Add custom biomarkers specific to your practice
- Set different ranges for male/female
- Import/Export benchmark sets
- Reset to defaults anytime
- Custom benchmarks sync via Supabase (if enabled)

## Biomarker Categories

The portal analyzes 57 biomarkers across these categories:

- **Liver Function** - ALP, ALT, AST, GGT, Total Bilirubin
- **Kidney Function** - BUN, Creatinine
- **Complete Blood Count** - WBC, RBC, Hemoglobin, Hematocrit, MCV, MCH, MCHC, RDW
- **White Blood Cell Differential** - Neutrophils, Lymphocytes, Eosinophils, Basophils
- **Lipids** - Total Cholesterol, HDL, LDL, Triglycerides
- **Metabolic** - Fasting Glucose, HbA1c, Fasting Insulin, Uric Acid
- **Hormones** - TSH, Free T3, Free T4, Testosterone, FSH, LH, Prolactin, DHEA-S, Cortisol, SHBG
- **Electrolytes** - Sodium, Potassium, Chloride, Bicarbonate
- **Minerals** - Calcium, Magnesium, Phosphate
- **Iron Studies** - Serum Iron, Ferritin, TIBC, Transferrin Saturation
- **Vitamins** - Vitamin D, Vitamin B12
- **Proteins** - Albumin, Globulin, Total Protein
- **Inflammation** - C-Reactive Protein (hsCRP)
- **Other** - Homocysteine, LDH

## Project Structure

```
mito/
├── src/
│   ├── components/
│   │   ├── ui/                     # shadcn/ui components
│   │   ├── ApiKeyInput.tsx         # API key input component
│   │   ├── PdfUploader.tsx         # File upload component  
│   │   ├── AnalysisResults.tsx     # Results table with Save to Client
│   │   ├── ClientLibrary.tsx       # Client management UI
│   │   ├── BenchmarkManager.tsx    # Custom benchmark editor
│   │   └── LoadingState.tsx        # Processing indicator
│   ├── lib/
│   │   ├── biomarkers.ts           # 57 biomarker definitions
│   │   ├── pdf-processor.ts        # PDF text extraction
│   │   ├── claude-service.ts       # Claude Haiku API integration
│   │   ├── analyzer.ts             # Biomarker matching logic
│   │   ├── benchmark-storage.ts    # Custom benchmark management
│   │   ├── supabase.ts             # Supabase client & types
│   │   ├── client-service.ts       # Client CRUD operations
│   │   ├── analysis-service.ts     # Analysis history management
│   │   └── utils.ts                # Utility functions
│   ├── App.tsx                     # Main app with tabs
│   └── index.css                   # Global styles (Inter font)
├── supabase-schema-simple.sql      # Database schema (no auth)
├── SUPABASE_SETUP.md               # Supabase setup guide
├── components.json                 # shadcn/ui configuration
├── tailwind.config.js              # Tailwind v3.4 configuration
└── vite.config.ts                  # Vite configuration
```

## API Usage

This application uses the Claude API (Anthropic) to analyze PDF documents. You need to provide your own API key:

1. Visit [Anthropic Console](https://console.anthropic.com/settings/keys)
2. Create a new API key
3. Enter it in the application when prompted

**Cost Optimization:**  
This app uses **Claude 3.5 Haiku** (fastest, cheapest model) and **text extraction only** (no image processing) to minimize API costs:
- ~$0.01-0.02 per analysis (8 PDFs)
- Check [Anthropic's pricing](https://www.anthropic.com/pricing) for current rates
- Much cheaper than vision-based processing

## Privacy & Security

- **No Backend Servers** - This is a client-side only application
- **Client-Side Processing** - PDFs are processed entirely in your browser
- **Direct API Calls** - Your browser communicates directly with Claude API
- **localStorage** - API key stored locally in your browser
- **Optional Cloud Storage** - Supabase for client data (your own database, fully controlled)
- **Passwordless** - No authentication required (internal practitioner tool)
- **HIPAA Consideration** - For production use with real patient data, ensure Supabase project has appropriate security controls

## Development

### Adding New Biomarkers

Edit `src/lib/biomarkers.ts` and add entries to the `BIOMARKERS` array:

```typescript
{
  name: "Biomarker Name",
  optimalRange: "min-max unit",
  units: ["unit1", "unit2"],
  category: "Category"
}
```

### Adding shadcn/ui Components

```bash
npm run ui:add [component-name]
```

Example:
```bash
npm run ui:add dialog
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run ui:add` - Add shadcn/ui components

## Limitations & Considerations

- Maximum PDF file size: ~50MB per file
- Requires internet connection for Claude API calls
- Analysis accuracy depends on PDF text quality and lab report format
- Text extraction works best with digital PDFs (not scanned images)
- Optimal ranges are general guidelines, consult healthcare professionals
- API costs: ~$0.01-0.02 per analysis (8 PDFs with Haiku model)
- Supabase is optional; app works standalone without it
- No authentication = single practitioner use (can add auth later)

## Disclaimer

This tool is for informational purposes only and should not be used as a substitute for professional medical advice, diagnosis, or treatment. Always consult with qualified healthcare professionals regarding your health concerns.

## License

This project is for educational and informational purposes.

## Support

For issues or questions, please refer to the documentation or create an issue in the repository.

---

Built with ❤️ using React 19, Vite, Tailwind CSS, shadcn/ui, Claude Haiku, Supabase, and PDF.js

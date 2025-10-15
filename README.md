# Mito - Clinical Pathology Analysis Portal

A modern web application that uses Claude AI to automatically analyze clinical pathology lab reports and compare biomarker values against optimal reference ranges.

## Features

- **AI-Powered PDF Analysis** - Upload multiple lab report PDFs and let Claude AI extract biomarker data directly from PDFs
- **Comprehensive Biomarker Coverage** - Tracks 57 essential biomarkers across multiple categories
- **Optimal Range Comparison** - Compares patient values against evidence-based optimal ranges for males
- **Visual Status Indicators** - Easily identify which biomarkers are in range, out of range, or missing
- **Export Capabilities** - Copy or download results as markdown tables for easy sharing
- **Privacy-First Design** - All processing happens in your browser, no data is stored on servers

## Tech Stack

- **React 19** with TypeScript
- **Vite** - Lightning-fast build tool
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Beautiful, accessible UI components
- **Claude API (Anthropic)** - AI-powered PDF document analysis

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Claude API key ([Get one here](https://console.anthropic.com/settings/keys))

### Installation

1. Clone or download this repository

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:5173](http://localhost:5173) in your browser

### Building for Production

```bash
npm run build
npm run preview
```

## How to Use

### Step 1: Enter API Key
- Enter your Claude API key (starts with `sk-ant-`)
- The key is only stored in your browser session and never sent to our servers
- [Get your API key here](https://console.anthropic.com/settings/keys)

### Step 2: Upload Lab Reports
- Drag and drop or click to select PDF files
- Upload multiple PDFs at once (max 32MB per file)
- Supported format: PDF laboratory results (Claude reads PDFs directly, no conversion needed)

### Step 3: Analyze
- Click "Analyze Reports" to process the documents
- AI will extract all biomarker values from the PDFs
- Processing typically takes 10-30 seconds depending on file size

### Step 4: Review Results
- View comprehensive table with all 57 biomarkers
- Compare patient values against optimal ranges
- See visual indicators for in-range vs out-of-range values
- Export results as markdown for reports

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
│   │   ├── ui/                    # shadcn/ui components
│   │   ├── ApiKeyInput.tsx        # API key input component
│   │   ├── PdfUploader.tsx        # File upload component
│   │   ├── AnalysisResults.tsx    # Results table display
│   │   └── LoadingState.tsx       # Processing indicator
│   ├── lib/
│   │   ├── biomarkers.ts          # Biomarker definitions (57 markers)
│   │   ├── pdf-processor.ts       # PDF to base64 conversion
│   │   ├── claude-service.ts      # Claude API integration
│   │   ├── analyzer.ts            # Data matching and analysis
│   │   └── utils.ts               # Utility functions
│   ├── App.tsx                    # Main application
│   └── index.css                  # Global styles
├── components.json                 # shadcn/ui configuration
├── tailwind.config.js             # Tailwind configuration
└── vite.config.ts                 # Vite configuration
```

## API Usage

This application uses the Claude API (Anthropic) to analyze PDF documents. You need to provide your own API key:

1. Visit [Anthropic Console](https://console.anthropic.com/settings/keys)
2. Create a new API key
3. Enter it in the application when prompted

**Note:** Claude API usage incurs costs based on token usage. Check [Anthropic's pricing](https://www.anthropic.com/pricing) for details. The app uses Claude 3.5 Sonnet with PDF vision capabilities.

## Privacy & Security

- **No Data Storage** - We don't store any of your data on our servers
- **Client-Side Processing** - PDFs are processed entirely in your browser
- **Direct API Calls** - Your browser communicates directly with Google's API
- **Session-Only Storage** - API key is only stored in browser memory during your session

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

## Limitations

- Maximum PDF file size: 32MB per file
- Requires stable internet connection for Claude API calls
- Analysis accuracy depends on PDF quality and format
- Optimal ranges are general guidelines, consult healthcare professionals for interpretation
- API costs apply per request (see Anthropic pricing)

## Disclaimer

This tool is for informational purposes only and should not be used as a substitute for professional medical advice, diagnosis, or treatment. Always consult with qualified healthcare professionals regarding your health concerns.

## License

This project is for educational and informational purposes.

## Support

For issues or questions, please refer to the documentation or create an issue in the repository.

---

Built with ❤️ using React, Vite, Tailwind CSS, shadcn/ui, and Claude AI

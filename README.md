# Bank Reconciliation Web Application

A modern web application for managing bank account reconciliation with support for multiple accounts, transaction tracking, and reconciliation status monitoring.

## Features

- 📊 **Dashboard** - Overview with account cards, balance chart, and recent transactions
- 📤 **Upload** - Drag-and-drop PDF import with transaction extraction
- 📋 **Transactions** - Full transaction table with search and filters
- 🏦 **Accounts** - Manage multiple bank accounts
- ✅ **Reconciliation** - Track reconciliation status and discrepancies
- ⚙️ **Settings** - Configure Supabase credentials and backend URL
- 🎮 **Demo Mode** - Works out-of-the-box with sample data

## Tech Stack

- **Frontend**: React 18 + Tailwind CSS
- **Database**: Supabase
- **Backend**: FastAPI (for PDF uploads)
- **Charting**: Chart.js
- **Deployment**: Vercel

## Quick Start

### Development

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

3. Open `http://localhost:3000` in your browser

### Configuration

Configure via Settings page or localStorage:
- **Supabase URL**: Your Supabase project URL
- **Supabase Key**: Your Supabase anonymous key
- **Backend URL**: FastAPI backend endpoint

### Demo Mode

Open the app without credentials to see demo data and features.

## Deployment

### Vercel

The application is ready for Vercel deployment:

```bash
npm install -g vercel
vercel
```

Follow the prompts to deploy.

## Project Structure

```
/
├── index.html          # Main HTML file with React app
├── package.json        # Dependencies and scripts
├── vercel.json         # Vercel configuration
├── vite.config.js      # Vite build configuration
└── README.md           # This file
```

## Environment Variables

Add to Vercel or `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
```

## License

MIT

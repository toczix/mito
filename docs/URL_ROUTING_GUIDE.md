# URL Routing Guide

## Overview

The Mito Analysis app now has proper URL-based routing, allowing you to share direct links to specific pages, clients, and analyses.

## Available Routes

### Main Navigation Routes

| Route | Description | Example URL |
|-------|-------------|-------------|
| `/` | Home/Analysis Page | `https://mito-phi.vercel.app/` |
| `/clients` | Client Library | `https://mito-phi.vercel.app/clients` |
| `/benchmarks` | Benchmark Manager | `https://mito-phi.vercel.app/benchmarks` |
| `/settings` | Settings Page | `https://mito-phi.vercel.app/settings` |

### Future Routes (Coming Soon)

| Route | Description | Example URL |
|-------|-------------|-------------|
| `/clients/:id` | Specific Client Detail | `https://mito-phi.vercel.app/clients/abc123` |
| `/clients/:clientId/analysis/:analysisId` | Specific Analysis | `https://mito-phi.vercel.app/clients/abc123/analysis/xyz789` |

## Benefits

### ✅ Shareable Links
You can now copy and share URLs to specific sections:
- Share the clients page with your team
- Bookmark the benchmarks page for quick access
- Send a direct link to the analysis upload page

### ✅ Browser Navigation
- Back/Forward buttons work properly
- Bookmarks work as expected
- Browser history tracks your navigation

### ✅ Deep Linking (Future)
Once client-specific routes are implemented, you'll be able to:
- Share a link to a specific client's profile
- Link directly to a particular analysis result
- Email clients a link to their latest report

## Technical Details

### Implementation
- Built with React Router DOM v6
- Uses `<NavLink>` for active state highlighting
- Configured with Vercel rewrites for SPA routing

### Configuration
The `vercel.json` file ensures all routes are properly handled:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

This configuration tells Vercel to serve `index.html` for all routes, allowing React Router to handle client-side routing.

## Migration from Tabs

### Before (Tabs)
Navigation was done through tabs:
- All views had the same URL
- Couldn't bookmark or share specific sections
- Browser navigation didn't work

### After (Routes)
Navigation now uses URL paths:
- Each section has its own URL
- Direct linking supported
- Browser back/forward works
- Bookmarking works properly

## Next Steps

To fully support deep linking for clients and analyses, we'll need to:
1. Update `ClientLibrary` component to use routing
2. Create individual client detail pages
3. Add analysis-specific routes
4. Implement shareable analysis report links

These enhancements will allow you to:
- Share client profiles: `/clients/jerry-smith`
- Share specific analyses: `/clients/jerry-smith/analysis/2024-10-16`
- Generate shareable report links for clients to view their results


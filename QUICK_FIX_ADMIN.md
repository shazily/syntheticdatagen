# Quick Fix: Admin Dashboard Data Loading

## Problem
Admin dashboard showing "Error loading feedback data" because n8n Postgres queries return rows one-by-one, not as an array.

## Solution
Re-import the updated `admin-api.json` workflow.

## Steps:

1. **In n8n, DELETE the existing "Admin API - Analytics Dashboard" workflow**
2. **Import** the updated `synthetic-data-generator/n8n-workflows/admin-api.json`
3. **Configure Postgres credentials** for these nodes:
   - Query Feedback
   - Query Chat Logs  
   - Query Metrics
   - (All use "Postgres - Feedback DB")
4. **Activate** the workflow

## What Changed:
- Added "Aggregate Feedback" node after "Query Feedback"
- Added "Aggregate Chat Logs" node after "Query Chat Logs"
- Response now returns `$json.data` (the aggregated array) instead of `$json` (single row)

## Test After Re-import:

### Method 1: Browser Test
```
http://localhost:3006/admin
```
- Should see feedback table populated
- Metrics should show real counts
- Chat logs tab should work

### Method 2: Direct API Test
```javascript
// In browser console or new tab:
fetch('http://localhost:5678/webhook/admin/feedback')
  .then(r => r.json())
  .then(data => console.log('Feedback:', data));

// Should return an ARRAY like:
[
  {id: 1, rating: 5, comment: "Great!", ...},
  {id: 2, rating: 4, comment: "Good", ...},
  ...
]
```

## Current Status:

✅ Database tables created (chat_logs, ai_ratings)
✅ Rating collector workflow imported
⚠️ Need to re-import admin-api workflow (with Aggregate nodes)
⚠️ Need to import intelligent-generator V3 workflow

Once you re-import `admin-api.json`, the dashboard will work perfectly!


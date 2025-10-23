# Import Admin Analytics Workflows to n8n

## Step 1: Import Intelligent Generator V3 (Chat Logging)

**IMPORTANT:** Do NOT delete the existing production workflow. This is a NEW workflow for development.

1. **Import** `n8n-workflows/intelligent-generator.json` as NEW workflow
2. **Name:** "Synthetic Data - Intelligent Generator V3 (Dev)"
3. **Webhook Path:** `/webhook/generate-intelligent-v3` (different from production)
4. **Configure** Postgres credentials:
   - Click on "Save Chat Log" node
   - Select credentials: "Postgres - Feedback DB" (same as feedback workflow)
5. **Activate** the workflow

**Production workflow stays unchanged:**
- Production (port 3005) uses: `/webhook/generate-intelligent` (NO logging)
- Development (port 3006) uses: `/webhook/generate-intelligent-v3` (WITH logging)

## Step 2: Import Rating Collector

1. **Import** `n8n-workflows/rating-collector.json`
2. **Configure** Postgres credentials:
   - Click on "Save Rating" node
   - Select credentials: "Postgres - Feedback DB"
3. **Activate** the workflow
4. **Webhook URL**: `http://localhost:5678/webhook/save-rating`

## Step 3: Import Admin API

1. **Import** `n8n-workflows/admin-api.json`
2. **Configure** Postgres credentials for ALL THREE query nodes:
   - "Query Feedback" node
   - "Query Chat Logs" node
   - "Query Metrics" node
   - All use: "Postgres - Feedback DB"
3. **Activate** the workflow
4. **Webhook URLs**:
   - `http://localhost:5678/webhook/admin/feedback`
   - `http://localhost:5678/webhook/admin/chatlogs`
   - `http://localhost:5678/webhook/admin/metrics`

## Step 4: Test the System

### Test Chat Logging:
1. Go to `http://localhost:3006`
2. Switch to "A.I Mode"
3. Generate some data (e.g., "customer records")
4. Check n8n execution log - should see "Save Chat Log" node executed
5. Verify in Postgres:
   ```sql
   SELECT * FROM chat_logs ORDER BY timestamp DESC LIMIT 5;
   ```

### Test Rating System:
1. After generating data, rating widget should appear (bottom-right)
2. Click thumbs up or thumbs down
3. Check n8n execution log for rating-collector workflow
4. Verify in Postgres:
   ```sql
   SELECT * FROM ai_ratings ORDER BY timestamp DESC LIMIT 5;
   ```

### Test Admin Dashboard:
1. Navigate to `http://localhost:3006/admin`
2. Should see metrics cards populated
3. Click "User Feedback" tab → see feedback data
4. Click "Chat Logs" tab → see AI interactions with ratings
5. Click "AI Insights" tab → see charts and statistics
6. Click "Export CSV" to download data

## 🐛 Troubleshooting

### Rating widget not appearing:
- **Issue:** Browser caching the old app.js
- **Fix:** Hard refresh (Ctrl+Shift+R) or clear browser cache
- **OR:** Test on production (port 3005) after syncing files

### Admin dashboard shows "Error loading data":
- **Issue:** n8n workflows not imported/activated
- **Fix:** Import and activate all three workflows
- **Check:** Verify Postgres credentials are configured

### Chat logs not saving:
- **Issue:** Postgres credentials not set on "Save Chat Log" node
- **Fix:** Click node, select "Postgres - Feedback DB" credential
- **Verify:** Check n8n execution logs for errors

## 📁 File Locations

- **Frontend V3:** `synthetic-data-generator/frontend-v3/`
  - `index.html` (main app)
  - `admin.html` (admin dashboard)
  - `app.js` (includes rating widget)
  - `admin.js` (dashboard logic)
  - `admin.css` (dashboard styles)

- **n8n Workflows:** `synthetic-data-generator/n8n-workflows/`
  - `intelligent-generator.json` (updated with logging)
  - `rating-collector.json` (new)
  - `admin-api.json` (new)

- **Database:** `synthetic-data-generator/database/`
  - `schema.sql` (chat_logs and ai_ratings tables)

## 🎯 Success Indicators

When everything is working:
- ✅ Every A.I. Mode interaction appears in `chat_logs` table
- ✅ Rating widget appears after data generation
- ✅ Ratings saved to `ai_ratings` table
- ✅ Admin dashboard shows real-time data
- ✅ CSV exports work for all tables
- ✅ Charts display rating and success statistics


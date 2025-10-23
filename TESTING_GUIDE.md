# Testing Guide - Synthetic Data Generator

This guide provides step-by-step instructions for testing all features of the Synthetic Data Generator.

## Pre-Testing Checklist

Before running tests, ensure:

- [ ] Docker is running
- [ ] n8n is running on port 5678
- [ ] Ollama is running with llama3.2:latest model
- [ ] Application container is running (`docker ps`)
- [ ] Both n8n workflows are imported and **activated**

## Quick Verification

### 1. Check All Services

```bash
# Check Docker container
docker ps | grep synthetic-data-web

# Check n8n (should return HTML)
curl http://localhost:5678

# Check Ollama (should return model list)
curl http://localhost:11434/api/tags

# Check web application (should return HTML)
curl http://localhost
```

## Test Suite 1: Frontend UI

### Test 1.1: Application Loads

**Steps:**
1. Open browser
2. Navigate to `http://localhost`
3. Verify page loads without errors

**Expected Result:**
- ✅ Page displays header "Synthetic Data Generator"
- ✅ Two tabs visible: "Schema Builder" and "AI Chat"
- ✅ No console errors in DevTools

---

### Test 1.2: Schema Builder Tab

**Steps:**
1. Ensure "Schema Builder" tab is active
2. Verify left panel shows field types
3. Verify right panel shows empty schema area

**Expected Result:**
- ✅ Left panel shows categories: Personal Data, Business Data, Financial Data, Technical Data, Date & Time, Numbers
- ✅ Right panel shows "Drag and drop fields here" message
- ✅ Config section shows record count (default 100) and export format (default CSV)

---

### Test 1.3: Drag and Drop Functionality

**Steps:**
1. Drag "First Name" field from left panel
2. Drop it in the schema area
3. Drag "Email" field
4. Drop it in the schema area

**Expected Result:**
- ✅ Field appears in schema with icon
- ✅ Field has editable name input (default: "first_name", "email")
- ✅ Field shows type badge
- ✅ Field has "Remove" button
- ✅ No errors in console

---

### Test 1.4: Field Name Editing

**Steps:**
1. Click on the field name input
2. Change "first_name" to "customer_name"
3. Tab to next field

**Expected Result:**
- ✅ Name updates immediately
- ✅ No validation errors

---

### Test 1.5: Remove Field

**Steps:**
1. Click "Remove" button on one field

**Expected Result:**
- ✅ Field disappears from schema
- ✅ Other fields remain intact

---

### Test 1.6: Clear All

**Steps:**
1. Add 3-4 fields to schema
2. Click "Clear All" button
3. Confirm in dialog

**Expected Result:**
- ✅ All fields removed
- ✅ Empty state appears again

---

### Test 1.7: AI Chat Tab

**Steps:**
1. Click "AI Chat" tab
2. Verify layout

**Expected Result:**
- ✅ Left side shows chat interface with welcome message
- ✅ Right side shows "Generated Data Preview" panel
- ✅ Text area for input at bottom
- ✅ "Generate" button visible

---

### Test 1.8: Tab Switching

**Steps:**
1. Click "Schema Builder" tab
2. Add 2 fields
3. Click "AI Chat" tab
4. Click back to "Schema Builder"

**Expected Result:**
- ✅ Tabs switch smoothly
- ✅ Schema persists when switching back
- ✅ No layout issues

## Test Suite 2: Simple Generator (Schema Builder)

### Test 2.1: Basic Generation

**Steps:**
1. Go to Schema Builder tab
2. Clear any existing fields
3. Drag "First Name" to schema
4. Drag "Last Name" to schema
5. Drag "Email" to schema
6. Set record count to `10`
7. Set format to `CSV`
8. Click "Generate Data"

**Expected Result:**
- ✅ Loading overlay appears
- ✅ n8n processes request (check n8n executions)
- ✅ File downloads automatically
- ✅ File name format: `synthetic_data_YYYY-MM-DD*.csv`
- ✅ CSV contains 10 rows + header
- ✅ Data looks realistic (names, emails)
- ✅ Success message appears

---

### Test 2.2: Excel Export

**Steps:**
1. Use same schema as Test 2.1
2. Change format to `Excel (XLSX)`
3. Click "Generate Data"

**Expected Result:**
- ✅ File downloads as `.xlsx`
- ✅ Can open in Excel/Sheets
- ✅ Contains correct data
- ✅ 10 rows of data

---

### Test 2.3: Large Dataset

**Steps:**
1. Create schema with 5 fields
2. Set record count to `5000`
3. Click "Generate Data"

**Expected Result:**
- ✅ Generation completes (may take 2-5 seconds)
- ✅ File downloads successfully
- ✅ File contains 5000 rows
- ✅ No browser crashes

---

### Test 2.4: Validation - Empty Schema

**Steps:**
1. Clear all fields (empty schema)
2. Click "Generate Data"

**Expected Result:**
- ✅ Alert appears: "Please add at least one field to your schema"
- ✅ No request sent to n8n

---

### Test 2.5: Validation - Invalid Record Count

**Steps:**
1. Add any field
2. Set record count to `0`
3. Click "Generate Data"

**Expected Result:**
- ✅ Alert appears about invalid count
- ✅ No request sent

**Steps 2:**
1. Set record count to `15000`
2. Click "Generate Data"

**Expected Result:**
- ✅ Alert appears about invalid count

---

### Test 2.6: All Field Types

**Steps:**
1. Create schema with one of each field type (30+ fields)
2. Set record count to `5`
3. Generate CSV

**Expected Result:**
- ✅ All fields generate data
- ✅ Data matches field type:
  - firstName: Real names
  - email: Valid email format
  - phone: Formatted phone numbers
  - uuid: Valid UUID v4 format
  - ipAddress: Valid IP addresses
  - creditCard: Formatted credit card numbers
  - date: Date format YYYY-MM-DD
  - integer: Numbers
  - etc.

## Test Suite 3: Intelligent Generator (AI Chat)

### Test 3.1: Simple Request

**Steps:**
1. Go to AI Chat tab
2. Type: `Generate 20 customer records with names and emails`
3. Click "Generate" (or press Enter)

**Expected Result:**
- ✅ Loading overlay appears
- ✅ User message appears in chat
- ✅ AI response appears after processing (5-10 seconds)
- ✅ AI message confirms what it's generating
- ✅ Data preview table appears on right
- ✅ Shows 10 rows (first 10 of 20)
- ✅ Download buttons appear
- ✅ n8n execution succeeds (check n8n)

---

### Test 3.2: Download from Chat

**Steps:**
1. After Test 3.1 succeeds
2. Click "📄 Download CSV"
3. Open downloaded file

**Expected Result:**
- ✅ CSV downloads
- ✅ Contains 20 rows
- ✅ Has customer data with names and emails

**Steps 2:**
1. Click "📊 Download Excel"
2. Open file

**Expected Result:**
- ✅ XLSX downloads
- ✅ Opens correctly
- ✅ Same data as CSV

---

### Test 3.3: Complex Request

**Steps:**
1. Clear chat or continue conversation
2. Type: `I need employee data for 100 people with first name, last name, email, job title, department, and hire date`
3. Click "Generate"

**Expected Result:**
- ✅ AI interprets request correctly
- ✅ Generates schema with 6-7 fields
- ✅ Data includes all requested fields
- ✅ 100 records generated

---

### Test 3.4: Contextual Conversation

**Steps:**
1. Type: `Generate 50 customer records`
2. Wait for response
3. Type: `Now add phone numbers to each record`
4. Click "Generate"

**Expected Result:**
- ✅ AI remembers context
- ✅ Response acknowledges previous request
- ✅ New data includes phone numbers
- ✅ Chat memory working

---

### Test 3.5: Ambiguous Request

**Steps:**
1. Type: `Generate some data`
2. Click "Generate"

**Expected Result:**
- ✅ AI asks for clarification, OR
- ✅ AI generates basic schema with explanation

---

### Test 3.6: Invalid Request Handling

**Steps:**
1. Type: `Hello, how are you?`
2. Click "Generate"

**Expected Result:**
- ✅ AI responds politely
- ✅ Explains it's for data generation
- ✅ No crash or error

## Test Suite 4: n8n Workflow Tests

### Test 4.1: Test Simple Generator Directly

**Command:**
```bash
curl -X POST http://localhost:5678/webhook/generate-simple \
  -H "Content-Type: application/json" \
  -d '{
    "schema": [
      {"name": "first_name", "type": "firstName"},
      {"name": "last_name", "type": "lastName"},
      {"name": "email", "type": "email"}
    ],
    "recordCount": 5,
    "exportFormat": "csv"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "first_name": "John",
      "last_name": "Smith",
      "email": "john.smith@example.com"
    },
    ...
  ],
  "recordCount": 5
}
```

**Verify:**
- ✅ HTTP 200 status
- ✅ JSON response
- ✅ `success: true`
- ✅ `data` array has 5 items
- ✅ Each item has all 3 fields

---

### Test 4.2: Test Intelligent Generator Directly

**Command:**
```bash
curl -X POST http://localhost:5678/webhook/generate-intelligent \
  -H "Content-Type: application/json" \
  -d '{
    "chatInput": "Generate 10 customer records with names and emails",
    "sessionId": "test_session_123"
  }'
```

**Expected Response:**
```json
{
  "response": {
    "message": "I'll generate 10 customer records...",
    "data": [...],
    "recordCount": 10
  }
}
```

**Verify:**
- ✅ HTTP 200 status
- ✅ JSON response
- ✅ `response.message` exists
- ✅ `response.data` is array with items
- ✅ `response.recordCount` matches data length

---

### Test 4.3: Check n8n Executions

**Steps:**
1. Open n8n: http://localhost:5678
2. Click "Executions" menu
3. View recent executions

**Expected Result:**
- ✅ Recent test executions appear
- ✅ All show "Success" status
- ✅ Can click to view details
- ✅ Each node shows green checkmark
- ✅ Data flows through correctly

---

### Test 4.4: Test Workflow Error Handling

**Command:**
```bash
curl -X POST http://localhost:5678/webhook/generate-simple \
  -H "Content-Type: application/json" \
  -d '{
    "schema": [],
    "recordCount": 100
  }'
```

**Expected Response:**
```json
{
  "success": false,
  "error": "Schema is required and must contain at least one field"
}
```

**Verify:**
- ✅ Returns error response (not crashes)
- ✅ Error message is clear

## Test Suite 5: Integration Tests

### Test 5.1: End-to-End (Schema Builder)

**Full workflow test:**

1. ✅ Open http://localhost
2. ✅ Go to Schema Builder
3. ✅ Add 5 different field types
4. ✅ Set 100 records
5. ✅ Generate CSV
6. ✅ File downloads
7. ✅ Open file - has 100 rows
8. ✅ Change to Excel format
9. ✅ Generate again
10. ✅ Excel file downloads
11. ✅ Open Excel file - correct data

---

### Test 5.2: End-to-End (AI Chat)

**Full workflow test:**

1. ✅ Open http://localhost
2. ✅ Go to AI Chat
3. ✅ Type request for data
4. ✅ AI responds
5. ✅ Data preview shows
6. ✅ Download CSV works
7. ✅ Download Excel works
8. ✅ Have conversation (2-3 messages)
9. ✅ Context maintained

---

### Test 5.3: Stress Test

**Steps:**
1. Generate 10,000 records via Schema Builder
2. Generate 10,000 records via AI Chat
3. Generate multiple times in quick succession

**Expected Result:**
- ✅ All complete successfully
- ✅ No memory leaks
- ✅ Browser remains responsive
- ✅ Files download correctly

## Test Suite 6: Browser Compatibility

Test in multiple browsers:

### Chrome/Edge
- [ ] All features work
- [ ] Downloads work
- [ ] No console errors

### Firefox
- [ ] All features work
- [ ] Downloads work
- [ ] No console errors

### Safari
- [ ] All features work
- [ ] Downloads work
- [ ] No console errors

## Test Suite 7: Error Scenarios

### Test 7.1: n8n Not Running

**Steps:**
1. Stop n8n
2. Try to generate data

**Expected Result:**
- ✅ Error message appears
- ✅ Mentions n8n connection issue
- ✅ No crash

---

### Test 7.2: Ollama Not Running

**Steps:**
1. Stop Ollama
2. Try AI Chat generation

**Expected Result:**
- ✅ Error message appears
- ✅ Mentions Ollama/AI issue
- ✅ Simple generator still works

---

### Test 7.3: Invalid Webhook URL

**Steps:**
1. Edit `frontend/app.js`
2. Change webhook URL to invalid
3. Try generation

**Expected Result:**
- ✅ Error message appears
- ✅ Clear error description

## Test Results Template

```markdown
## Test Results - [Date]

**Tester:** [Name]
**Environment:** 
- OS: [Windows/Mac/Linux]
- Browser: [Chrome/Firefox/Safari]
- Docker Version: [version]
- n8n Version: [version]

### Summary
- Total Tests: X
- Passed: ✅ X
- Failed: ❌ X
- Skipped: ⏭️ X

### Failed Tests
1. Test X.X - [Name]
   - Issue: [Description]
   - Steps to Reproduce: [Steps]
   - Screenshot: [Link]

### Notes
[Any additional observations]
```

## Automated Test Script

Save as `test.sh`:

```bash
#!/bin/bash

echo "🧪 Synthetic Data Generator - Automated Tests"
echo "=============================================="

# Test 1: Web server responds
echo -n "Test 1: Web server... "
if curl -s http://localhost > /dev/null; then
  echo "✅ PASS"
else
  echo "❌ FAIL"
fi

# Test 2: n8n responds
echo -n "Test 2: n8n server... "
if curl -s http://localhost:5678 > /dev/null; then
  echo "✅ PASS"
else
  echo "❌ FAIL"
fi

# Test 3: Ollama responds
echo -n "Test 3: Ollama server... "
if curl -s http://localhost:11434/api/tags > /dev/null; then
  echo "✅ PASS"
else
  echo "❌ FAIL"
fi

# Test 4: Simple generator webhook
echo -n "Test 4: Simple generator... "
RESPONSE=$(curl -s -X POST http://localhost:5678/webhook/generate-simple \
  -H "Content-Type: application/json" \
  -d '{"schema":[{"name":"test","type":"firstName"}],"recordCount":5,"exportFormat":"csv"}')

if echo "$RESPONSE" | grep -q '"success":true'; then
  echo "✅ PASS"
else
  echo "❌ FAIL"
  echo "Response: $RESPONSE"
fi

# Test 5: Intelligent generator webhook
echo -n "Test 5: Intelligent generator... "
RESPONSE=$(curl -s -X POST http://localhost:5678/webhook/generate-intelligent \
  -H "Content-Type: application/json" \
  -d '{"chatInput":"Generate 5 records","sessionId":"test"}')

if echo "$RESPONSE" | grep -q '"response"'; then
  echo "✅ PASS"
else
  echo "❌ FAIL"
  echo "Response: $RESPONSE"
fi

echo ""
echo "✅ Tests complete!"
```

**Run with:**
```bash
chmod +x test.sh
./test.sh
```

---

**Last Updated:** January 2025


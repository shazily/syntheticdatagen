// Modal Functions for Phase 2

// Global variable to track current tab
let currentPreviewTab = 'table';

async function generatePreview() {
    const schema = schemaBuilder.getSchema();
    if (schema.length === 0) {
        showToast('error', 'No Schema', 'Please add fields to your schema first.');
        return;
    }

    // Initialize global schema state for SQL generation
    window.currentSchemaState = schema.map(field => ({
        name: field.name,
        type: field.type,
        customType: field.customType || null,
        blankPercent: field.blankPercent || 0
    }));
    console.log('✅ Schema state initialized for SQL generation:', window.currentSchemaState);

    showLoading('Generating preview...');

    try {
        const response = await fetch(`${CONFIG.n8nBaseUrl}/${CONFIG.simpleGeneratorWebhook}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                schema: schema,
                recordCount: 5, // Fixed to 5 rows for preview
                exportFormat: 'json'
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        console.log('Preview generation result:', result);
        
        if (result.success && result.data) {
            console.log('Data received:', result.data);
            console.log('Data type:', typeof result.data);
            console.log('Data length:', result.data.length);
            console.log('First record:', result.data[0]);
            
            displayPreviewData(result.data);
            
            // Restore the previously selected tab after data generation
            setTimeout(() => {
                switchModalPreviewTab(currentPreviewTab);
            }, 100);
            
            // Don't show toast immediately to prevent modal closing
            // showToast('success', 'Preview Generated', '5 sample records generated successfully!');
        } else {
            throw new Error(result.error || 'Unknown error occurred');
        }
    } catch (error) {
        console.error('Error generating preview:', error);
        showToast('error', 'Preview Failed', `Error: ${error.message}`);
    } finally {
        hideLoading();
    }
}

function displayPreviewData(data) {
    console.log('displayPreviewData called with:', data);
    
    const content = document.getElementById('modal-preview-content');
    console.log('Found modal-preview-content element:', content);
    console.log('modal-preview-content parent:', content?.parentElement);
    console.log('modal-preview-content classList:', content?.classList);
    console.log('modal-preview-content inline styles:', content?.style.cssText);
    
    if (!content) {
        console.error('Modal preview content element not found');
        return;
    }

    // Generate table view
    const tableHTML = generateTableView(data);
    const rawHTML = generateRawView(data);
    
    // Generate SQL view
    console.log('About to generate SQL view...');
    let sqlHTML = '';
    try {
        sqlHTML = generateSQLView(data);
        console.log('SQL view generated successfully');
    } catch (error) {
        console.error('Error generating SQL view:', error);
        sqlHTML = `
            <div class="sql-content">
                <div class="sql-error">
                    <p>Error generating SQL: ${error.message}</p>
                </div>
            </div>
        `;
    }
    
    console.log('Generated table HTML:', tableHTML);
    console.log('Generated raw HTML:', rawHTML);
    console.log('Generated SQL HTML:', sqlHTML);
    
    content.innerHTML = `
        <div id="table-view" class="preview-view active">
            ${tableHTML}
        </div>
        <div id="raw-view" class="preview-view">
            ${rawHTML}
        </div>
        <div id="sql-view" class="preview-view">
            ${sqlHTML}
        </div>
    `;
    
    // Ensure the initial state is always TABLE and button states are correct
    currentPreviewTab = 'table';
    
    // Synchronize button states to match the content
    setTimeout(() => {
        switchModalPreviewTab('table');
    }, 50);
    
    // Verify the content was actually set
    setTimeout(() => {
        const tableView = document.getElementById('table-view');
        const rawView = document.getElementById('raw-view');
        console.log('After setting innerHTML - table-view exists:', !!tableView);
        console.log('After setting innerHTML - raw-view exists:', !!rawView);
        console.log('After setting innerHTML - content.innerHTML length:', content.innerHTML.length);
        
        // Check if table is actually visible
        const table = tableView?.querySelector('.preview-table');
        console.log('Table element found:', !!table);
        console.log('Table visible:', table ? window.getComputedStyle(table).display : 'N/A');
        
        // Check dimensions and positioning
        console.log('=== DIMENSION CHECK AFTER DATA LOAD ===');
        console.log('content element:', content);
        console.log('content ID:', content.id);
        console.log('content parent:', content.parentElement);
        console.log('content parent classList:', content.parentElement?.classList);
        
        const contentRect = content.getBoundingClientRect();
        const tableViewRect = tableView?.getBoundingClientRect();
        const tableRect = table?.getBoundingClientRect();
        
        console.log('Content dimensions:', {
            width: contentRect.width,
            height: contentRect.height,
            top: contentRect.top,
            left: contentRect.left
        });
        console.log('TableView dimensions:', tableViewRect ? {
            width: tableViewRect.width,
            height: tableViewRect.height,
            top: tableViewRect.top,
            left: tableViewRect.left
        } : 'N/A');
        console.log('Table dimensions:', tableRect ? {
            width: tableRect.width,
            height: tableRect.height,
            top: tableRect.top,
            left: tableRect.left
        } : 'N/A');
        
        // Check computed styles
        if (tableView) {
            const computedStyle = window.getComputedStyle(tableView);
            console.log('TableView computed styles:', {
                display: computedStyle.display,
                visibility: computedStyle.visibility,
                opacity: computedStyle.opacity,
                width: computedStyle.width,
                height: computedStyle.height,
                position: computedStyle.position,
                zIndex: computedStyle.zIndex
            });
        }
        
        if (table) {
            const tableStyle = window.getComputedStyle(table);
            console.log('Table computed styles:', {
                display: tableStyle.display,
                width: tableStyle.width,
                height: tableStyle.height,
                color: tableStyle.color,
                backgroundColor: tableStyle.backgroundColor
            });
        }
    }, 100);
    
    console.log('Preview data displayed:', data.length, 'records');
    console.log('Content innerHTML set to:', content.innerHTML);
}

function generateTableView(data) {
    console.log('generateTableView called with data:', data);
    
    if (!data || data.length === 0) {
        console.log('No data available for table');
        return '<p>No data available</p>';
    }

    const headers = Object.keys(data[0]);
    console.log('Table headers:', headers);
    
    const headerRow = headers.map(h => `<th>${h}</th>`).join('');
    const dataRows = data.map(row => 
        `<tr>${headers.map(h => `<td>${row[h] || ''}</td>`).join('')}</tr>`
    ).join('');

    const tableHTML = `
        <div class="preview-table-container">
            <table class="preview-table">
                <thead>
                    <tr>${headerRow}</tr>
                </thead>
                <tbody>
                    ${dataRows}
                </tbody>
            </table>
        </div>
    `;
    
    console.log('Generated table HTML:', tableHTML);
    return tableHTML;
}

function generateRawView(data) {
    if (!data || data.length === 0) {
        return '<pre class="preview-raw">No data available</pre>';
    }

    // Convert to CSV format
    const headers = Object.keys(data[0]);
    const csvHeader = headers.join(',');
    const csvRows = data.map(row => {
        return headers.map(header => {
            const value = row[header];
            // Escape quotes and wrap in quotes if contains comma or quote
            if (value === null || value === undefined) return '';
            const stringValue = String(value);
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
        }).join(',');
    }).join('\n');
    
    const csvContent = `${csvHeader}\n${csvRows}`;
    
    return `
        <pre class="preview-raw">${csvContent}</pre>
    `;
}

function generateSQLView(data) {
    console.log('=== SQL VIEW DEBUG ===');
    console.log('Data received:', data);
    console.log('Current schema state:', window.currentSchemaState);
    console.log('SQL generator available:', !!window.sqlGenerator);
    
    // Get the current schema from the global state
    const schema = window.currentSchemaState || [];
    
    if (!schema || schema.length === 0) {
        console.log('No schema available');
        return `
            <div class="sql-content">
                <div class="sql-error">
                    <p>No schema available. Please generate data first.</p>
                </div>
            </div>
        `;
    }
    
    if (!window.sqlGenerator) {
        console.log('SQL generator not available');
        return `
            <div class="sql-content">
                <div class="sql-error">
                    <p>SQL generator not loaded. Please refresh the page.</p>
                </div>
            </div>
        `;
    }
    
    // Generate SQL using our SQL generator
    const sqlContent = window.sqlGenerator.generateSQL(schema, data);
    console.log('Generated SQL content:', sqlContent);
    
    return `
        <div class="sql-content">
            <div class="sql-header">
                <h4>SQL Statements</h4>
                <button class="copy-sql-btn" onclick="copySQLToClipboard()">
                    📋 Copy SQL
                </button>
            </div>
            <div class="sql-code">
                <pre><code id="sql-code-content">${sqlContent}</code></pre>
            </div>
        </div>
    `;
}

function copySQLToClipboard() {
    const sqlContent = document.getElementById('sql-code-content');
    if (sqlContent) {
        navigator.clipboard.writeText(sqlContent.textContent).then(() => {
            showToast('success', 'SQL Copied', 'SQL statements copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy SQL: ', err);
            showToast('error', 'Copy Failed', 'Failed to copy SQL to clipboard');
        });
    }
}

// Router function - determines which preview tab handler to use
function switchPreviewTab(tab) {
    // Check if this is for the AI mode preview tabs (main page)
    const aiPreviewTabs = document.getElementById('preview-tabs-container');
    if (aiPreviewTabs && aiPreviewTabs.style.display !== 'none') {
        // Call the AI mode handler from app.js
        if (typeof window.switchAIPreviewTab === 'function') {
            window.switchAIPreviewTab(tab);
        }
        return;
    }
    
    // Otherwise, handle modal preview tabs
    switchModalPreviewTab(tab);
}

function switchModalPreviewTab(tab) {
    // Update the global current tab variable
    currentPreviewTab = tab;
    
    console.log('=== MODAL TAB SWITCH DEBUG ===');
    console.log('Switching to tab:', tab);
    console.log('Current tab stored as:', currentPreviewTab);
    
    // Look for elements within the modal specifically
    const modal = document.querySelector('.modal');
    console.log('Modal found:', !!modal);
    
    if (!modal) {
        console.error('Modal not found!');
        return;
    }
    
    const tableView = modal.querySelector('#table-view');
    const rawView = modal.querySelector('#raw-view');
    const sqlView = modal.querySelector('#sql-view');
    const tabButtons = modal.querySelectorAll('.preview-tabs button');
    
    console.log('table-view element:', tableView);
    console.log('raw-view element:', rawView);
    console.log('sql-view element:', sqlView);
    console.log('Tab buttons found:', tabButtons.length);
    
    // Also try finding by ID in case modal scope is wrong
    const tableViewById = document.getElementById('table-view');
    const rawViewById = document.getElementById('raw-view');
    const sqlViewById = document.getElementById('sql-view');
    console.log('table-view by ID:', tableViewById);
    console.log('raw-view by ID:', rawViewById);
    console.log('sql-view by ID:', sqlViewById);

    if (!tableView && !tableViewById) {
        console.error('Table view element not found in modal or by ID!');
        return;
    }
    
    if (!rawView && !rawViewById) {
        console.error('Raw view element not found in modal or by ID!');
        return;
    }
    
    if (!sqlView && !sqlViewById) {
        console.error('SQL view element not found in modal or by ID!');
        return;
    }
    
    // Use whichever element we found
    const actualTableView = tableView || tableViewById;
    const actualRawView = rawView || rawViewById;
    const actualSqlView = sqlView || sqlViewById;

    tabButtons.forEach(btn => btn.classList.remove('active'));
    
    if (tab === 'table') {
        actualTableView.style.setProperty('display', 'flex', 'important');
        actualTableView.style.visibility = 'visible';
        actualRawView.style.setProperty('display', 'none', 'important');
        actualSqlView.style.setProperty('display', 'none', 'important');
        if (tabButtons[0]) tabButtons[0].classList.add('active');
        console.log('Switched to TABLE view');
    } else if (tab === 'raw') {
        actualTableView.style.setProperty('display', 'none', 'important');
        actualRawView.style.setProperty('display', 'flex', 'important');
        actualRawView.style.visibility = 'visible';
        actualSqlView.style.setProperty('display', 'none', 'important');
        if (tabButtons[1]) tabButtons[1].classList.add('active');
        console.log('Switched to RAW view');
    } else if (tab === 'sql') {
        console.log('Switching to SQL tab...');
        console.log('SQL view element found:', !!actualSqlView);
        actualTableView.style.setProperty('display', 'none', 'important');
        actualRawView.style.setProperty('display', 'none', 'important');
        actualSqlView.style.setProperty('display', 'flex', 'important');
        actualSqlView.style.visibility = 'visible';
        if (tabButtons[2]) tabButtons[2].classList.add('active');
        console.log('Switched to SQL view');
        
        // Check if SQL content exists
        const sqlContent = actualSqlView.querySelector('.sql-content');
        console.log('SQL content element found:', !!sqlContent);
        if (sqlContent) {
            console.log('SQL content HTML:', sqlContent.innerHTML.substring(0, 200) + '...');
        }
    }
    
    // Verify the switch worked
    setTimeout(() => {
        const tableRect = actualTableView.getBoundingClientRect();
        const rawRect = actualRawView.getBoundingClientRect();
        console.log('After switch - Table dimensions:', tableRect);
        console.log('After switch - Raw dimensions:', rawRect);
        console.log('Table computed style:', window.getComputedStyle(actualTableView).display);
        console.log('Raw computed style:', window.getComputedStyle(actualRawView).display);
    }, 50);
}

function deriveSchema() {
    const textarea = document.getElementById('example-data');
    const data = textarea.value.trim();
    
    if (!data) {
        showToast('error', 'Empty Data', 'Please paste some example data first.');
        return;
    }

    try {
        showLoading('Parsing data...');
        
        // Try to parse as CSV first
        let parsedData;
        if (data.includes(',') || data.includes('\t')) {
            // CSV or TSV - headers only
            const lines = data.split('\n').filter(line => line.trim());
            if (lines.length < 1) {
                throw new Error('CSV must have at least a header row');
            }
            
            const headers = lines[0].split(/[,\t]/).map(h => h.trim()).filter(h => h);
            parsedData = headers.map(header => ({ name: header, type: 'string' }));
        } else if (data.startsWith('{') || data.startsWith('[')) {
            // JSON
            const jsonData = JSON.parse(data);
            const sample = Array.isArray(jsonData) ? jsonData[0] : jsonData;
            parsedData = Object.keys(sample).map(key => ({ name: key, type: 'string' }));
        } else {
            throw new Error('Unsupported format. Please use CSV headers, TSV headers, or JSON.');
        }

        // Clear existing schema and add new fields
        schemaBuilder.clearSchema();
        parsedData.forEach(field => {
            schemaBuilder.addCustomField();
            const lastField = schemaBuilder.schema[schemaBuilder.schema.length - 1];
            lastField.name = field.name;
            lastField.type = field.type;
        });

        // Re-render schema
        schemaBuilder.renderSchema();
        
        closeModal();
        showToast('success', 'Schema Created', `Successfully created schema with ${parsedData.length} fields from your data.`);
        
    } catch (error) {
        console.error('Error parsing data:', error);
        showToast('error', 'Parse Error', `Invalid format: ${error.message}`);
    } finally {
        hideLoading();
    }
}

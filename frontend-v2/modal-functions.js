// Modal Functions for Phase 2

// Global variable to track current tab
let currentPreviewTab = 'table';

async function generatePreview() {
    const schema = schemaBuilder.getSchema();
    if (schema.length === 0) {
        showToast('error', 'No Schema', 'Please add fields to your schema first.');
        return;
    }

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
                switchPreviewTab(currentPreviewTab);
            }, 100);
            
            showToast('success', 'Preview Generated', '5 sample records generated successfully!');
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
    
    console.log('Generated table HTML:', tableHTML);
    console.log('Generated raw HTML:', rawHTML);
    
    content.innerHTML = `
        <div id="table-view" class="preview-view active">
            ${tableHTML}
        </div>
        <div id="raw-view" class="preview-view">
            ${rawHTML}
        </div>
    `;
    
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

function switchPreviewTab(tab) {
    // Update the global current tab variable
    currentPreviewTab = tab;
    
    console.log('=== TAB SWITCH DEBUG ===');
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
    const tabButtons = modal.querySelectorAll('.preview-tabs .tab-btn');
    
    console.log('table-view element:', tableView);
    console.log('raw-view element:', rawView);
    console.log('Tab buttons found:', tabButtons.length);
    
    // Also try finding by ID in case modal scope is wrong
    const tableViewById = document.getElementById('table-view');
    const rawViewById = document.getElementById('raw-view');
    console.log('table-view by ID:', tableViewById);
    console.log('raw-view by ID:', rawViewById);

    if (!tableView && !tableViewById) {
        console.error('Table view element not found in modal or by ID!');
        return;
    }
    
    if (!rawView && !rawViewById) {
        console.error('Raw view element not found in modal or by ID!');
        return;
    }
    
    // Use whichever element we found
    const actualTableView = tableView || tableViewById;
    const actualRawView = rawView || rawViewById;

    tabButtons.forEach(btn => btn.classList.remove('active'));
    
    if (tab === 'table') {
        actualTableView.style.setProperty('display', 'flex', 'important');
        actualTableView.style.visibility = 'visible';
        actualRawView.style.setProperty('display', 'none', 'important');
        if (tabButtons[0]) tabButtons[0].classList.add('active');
        console.log('Switched to TABLE view');
        console.log('Table view display:', actualTableView.style.display);
        console.log('Raw view display:', actualRawView.style.display);
    } else if (tab === 'raw') {
        actualTableView.style.setProperty('display', 'none', 'important');
        actualRawView.style.setProperty('display', 'flex', 'important');
        actualRawView.style.visibility = 'visible';
        if (tabButtons[1]) tabButtons[1].classList.add('active');
        console.log('Switched to RAW view');
        console.log('Table view display:', actualTableView.style.display);
        console.log('Raw view display:', actualRawView.style.display);
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

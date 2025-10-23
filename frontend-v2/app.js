// Main Application Logic

// Configuration - Auto-detect environment
const CONFIG = {
    n8nBaseUrl: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:5678/webhook' 
        : 'https://n8n.gptlab.ae/webhook',
    simpleGeneratorWebhook: 'generate-simple',
    intelligentGeneratorWebhook: 'generate-intelligent'
};

let currentGeneratedData = null;
let chatSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Toast Notification System
function showToast(type, title, message, duration = 5000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    toast.innerHTML = `
        <div class="toast-icon">${icons[type] || icons.info}</div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    container.appendChild(toast);
    
    // Auto-remove after duration
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Tab Switching
function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab;

            // Update button states
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            // Update content visibility
            tabContents.forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(`${targetTab}-tab`).classList.add('active');
        });
    });
}

// Loading Overlay
function showLoading(message = 'Generating data...') {
    const overlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    loadingText.textContent = message;
    overlay.classList.add('active');
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    overlay.classList.remove('active');
}

// Simple Data Generation (Schema Builder Path)
async function generateSimpleData() {
    // Validate schema
    const validation = schemaBuilder.validateSchema();
    if (!validation.valid) {
        showToast('error', 'Validation Error', validation.message);
        return;
    }

    const schema = schemaBuilder.getSchema();
    const recordCount = parseInt(document.getElementById('recordCount').value);
    const exportFormat = document.getElementById('exportFormat').value;

    if (recordCount < 1 || recordCount > 10000) {
        showToast('warning', 'Invalid Input', 'Please enter a valid number of records (1-10,000)');
        return;
    }

    showLoading('Generating synthetic data...');

    try {
        const response = await fetch(`${CONFIG.n8nBaseUrl}/${CONFIG.simpleGeneratorWebhook}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                schema: schema,
                recordCount: recordCount,
                exportFormat: exportFormat
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.success && result.data) {
            currentGeneratedData = result.data;
            downloadGeneratedData(exportFormat);
            showToast('success', 'Data Generated Successfully!', `${recordCount} records have been generated and downloaded as ${exportFormat.toUpperCase()}.`);
        } else {
            throw new Error(result.error || 'Unknown error occurred');
        }
    } catch (error) {
        console.error('Error generating data:', error);
        showToast('error', 'Generation Failed', `${error.message}. Please ensure n8n is running and the workflow is properly configured.`);
    } finally {
        hideLoading();
    }
}

// Intelligent Data Generation (AI Chat Path)
async function sendChatMessage(message = null) {
    // If no message provided, try to get it from the old chat input (for backward compatibility)
    if (!message) {
    const chatInput = document.getElementById('chat-input');
        if (chatInput) {
            message = chatInput.value.trim();
            if (chatInput) chatInput.value = '';
        }
    }

    if (!message) {
        showToast('warning', 'Empty Message', 'Please enter a description of the data you need');
        return;
    }

    // Add user message to chat
    addMessageToChat('user', message);

    showLoading('AI is processing your request...');

    try {
        const response = await fetch(`${CONFIG.n8nBaseUrl}/${CONFIG.intelligentGeneratorWebhook}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chatInput: message,
                sessionId: chatSessionId
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.response) {
            // Add AI response to chat
            addMessageToChat('assistant', result.response.message || 'Data generated successfully!');
            
            // If data was generated, display it in table format
            if (result.response.data && result.response.data.length > 0) {
                currentGeneratedData = result.response.data;
                
                // Extract schema from the data (field names and infer types)
                const schema = extractSchemaFromData(result.response.data);
                
                // Render the editable schema in the preview section
                renderAIGeneratedSchema(schema);
                
                // Show download buttons
                const downloadActions = document.getElementById('download-actions');
                if (downloadActions) {
                    downloadActions.style.display = 'flex';
                }
                
                showToast('success', 'AI Generated Data', `Successfully generated ${result.response.data.length} records based on your request.`);
            }
        } else {
            throw new Error('Invalid response from AI');
        }
    } catch (error) {
        console.error('Error:', error);
        addMessageToChat('assistant', `Sorry, I encountered an error: ${error.message}. Please ensure n8n is running and the workflow is configured correctly.`);
        showToast('error', 'AI Error', error.message);
    } finally {
        hideLoading();
    }
}

// Extract schema from AI-generated data (infer from field names and values)
function extractSchemaFromData(data) {
    if (!data || data.length === 0) return [];
    
    const headers = Object.keys(data[0]);
    return headers.map(header => ({
        name: header,
        type: inferFieldType(header, data[0][header])
    }));
}

// Infer field type from field name and sample value
function inferFieldType(fieldName, sampleValue) {
    const nameLower = fieldName.toLowerCase();
    
    // Map common AI field names to dropdown types
    const fieldTypeMapping = {
        // Personal
        'first_name': 'First Name',
        'firstname': 'First Name',
        'last_name': 'Last Name',
        'lastname': 'Last Name',
        'email': 'Email Address',
        'phone': 'Phone Number',
        'address': 'Address',
        'birthdate': 'Birthdate',
        'age': 'Age',
        
        // Business
        'company': 'Company',
        'job_title': 'Job Title',
        'jobtitle': 'Job Title',
        'department': 'Department',
        
        // Financial
        'credit_card': 'Credit Card',
        'creditcard': 'Credit Card',
        'card_number': 'Credit Card',
        'cardnumber': 'Credit Card',
        'currency': 'Currency',
        'amount': 'Amount',
        'transaction_amount': 'Transaction Amount',
        'transactionamount': 'Transaction Amount',
        'transaction_id': 'Transaction ID',
        'transactionid': 'Transaction ID',
        'account_number': 'Account Number',
        'accountnumber': 'Account Number',
        'invoice_number': 'Invoice Number',
        'invoicenumber': 'Invoice Number',
        'payment_status': 'Payment Status',
        'paymentstatus': 'Payment Status',
        'merchant': 'Company',
        'merchantname': 'Company',
        'merchant_name': 'Company',
        'cardholder_name': 'First Name',
        'cardholdername': 'First Name',
        'customer_name': 'First Name',
        'customername': 'First Name',
        
        // Technical
        'uuid': 'UUID',
        'id': 'UUID',
        'url': 'URL',
        'username': 'Username',
        'ip_address': 'IP Address v4',
        'ipaddress': 'IP Address v4',
        
        // Date/Time
        'date': 'Date',
        'datetime': 'DateTime',
        'timestamp': 'Timestamp',
        'transaction_date': 'DateTime',
        'transactiondate': 'DateTime',
        'created_at': 'DateTime',
        'createdat': 'DateTime',
        
        // Numbers
        'integer': 'Integer',
        'decimal': 'Decimal',
        'percentage': 'Percentage',
        'percent': 'Percentage'
    };
    
    // Try exact match first
    if (fieldTypeMapping[nameLower]) {
        return fieldTypeMapping[nameLower];
    }
    
    // Try partial matches
    if (nameLower.includes('email')) return 'Email Address';
    if (nameLower.includes('phone')) return 'Phone Number';
    if (nameLower.includes('address')) return 'Address';
    if (nameLower.includes('name')) {
        if (nameLower.includes('first')) return 'First Name';
        if (nameLower.includes('last')) return 'Last Name';
        if (nameLower.includes('customer') || nameLower.includes('cardholder')) return 'First Name';
        if (nameLower.includes('merchant') || nameLower.includes('company')) return 'Company';
        return 'First Name';
    }
    if (nameLower.includes('date') || nameLower.includes('time')) return 'DateTime';
    if (nameLower.includes('transaction') && nameLower.includes('id')) return 'Transaction ID';
    if (nameLower.includes('transaction') && (nameLower.includes('amount') || nameLower.includes('value'))) return 'Transaction Amount';
    if (nameLower.includes('transaction') && (nameLower.includes('type') || nameLower.includes('code') || nameLower.includes('method'))) return 'Payment Status';
    if (nameLower.includes('card')) return 'Credit Card';
    if (nameLower.includes('amount') || nameLower.includes('price') || nameLower.includes('cost')) return 'Amount';
    if (nameLower.includes('currency')) return 'Currency';
    if (nameLower.includes('status')) return 'Payment Status';
    if (nameLower.includes('id') || nameLower.includes('uuid')) return 'UUID';
    
    // Analyze sample value
    if (typeof sampleValue === 'number') {
        return Number.isInteger(sampleValue) ? 'Integer' : 'Decimal';
    }
    if (sampleValue instanceof Date || (typeof sampleValue === 'string' && !isNaN(Date.parse(sampleValue)) && sampleValue.includes('T'))) {
        return 'DateTime';
    }
    if (typeof sampleValue === 'boolean') {
        return 'Boolean';
    }
    
    // Default fallback
    return 'Custom';
}

// Render AI-generated schema as editable fields
function renderAIGeneratedSchema(schema) {
    const previewContent = document.getElementById('main-preview-content');
    if (!previewContent || !schema || schema.length === 0) return;
    
    let schemaHtml = `
        <div class="schema-table">
            <div class="schema-table-header">
                <div class="header-cell reorder-header"></div>
                <div class="header-cell">FIELD NAME</div>
                <div class="header-cell">TYPE</div>
                <div class="header-cell">OPTIONS</div>
                <div class="header-cell">ACTIONS</div>
            </div>
    `;
    
    schema.forEach((field, index) => {
        const isFirst = index === 0;
        const isLast = index === schema.length - 1;
        
        schemaHtml += `
            <div class="schema-field" data-field-index="${index}">
                <div class="field-cell reorder-cell">
                    <div class="reorder-controls">
                        <button class="reorder-btn btn-move-up" onclick="moveAIFieldUp(${index})" ${isFirst ? 'disabled' : ''}>
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M8 4.5L4 8.5h8L8 4.5z"/>
                            </svg>
                        </button>
                        <button class="reorder-btn btn-move-down" onclick="moveAIFieldDown(${index})" ${isLast ? 'disabled' : ''}>
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M8 11.5L4 7.5h8L8 11.5z"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="field-cell">
                    <input type="text" value="${escapeHtml(field.name)}" class="field-name-input" onchange="updateAIFieldName(${index}, this.value)">
                </div>
                <div class="field-cell">
                    <select class="field-type-select" onchange="updateAIFieldType(${index}, this.value)">
                        ${generateFieldTypeOptions(field.type)}
                    </select>
                </div>
                <div class="field-cell">
                    <div class="blank-control">
                        <span>blank:</span>
                        <input type="number" min="0" max="100" value="0" class="blank-percent-input" onchange="updateAIFieldBlankPercent(${index}, this.value)">
                        <span>%</span>
                    </div>
                </div>
                <div class="field-cell actions-cell">
                    <button class="btn-remove-field" onclick="removeAIField(${index})" title="Remove field">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    });
    
    schemaHtml += `
        </div>
    `;
    
    previewContent.innerHTML = schemaHtml;
    
    // Programmatically set the selected values for each dropdown (innerHTML doesn't honor selected attribute)
    const selects = previewContent.querySelectorAll('.field-type-select');
    selects.forEach((select, index) => {
        if (schema[index]) {
            select.value = schema[index].type;
        }
    });
}

// Generate field type dropdown options with the correct one selected
function generateFieldTypeOptions(selectedType) {
    const fieldTypes = [
        'First Name', 'Last Name', 'Email Address', 'Phone Number', 'Address', 'Gender', 'Birthdate', 'Age',
        'Company', 'Job Title', 'Department', 'Industry', 'Website',
        'Credit Card', 'Currency', 'Amount', 'IBAN', 'Account Number', 'Invoice Number', 'Tax ID', 
        'Ledger Code', 'Cost Center', 'Transaction ID', 'Transaction Amount', 'Payment Status',
        'UUID', 'IP Address v4', 'IP Address v6', 'URL', 'Username', 'Password', 'MAC Address', 'User Agent',
        'Date', 'DateTime', 'Time', 'Timestamp', 'Future Date', 'Past Date',
        'Integer', 'Decimal', 'Percentage', 'Row Number', 'Boolean',
        'Latitude', 'Longitude', 'Country', 'City', 'State', 'Zip Code', 'Street Name', 'Building Number',
        'Custom'
    ];
    
    return fieldTypes.map(type => 
        `<option value="${type}" ${type === selectedType ? 'selected' : ''}>${type}</option>`
    ).join('');
}

// Display AI-generated data in table format (for A.I Mode)
function displayAIDataPreview(data) {
    const previewContent = document.getElementById('main-preview-content');
    
    if (!previewContent || !data || data.length === 0) {
        if (previewContent) {
            previewContent.innerHTML = '<p class="preview-placeholder">No data to display</p>';
        }
        return;
    }

    // Create schema builder view like the screenshot
    const headers = Object.keys(data[0]);
    
    let schemaHtml = `
        <div class="schema-table">
            <div class="schema-table-header">
                <div class="header-cell reorder-header"></div>
                <div class="header-cell">FIELD NAME</div>
                <div class="header-cell">TYPE</div>
                <div class="header-cell">OPTIONS</div>
                <div class="header-cell">ACTIONS</div>
            </div>
    `;
    
    headers.forEach((header, index) => {
        // Determine field type based on sample data
        const sampleValue = data[0][header];
        let fieldType = 'String';
        
        if (typeof sampleValue === 'number') {
            fieldType = 'Number';
        } else if (sampleValue instanceof Date || (typeof sampleValue === 'string' && !isNaN(Date.parse(sampleValue)))) {
            fieldType = 'Date';
        } else if (typeof sampleValue === 'boolean') {
            fieldType = 'Boolean';
        } else if (header.toLowerCase().includes('id') && typeof sampleValue === 'string' && sampleValue.length > 20) {
            fieldType = 'UUID';
        } else if (header.toLowerCase().includes('email')) {
            fieldType = 'Email';
        } else if (header.toLowerCase().includes('phone')) {
            fieldType = 'Phone';
        } else if (header.toLowerCase().includes('name')) {
            fieldType = header.toLowerCase().includes('first') ? 'First Name' : 
                       header.toLowerCase().includes('last') ? 'Last Name' : 'Name';
        }
        
        schemaHtml += `
            <div class="schema-field">
                <div class="field-cell reorder-cell">
                    <div class="reorder-controls">
                        <button class="reorder-btn" onclick="moveAIFieldUp(${index})" ${index === 0 ? 'disabled' : ''}>
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M8 4.5L4 8.5h8L8 4.5z"/>
                            </svg>
                        </button>
                        <button class="reorder-btn" onclick="moveAIFieldDown(${index})" ${index === headers.length - 1 ? 'disabled' : ''}>
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M8 11.5L4 7.5h8L8 11.5z"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="field-cell">
                    <input type="text" value="${escapeHtml(header)}" class="field-name-input">
                </div>
                <div class="field-cell">
                       <select class="field-type-select">
                           <option value="First Name">First Name</option>
                           <option value="Last Name">Last Name</option>
                           <option value="Email Address">Email Address</option>
                           <option value="Phone Number">Phone Number</option>
                           <option value="Address">Address</option>
                           <option value="Gender">Gender</option>
                           <option value="Birthdate">Birthdate</option>
                           <option value="Age">Age</option>
                           <option value="Company">Company</option>
                           <option value="Job Title">Job Title</option>
                           <option value="Department">Department</option>
                           <option value="Industry">Industry</option>
                           <option value="Website">Website</option>
                           <option value="Credit Card">Credit Card</option>
                           <option value="Currency">Currency</option>
                           <option value="Amount">Amount</option>
                           <option value="IBAN">IBAN</option>
                           <option value="Account Number">Account Number</option>
                           <option value="Invoice Number">Invoice Number</option>
                           <option value="Tax ID">Tax ID</option>
                           <option value="Ledger Code">Ledger Code</option>
                           <option value="Cost Center">Cost Center</option>
                           <option value="Transaction ID">Transaction ID</option>
                           <option value="Transaction Amount">Transaction Amount</option>
                           <option value="Payment Status">Payment Status</option>
                           <option value="UUID">UUID</option>
                           <option value="IP Address v4">IP Address v4</option>
                           <option value="IP Address v6">IP Address v6</option>
                           <option value="URL">URL</option>
                           <option value="Username">Username</option>
                           <option value="Password">Password</option>
                           <option value="MAC Address">MAC Address</option>
                           <option value="User Agent">User Agent</option>
                           <option value="Date">Date</option>
                           <option value="DateTime">DateTime</option>
                           <option value="Time">Time</option>
                           <option value="Timestamp">Timestamp</option>
                           <option value="Future Date">Future Date</option>
                           <option value="Past Date">Past Date</option>
                           <option value="Integer">Integer</option>
                           <option value="Decimal">Decimal</option>
                           <option value="Percentage">Percentage</option>
                           <option value="Row Number">Row Number</option>
                           <option value="Boolean">Boolean</option>
                           <option value="Latitude">Latitude</option>
                           <option value="Longitude">Longitude</option>
                           <option value="Country">Country</option>
                           <option value="City">City</option>
                           <option value="State">State</option>
                           <option value="Zip Code">Zip Code</option>
                           <option value="Street Name">Street Name</option>
                           <option value="Building Number">Building Number</option>
                           <option value="Custom">Custom</option>
                       </select>
                </div>
                <div class="field-cell">
                    <span class="blank-label">blank:</span>
                    <input type="number" value="0" min="0" max="100" class="blank-percentage">
                    <span class="blank-percent">%</span>
                </div>
                <div class="field-cell">
                    <button class="remove-field-btn" onclick="removeAIField(${index})">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    });
    
    schemaHtml += '</div>';
    
    previewContent.innerHTML = schemaHtml;
    
    // Show the preview button and schema management buttons
    const previewBtn = document.getElementById('ai-preview-btn');
    if (previewBtn) {
        previewBtn.style.display = 'flex';
    }
    
    const schemaManagement = document.getElementById('ai-schema-management');
    if (schemaManagement) {
        schemaManagement.style.display = 'flex';
    }
    
    const downloadActions = document.getElementById('download-actions');
    if (downloadActions) {
        downloadActions.style.display = 'flex';
    }
}

// Chat UI Functions
function addMessageToChat(role, content) {
    const chatMessages = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    const avatar = role === 'user' ? '👤' : '🤖';
    
    messageDiv.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">
            <p>${escapeHtml(content)}</p>
        </div>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/\n/g, '<br>');
}

// Data Preview Display
function displayDataPreview(data) {
    console.log('displayDataPreview called with:', data);
    
    // Retry mechanism in case of DOM timing issues
    let attempts = 0;
    const maxAttempts = 3;
    
    const tryDisplay = () => {
        attempts++;
        console.log(`Attempt ${attempts} to find elements`);
        
        const previewContent = document.getElementById('main-preview-content');
    const downloadActions = document.getElementById('download-actions');
        
        console.log('previewContent element:', previewContent);
        console.log('downloadActions element:', downloadActions);

        if (!previewContent) {
            console.error(`previewContent element not found on attempt ${attempts}!`);
            if (attempts < maxAttempts) {
                console.log('Retrying in 100ms...');
                setTimeout(tryDisplay, 100);
                return;
            }
            console.error('Max attempts reached, giving up');
            return;
        }
        
        // Continue with the rest of the function
        displayDataPreviewInner(data, previewContent, downloadActions);
    };
    
    tryDisplay();
}

function displayDataPreviewInner(data, previewContent, downloadActions) {

    if (!data || data.length === 0) {
        try {
        previewContent.innerHTML = '<p class="preview-placeholder">No data to display</p>';
            if (downloadActions) downloadActions.style.display = 'none';
        } catch (e) {
            console.error('Error setting innerHTML for empty data:', e);
        }
        return;
    }

    // Create table
    const headers = Object.keys(data[0]);
    const previewData = data.slice(0, 10); // Show first 10 rows
    
    let tableHtml = '<table class="preview-table"><thead><tr>';
    headers.forEach(header => {
        tableHtml += `<th>${escapeHtml(header)}</th>`;
    });
    tableHtml += '</tr></thead><tbody>';
    
    previewData.forEach(row => {
        tableHtml += '<tr>';
        headers.forEach(header => {
            tableHtml += `<td>${escapeHtml(String(row[header] || ''))}</td>`;
        });
        tableHtml += '</tr>';
    });
    
    tableHtml += '</tbody></table>';
    
    if (data.length > 10) {
        tableHtml += `<p style="text-align: center; margin-top: 12px; color: var(--text-secondary);">Showing 10 of ${data.length} records</p>`;
    }
    
    try {
    previewContent.innerHTML = tableHtml;
        if (downloadActions) downloadActions.style.display = 'flex';
    } catch (e) {
        console.error('Error setting innerHTML for table:', e);
        console.error('previewContent element:', previewContent);
        console.error('tableHtml length:', tableHtml.length);
    }
}

// Download Functions
function downloadData(format) {
    if (!currentGeneratedData) {
        showToast('warning', 'No Data', 'No data available to download');
        return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `synthetic_data_${timestamp}`;

    if (format === 'csv') {
        downloadCSV(currentGeneratedData, filename);
        showToast('success', 'Downloaded CSV', `File saved as ${filename}.csv`);
    } else if (format === 'excel') {
        downloadExcel(currentGeneratedData, filename);
        showToast('success', 'Downloaded Excel', `File saved as ${filename}.xlsx`);
    }
}

function downloadGeneratedData(format) {
    if (!currentGeneratedData) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `synthetic_data_${timestamp}`;

    if (format === 'csv') {
        downloadCSV(currentGeneratedData, filename);
    } else if (format === 'excel') {
        downloadExcel(currentGeneratedData, filename);
    }
}

function downloadCSV(data, filename) {
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `${filename}.csv`);
}

function downloadExcel(data, filename) {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
    
    // Generate buffer
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    downloadBlob(blob, `${filename}.xlsx`);
}

function downloadBlob(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
}

// New AI input functions for Phase 1
function generateSchema() {
    const topicInput = document.getElementById('topic-input');
    const fieldCount = document.getElementById('field-count');
    const sampleDataInput = document.getElementById('sample-data-input');
    
    let input = '';
    
    if (topicInput && topicInput.value.trim()) {
        input = `Generate a schema for: ${topicInput.value.trim()} with ${fieldCount.value} fields`;
    } else if (sampleDataInput && sampleDataInput.value.trim()) {
        input = `Generate a schema from this sample data: ${sampleDataInput.value.trim()}`;
    } else {
        showToast('error', 'Input Required', 'Please provide either a topic description or sample data.');
        return;
    }
    
    // For now, show a placeholder message
    showToast('info', 'Schema Generation', 'Schema generation feature will be implemented in Phase 2. This will generate a schema preview similar to the Schema Builder.');
}

function generateFullData() {
    const topicInput = document.getElementById('topic-input');
    const fieldCount = document.getElementById('field-count');
    const sampleDataInput = document.getElementById('sample-data-input');
    
    let input = '';
    
    if (topicInput && topicInput.value.trim()) {
        const topicText = topicInput.value.trim();
        
        // Extract requested record count from the prompt
        const recordMatch = topicText.match(/(\d+)\s*records?/i);
        if (recordMatch) {
            const requestedRecords = parseInt(recordMatch[1]);
            if (requestedRecords > 1000) {
                showToast('warning', 'Record Limit Exceeded', 'A.I. Mode is limited to 1,000 records. For larger datasets, please contact us or use Schema Builder mode (up to 10,000 records).');
                return;
            }
        }
        
        // Check if it's already a full prompt (contains "I need", "Generate", etc.)
        if (topicText.toLowerCase().includes('i need') || 
            topicText.toLowerCase().includes('generate') ||
            topicText.toLowerCase().includes('records') ||
            topicText.toLowerCase().includes('data')) {
            // It's already a full prompt, use it directly but enforce limit
            input = topicText;
        } else {
            // It's just a topic, construct a smart prompt with max 1000 records
            const numRecords = Math.min(parseInt(fieldCount.value) || 100, 1000);
            input = `Generate exactly ${numRecords} records of ${topicText} data with ${fieldCount.value} relevant fields. Do not ask any questions. Be intelligent and choose appropriate field names and types for ${topicText} data. Generate the data immediately without asking for clarification. Maximum 1000 records allowed.`;
        }
    } else if (sampleDataInput && sampleDataInput.value.trim()) {
        input = `Generate data based on this sample (maximum 1000 records): ${sampleDataInput.value.trim()}`;
    } else {
        showToast('error', 'Input Required', 'Please provide either a topic description or sample data.');
        return;
    }
    
    // Use the existing sendChatMessage function with the structured input
    sendChatMessage(input);
}

// AI Preview Modal Function
function openAIPreviewModal() {
    if (!currentGeneratedData || currentGeneratedData.length === 0) {
        showToast('warning', 'No Data', 'No generated data available to preview.');
        return;
    }
    
    const modalContent = `
        <div class="modal-header">
            <h2 class="modal-title">AI Generated Data Preview</h2>
            <p class="modal-subtitle">Generated ${currentGeneratedData.length} records</p>
            <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <div class="modal-body">
            <div class="preview-tabs">
                <button class="tab-btn active" onclick="switchPreviewTab('table')">TABLE</button>
                <button class="tab-btn" onclick="switchPreviewTab('raw')">RAW</button>
            </div>
            <div class="preview-content" id="modal-preview-content">
                <!-- Content will be populated by displayPreviewData -->
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn-secondary" onclick="closeModal()">Close</button>
            <button class="btn-primary" onclick="downloadData('csv')">Download CSV</button>
            <button class="btn-primary" onclick="downloadData('excel')">Download Excel</button>
        </div>
    `;
    
    openModal(modalContent);
    
    // Display the data in the modal
    displayPreviewData(currentGeneratedData);
}

// AI Schema Management Functions
function moveAIFieldUp(index) {
    if (!currentGeneratedData || currentGeneratedData.length === 0) return;
    
    const headers = Object.keys(currentGeneratedData[0]);
    if (index <= 0 || index >= headers.length) return;
    
    // Swap headers
    [headers[index], headers[index - 1]] = [headers[index - 1], headers[index]];
    
    // Recreate data with new header order
    const reorderedData = currentGeneratedData.map(row => {
        const newRow = {};
        headers.forEach(header => {
            newRow[header] = row[header];
        });
        return newRow;
    });
    
    currentGeneratedData = reorderedData;
    
    // Re-render schema with updated order
    const schema = extractSchemaFromData(reorderedData);
    renderAIGeneratedSchema(schema);
}

function moveAIFieldDown(index) {
    if (!currentGeneratedData || currentGeneratedData.length === 0) return;
    
    const headers = Object.keys(currentGeneratedData[0]);
    if (index < 0 || index >= headers.length - 1) return;
    
    // Swap headers
    [headers[index], headers[index + 1]] = [headers[index + 1], headers[index]];
    
    // Recreate data with new header order
    const reorderedData = currentGeneratedData.map(row => {
        const newRow = {};
        headers.forEach(header => {
            newRow[header] = row[header];
        });
        return newRow;
    });
    
    currentGeneratedData = reorderedData;
    
    // Re-render schema with updated order
    const schema = extractSchemaFromData(reorderedData);
    renderAIGeneratedSchema(schema);
}

function removeAIField(index) {
    if (!currentGeneratedData || currentGeneratedData.length === 0) return;
    
    const headers = Object.keys(currentGeneratedData[0]);
    if (index < 0 || index >= headers.length) return;
    
    // Remove header
    const removedHeader = headers.splice(index, 1)[0];
    
    // Recreate data without the removed field
    const filteredData = currentGeneratedData.map(row => {
        const newRow = {};
        headers.forEach(header => {
            newRow[header] = row[header];
        });
        return newRow;
    });
    
    currentGeneratedData = filteredData;
    
    // Re-render schema without the removed field
    const schema = extractSchemaFromData(filteredData);
    renderAIGeneratedSchema(schema);
}

function addAICustomField() {
    if (!currentGeneratedData || currentGeneratedData.length === 0) {
        // If no data exists, create a new schema with one field
        currentGeneratedData = [{
            'custom_field': 'sample_value'
        }];
    } else {
        // Add a new field to existing data
        const headers = Object.keys(currentGeneratedData[0]);
        const newFieldName = `field_${headers.length + 1}`;
        
        const updatedData = currentGeneratedData.map(row => {
            const newRow = { ...row };
            newRow[newFieldName] = 'sample_value';
            return newRow;
        });
        
        currentGeneratedData = updatedData;
    }
    
    displayAIDataPreview(currentGeneratedData);
}

// Stub functions for AI field updates (not used for regeneration, just for display)
function updateAIFieldName(index, newName) {
    // Field name updates are visual only
    console.log(`Field ${index} renamed to ${newName}`);
}

function updateAIFieldType(index, newType) {
    // Field type updates are visual only
    console.log(`Field ${index} type changed to ${newType}`);
}

function updateAIFieldBlankPercent(index, percent) {
    // Blank percent updates are visual only
    console.log(`Field ${index} blank percent set to ${percent}%`);
}

function clearAISchema() {
    if (confirm('Are you sure you want to clear all fields? This action cannot be undone.')) {
        currentGeneratedData = [];
        
        // Hide the schema management buttons
        const schemaManagement = document.getElementById('ai-schema-management');
        if (schemaManagement) {
            schemaManagement.style.display = 'none';
        }
        
        // Hide the preview button and download actions
        const previewBtn = document.getElementById('ai-preview-btn');
        if (previewBtn) {
            previewBtn.style.display = 'none';
        }
        
        const downloadActions = document.getElementById('download-actions');
        if (downloadActions) {
            downloadActions.style.display = 'none';
        }
        
        // Reset the preview content
        const previewContent = document.getElementById('main-preview-content');
        if (previewContent) {
            previewContent.innerHTML = '<p class="preview-placeholder">Your generated data will appear here</p>';
        }
        
        showToast('info', 'Schema Cleared', 'All fields have been removed from the schema.');
    }
}

// Enter key support for chat and topic input
document.addEventListener('DOMContentLoaded', () => {
    initTabs();

    // Support for old chat input (backward compatibility)
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChatMessage();
            }
        });
    }

    // Support for new topic input textarea
    const topicInput = document.getElementById('topic-input');
    if (topicInput) {
        topicInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                generateFullData();
            }
        });
    }
});

// Modal System
function openModal(content) {
    const overlay = document.getElementById('modal-overlay');
    const modal = overlay.querySelector('.modal');
    modal.innerHTML = content;
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
}

// Modal Functions
function openPreviewModal() {
    const schema = schemaBuilder.getSchema();
    if (schema.length === 0) {
        showToast('warning', 'No Schema', 'Please add fields to your schema before previewing.');
        return;
    }

    const content = `
        <div class="modal-header">
            <div>
                <h3 class="modal-title">Preview</h3>
                <p class="modal-subtitle">Showing 5 sample records</p>
            </div>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">
            <div class="preview-tabs">
                <button class="tab-btn active" onclick="switchPreviewTab('table')">TABLE</button>
                <button class="tab-btn" onclick="switchPreviewTab('raw')">RAW</button>
            </div>
            <div id="modal-preview-content" class="preview-content">
                <p>Click "Generate Preview" to see sample data</p>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn-primary" onclick="generatePreview()">Generate Preview</button>
            <button class="btn-secondary" onclick="closeModal()">Close</button>
        </div>
    `;
    openModal(content);
    
    // Debug modal dimensions after opening
    setTimeout(() => {
        const overlay = document.getElementById('modal-overlay');
        const modal = overlay.querySelector('.modal');
        const modalBody = modal.querySelector('.modal-body');
        const previewContent = document.getElementById('modal-preview-content');
        
        console.log('=== MODAL DEBUG ===');
        console.log('Modal overlay active:', overlay.classList.contains('active'));
        console.log('Modal dimensions:', modal.getBoundingClientRect());
        console.log('Modal body dimensions:', modalBody?.getBoundingClientRect());
        console.log('Preview content dimensions (initial):', previewContent?.getBoundingClientRect());
        
        const modalStyle = window.getComputedStyle(modal);
        console.log('Modal computed styles:', {
            display: modalStyle.display,
            width: modalStyle.width,
            height: modalStyle.height,
            maxWidth: modalStyle.maxWidth,
            maxHeight: modalStyle.maxHeight
        });
    }, 100);
}

function openDeriveModal() {
    const content = `
        <div class="modal-header">
            <div>
                <h3 class="modal-title">Create Schema from Example Data</h3>
                <p class="modal-subtitle">Give us a few lines of example data and we'll use AI to choose the fields for you.</p>
            </div>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">
            <textarea 
                id="example-data" 
                class="example-textarea" 
                placeholder="Paste CSV, JSON, or XML data here..."
                rows="8"
            ></textarea>
        </div>
        <div class="modal-footer">
            <button class="btn-secondary" onclick="closeModal()">Close</button>
            <button class="btn-primary" onclick="deriveSchema()">Submit</button>
        </div>
    `;
    openModal(content);
}
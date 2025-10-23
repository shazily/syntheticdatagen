// Main Application Logic

// Configuration - Auto-detect environment
const CONFIG = {
    n8nBaseUrl: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:5678/webhook' 
        : 'https://n8n.gptlab.ae/webhook',
    simpleGeneratorWebhook: 'generate-simple',
    intelligentGeneratorWebhook: 'generate-intelligent-v3-learn'
};

let currentGeneratedData = null;
let chatSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// ===============================
// Schema State Management (AI Mode)
// ===============================
// Global schema state - tracks current UI schema modifications in real-time
let currentSchemaState = [];
let originalSchemaState = []; // Store original AI-generated schema for reset option

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
            
            // Auto-focus AI Mode input when switching to chat tab
            if (targetTab === 'chat') {
                // Use requestAnimationFrame to ensure DOM is fully updated
                requestAnimationFrame(() => {
                    setTimeout(() => {
                        const aiInput = document.getElementById('topic-input');
                        if (aiInput) {
                            aiInput.focus();
                        }
                    }, 200);
                });
            }
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
                    // Disable download button initially
                    setTimeout(disableDownloadButton, 100);
                }
                
                showToast('success', 'AI Generated Schema', `AI has generated a schema for you. Review and customize the fields below.`);
                
                // Show rating widget for user feedback (RL data collection)
                showRatingWidget();
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
    // Show the tabs container
    const tabsContainer = document.getElementById('preview-tabs-container');
    if (tabsContainer) {
        tabsContainer.style.display = 'block';
    }
    
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
                    <input type="text" 
                           class="custom-type-input" 
                           placeholder="e.g., Product SKU, Order Status..." 
                           style="display: ${field.type === 'Custom' ? 'block' : 'none'}; margin-top: 4px; width: 100%; padding: 6px; border: 1px solid var(--border-color); border-radius: 4px;" 
                           value="${escapeHtml(field.customType || '')}"
                           data-field-index="${index}"
                           onchange="updateAIFieldCustomType(${index}, this.value)">
                </div>
                <div class="field-cell">
                    <div class="blank-control">
                        <span>blank:</span>
                        <input type="number" min="0" max="100" value="${field.blankPercent || 0}" class="blank-percent-input" onchange="updateAIFieldBlankPercent(${index}, this.value)">
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
    
    // ✅ Initialize currentSchemaState with the passed schema
    currentSchemaState = schema.map(field => ({
        name: field.name,
        type: field.type,
        customType: field.customType || null,
        blankPercent: field.blankPercent || 0
    }));
    originalSchemaState = JSON.parse(JSON.stringify(currentSchemaState));
    console.log('✅ Schema state initialized in renderAIGeneratedSchema:', currentSchemaState);
    
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
                    <input type="text" value="${escapeHtml(header)}" class="field-name-input" onchange="updateAIFieldName(${index}, this.value)">
                </div>
                <div class="field-cell">
                       <select class="field-type-select" onchange="updateAIFieldType(${index}, this.value)">
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
                           <option value="Custom">✏️ Custom...</option>
                       </select>
                       <input type="text" 
                              class="custom-type-input" 
                              placeholder="e.g., Product SKU, Order Status..." 
                              style="display: none; margin-top: 4px; width: 100%;" 
                              data-field-index="${index}"
                              onchange="updateAIFieldCustomType(${index}, this.value)">
                </div>
                <div class="field-cell">
                    <span class="blank-label">blank:</span>
                    <input type="number" value="0" min="0" max="100" class="blank-percentage" onchange="updateAIFieldBlankPercent(${index}, this.value)">
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
    
    // ✅ Initialize schema state from the generated data
    currentSchemaState = headers.map((header, index) => {
        const sampleValue = data[0][header];
        let fieldType = 'Custom';
        
        // Infer field type from data
        if (typeof sampleValue === 'number') {
            fieldType = Number.isInteger(sampleValue) ? 'Integer' : 'Decimal';
        } else if (header.toLowerCase().includes('id') && typeof sampleValue === 'string' && sampleValue.length > 20) {
            fieldType = 'UUID';
        } else if (header.toLowerCase().includes('email')) {
            fieldType = 'Email Address';
        } else if (header.toLowerCase().includes('phone')) {
            fieldType = 'Phone Number';
        } else if (header.toLowerCase().includes('name')) {
            fieldType = header.toLowerCase().includes('first') ? 'First Name' : 
                       header.toLowerCase().includes('last') ? 'Last Name' : 'Custom';
        } else if (header.toLowerCase().includes('date') || header.toLowerCase().includes('time')) {
            fieldType = 'DateTime';
        }
        
        return {
            name: header,
            type: fieldType,
            customType: null,
            blankPercent: 0
        };
    });
    
    // Store original schema for reset option
    originalSchemaState = JSON.parse(JSON.stringify(currentSchemaState));
    
    console.log('✅ Schema state initialized:', currentSchemaState);
    
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
        // Disable download button initially
        setTimeout(disableDownloadButton, 100);
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
        if (downloadActions) {
            downloadActions.style.display = 'flex';
            // Disable download button initially
            setTimeout(disableDownloadButton, 100);
        }
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
    } else if (format === 'json') {
        downloadJSON(currentGeneratedData, filename);
        showToast('success', 'Downloaded JSON', `File saved as ${filename}.json`);
    } else if (format === 'xml') {
        downloadXML(currentGeneratedData, filename);
        showToast('success', 'Downloaded XML', `File saved as ${filename}.xml`);
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
    } else if (format === 'json') {
        downloadJSON(currentGeneratedData, filename);
    } else if (format === 'xml') {
        downloadXML(currentGeneratedData, filename);
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

function downloadJSON(data, filename) {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    downloadBlob(blob, `${filename}.json`);
}

function downloadXML(data, filename) {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<data>\n';
    
    data.forEach((record, index) => {
        xml += `  <record id="${index + 1}">\n`;
        Object.entries(record).forEach(([key, value]) => {
            // Escape XML special characters
            const escapedValue = String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
            xml += `    <${key}>${escapedValue}</${key}>\n`;
        });
        xml += '  </record>\n';
    });
    
    xml += '</data>';
    
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8;' });
    downloadBlob(blob, `${filename}.xml`);
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
        const numFields = Math.max(parseInt(fieldCount?.value) || 5, 1);
        
        // Generate SCHEMA PREVIEW only (10 sample records for preview)
        input = `${topicText}. Generate a schema with exactly ${numFields} relevant fields and create 10 sample records for preview. Choose appropriate field names and types.`;
        
    } else if (sampleDataInput && sampleDataInput.value.trim()) {
        input = `Generate a schema from this sample data and create 10 sample records for preview: ${sampleDataInput.value.trim()}`;
    } else {
        showToast('error', 'Input Required', 'Please provide either a topic description or sample data.');
        return;
    }
    
    // Store the original topic for later full data generation
    window.currentTopic = topicInput?.value.trim() || '';
    window.currentFieldCount = parseInt(fieldCount?.value) || 5;
    
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
                <button class="tab-btn active" onclick="switchPreviewTab('table')">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 6px;">
                        <path d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2zm15 2h-4v3h4V4zm0 4h-4v3h4V8zm0 4h-4v3h3a1 1 0 0 0 1-1v-2zm-5 3v-3H6v3h4zm-5 0v-3H1v2a1 1 0 0 0 1 1h3zm-4-4h4V8H1v3zm0-4h4V4H1v3zm5-3v3h4V4H6zm4 4H6v3h4V8z"/>
                    </svg>
                    TABLE
                </button>
                <button class="tab-btn" onclick="switchPreviewTab('raw')">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 6px;">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14,2 14,8 20,8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                        <line x1="16" y1="17" x2="8" y2="17"/>
                        <polyline points="10,9 9,9 8,9"/>
                    </svg>
                    RAW
                </button>
                <button class="tab-btn" onclick="switchPreviewTab('sql')">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 6px;">
                        <path d="M3 2.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zM3 6a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9A.5.5 0 0 1 3 6zm0 3.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5z"/>
                        <path d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H2zm0 1h12v12H2V2z"/>
                        <path d="M4 4h8v1H4V4zm0 2h8v1H4V6zm0 2h8v1H4V8zm0 2h8v1H4v-1z"/>
                    </svg>
                    SQL
                </button>
            </div>
            <div class="preview-content" id="modal-preview-content">
                <div class="loading-spinner">
                    <div class="spinner"></div>
                    <p>Loading preview data...</p>
                </div>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn-primary" onclick="downloadData('csv')">Download CSV</button>
            <button class="btn-primary" onclick="downloadData('excel')">Download Excel</button>
            <button class="btn-primary" onclick="downloadData('json')">Download JSON</button>
            <button class="btn-primary" onclick="downloadData('xml')">Download XML</button>
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

window.addAICustomField = function() {
    // Add a new field to the current schema state
    const newFieldName = `field_${currentSchemaState.length + 1}`;
    const newField = {
        name: newFieldName,
        type: 'Custom',
        customType: null,
        blankPercent: 0
    };
    
    // Add to current schema state
    currentSchemaState.push(newField);
    
    // Re-render the schema with the new field
    renderAIGeneratedSchema(currentSchemaState);
    
    console.log('✅ Added new field to schema:', newField);
}

// ===============================
// Schema State Update Functions
// ===============================
// These functions update the global schema state when users modify fields

function updateAIFieldName(index, newName) {
    console.log(`Field ${index} renamed to ${newName}`);
    
    // Update global schema state
    if (currentSchemaState[index]) {
        currentSchemaState[index].name = newName;
        console.log('Schema state updated:', currentSchemaState);
    }
}

function updateAIFieldType(index, newType) {
    console.log(`Field ${index} type changed to ${newType}`);
    
    // Get the field row
    const fieldRows = document.querySelectorAll('#main-preview-content .schema-field');
    const currentRow = fieldRows[index];
    
    if (currentRow) {
        const customInput = currentRow.querySelector('.custom-type-input');
        
        if (newType === 'Custom') {
            // Show custom input field
            if (customInput) {
                customInput.style.display = 'block';
                customInput.focus();
            }
        } else {
            // Hide custom input field
            if (customInput) {
                customInput.style.display = 'none';
                customInput.value = '';
            }
            
            // Update global schema state with predefined type
            if (currentSchemaState[index]) {
                currentSchemaState[index].type = newType;
                currentSchemaState[index].customType = null;
                console.log('Schema state updated:', currentSchemaState);
            }
        }
    }
}

function updateAIFieldCustomType(index, customValue) {
    console.log(`Field ${index} custom type set to: ${customValue}`);
    
    // Update global schema state with custom type
    if (currentSchemaState[index]) {
        currentSchemaState[index].type = 'Custom';
        currentSchemaState[index].customType = customValue;
        console.log('Schema state updated with custom type:', currentSchemaState);
    }
}

function updateAIFieldBlankPercent(index, percent) {
    console.log(`Field ${index} blank percent set to ${percent}%`);
    
    // Update global schema state
    if (currentSchemaState[index]) {
        currentSchemaState[index].blankPercent = parseInt(percent) || 0;
        console.log('Schema state updated:', currentSchemaState);
    }
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

// Rating Widget for Reinforcement Learning
let currentChatLogId = null;

function showRatingWidget() {
    // Remove any existing rating widget
    const existingWidget = document.getElementById('rating-widget');
    if (existingWidget) {
        existingWidget.remove();
    }
    
    // Create rating widget HTML
    const ratingWidget = document.createElement('div');
    ratingWidget.id = 'rating-widget';
    ratingWidget.className = 'rating-widget';
    ratingWidget.innerHTML = `
        <div class="rating-content">
            <p class="rating-question">Was this AI response helpful?</p>
            <div class="rating-buttons">
                <button class="rating-btn thumbs-up" onclick="submitRating('thumbs_up')" title="Helpful">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
                    </svg>
                </button>
                <button class="rating-btn thumbs-down" onclick="submitRating('thumbs_down')" title="Not helpful">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path>
                    </svg>
                </button>
            </div>
        </div>
    `;
    
    // Insert into the chat tab (A.I. Mode)
    const chatTab = document.getElementById('chat-tab');
    if (chatTab) {
        chatTab.appendChild(ratingWidget);
        
        // Auto-hide after 30 seconds
        setTimeout(() => {
            if (ratingWidget.parentNode) {
                ratingWidget.classList.add('fade-out');
                setTimeout(() => ratingWidget.remove(), 500);
            }
        }, 30000);
    }
}

async function submitRating(rating) {
    const ratingWidget = document.getElementById('rating-widget');
    
    // Determine n8n URL based on environment
    const n8nUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:5678/webhook'
        : 'https://n8n.gptlab.ae/webhook';
    
    try {
        const response = await fetch(`${n8nUrl}/save-rating`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                sessionId: chatSessionId,
                chatLogId: currentChatLogId,
                rating: rating,
                feedbackComment: ''
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to save rating');
        }
        
        // Handle thumbs down - open feedback modal
        if (rating === 'thumbs_down') {
            if (ratingWidget) ratingWidget.remove();
            showToast('info', 'Feedback', 'Please tell us how we can improve!');
            // Open feedback modal with pre-filled context
            if (typeof openFeedbackModal === 'function') {
                openFeedbackModal();
            }
        } else {
            // Thumbs up - show thank you and remove widget
            showToast('success', 'Thank You!', 'Your feedback helps us improve the AI.');
            if (ratingWidget) {
                ratingWidget.classList.add('fade-out');
                setTimeout(() => ratingWidget.remove(), 500);
            }
        }
        
        // Track with GA4 if available
        if (typeof gtag === 'function') {
            gtag('event', 'ai_rating_submitted', {
                rating: rating,
                session_id: chatSessionId
            });
        }
        
    } catch (error) {
        console.error('Error submitting rating:', error);
        // Silently fail - don't disrupt user experience
    }
}

// Enter key support for chat and topic input
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    
    // Download button will be disabled when it becomes visible

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
    let overlay = document.getElementById('modal-overlay');
    let modal;
    
    // If modal overlay was removed, recreate it
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'modal-overlay';
        overlay.className = 'modal-overlay';
        overlay.onclick = function(e) {
            // Only close if clicking on the overlay itself, not on the modal content
            if (e.target === overlay) {
                closeModal();
            }
        };
        document.body.appendChild(overlay);
        
        modal = document.createElement('div');
        modal.className = 'modal';
        overlay.appendChild(modal);
    } else {
        modal = overlay.querySelector('.modal');
    }
    
    modal.innerHTML = content;
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
        overlay.classList.remove('active');
        // Remove the overlay from DOM completely to prevent pointer event interference
        setTimeout(() => {
            overlay.remove();
        }, 300); // Wait for animation to complete
    }
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
                <button class="tab-btn active" onclick="switchPreviewTab('table')">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 6px;">
                        <path d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2zm15 2h-4v3h4V4zm0 4h-4v3h4V8zm0 4h-4v3h3a1 1 0 0 0 1-1v-2zm-5 3v-3H6v3h4zm-5 0v-3H1v2a1 1 0 0 0 1 1h3zm-4-4h4V8H1v3zm0-4h4V4H1v3zm5-3v3h4V4H6zm4 4H6v3h4V8z"/>
                    </svg>
                    TABLE
                </button>
                <button class="tab-btn" onclick="switchPreviewTab('raw')">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 6px;">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14,2 14,8 20,8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                        <line x1="16" y1="17" x2="8" y2="17"/>
                        <polyline points="10,9 9,9 8,9"/>
                    </svg>
                    RAW
                </button>
                <button class="tab-btn" onclick="switchPreviewTab('sql')">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 6px;">
                        <path d="M3 2.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zM3 6a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9A.5.5 0 0 1 3 6zm0 3.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5z"/>
                        <path d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H2zm0 1h12v12H2V2z"/>
                        <path d="M4 4h8v1H4V4zm0 2h8v1H4V6zm0 2h8v1H4V8zm0 2h8v1H4v-1z"/>
                    </svg>
                    SQL
                </button>
            </div>
            <div id="modal-preview-content" class="preview-content">
                <div class="loading-spinner">
                    <div class="spinner"></div>
                    <p>Generating preview data...</p>
                </div>
            </div>
        </div>
    `;
    openModal(content);
    
    // Immediately generate preview data
    generatePreview();
    
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

// ===============================
// Generate Full Data Modal Functions
// ===============================

function openGenerateFullDataModal() {
    const content = `
        <div class="modal-header">
            <h2 class="modal-title">Generate Full Dataset</h2>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body" style="padding: 24px;">
            <p style="margin-bottom: 24px; color: var(--text-secondary); line-height: 1.5;">You're about to generate a full dataset with the schema you've created.</p>
            <div class="form-group" style="margin-bottom: 20px;">
                <label for="full-data-record-count" style="display: block; margin-bottom: 8px; font-weight: 500; color: var(--text-primary);">How many records do you need?</label>
                <input type="number" id="full-data-record-count" class="form-input" value="100" min="1" max="1000" style="width: 100%; padding: 12px 16px; border: 2px solid var(--border-color); border-radius: 8px; background: var(--bg-primary); color: var(--text-primary); font-size: 16px; transition: border-color 0.2s ease, box-shadow 0.2s ease;" onfocus="this.style.borderColor='var(--accent-primary)'; this.style.boxShadow='0 0 0 3px rgba(59, 130, 246, 0.1)'" onblur="this.style.borderColor='var(--border-color)'; this.style.boxShadow='none'">
            </div>
            <div style="margin-top: 24px; padding: 16px; background: var(--bg-secondary); border-radius: 8px; border-left: 4px solid var(--accent-primary);">
                <p style="margin: 0; font-size: 14px; color: var(--text-secondary); line-height: 1.4;">
                    <a href="javascript:void(0)" onclick="openContactAdminModal()" style="color: var(--accent-primary); text-decoration: none; font-weight: 500; border-bottom: 1px solid var(--accent-primary); padding-bottom: 1px; transition: all 0.2s ease; cursor: pointer;" onmouseover="this.style.color='var(--accent-hover)'" onmouseout="this.style.color='var(--accent-primary)'">
                        Contact admin
                    </a> if you want to deploy this for your organization.
                </p>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" onclick="confirmGenerateFullData()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 12l2 2 4-4"/>
                    <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c1.5 0 2.9.37 4.12 1.02"/>
                </svg>
                Generate Data
            </button>
        </div>
    `;
    openModal(content);
}

// closeGenerateFullDataModal() is no longer needed - using generic closeModal()

/**
 * Maps AI Mode field types to Schema Builder generator types
 * @param {string} aiType - AI Mode field type (e.g., "Email Address")
 * @returns {string} Schema Builder generator type (e.g., "email")
 */
function mapAITypeToGeneratorType(aiType) {
    const typeMap = {
        // Personal Data
        'First Name': 'firstName',
        'Last Name': 'lastName',
        'Email Address': 'email',
        'Phone Number': 'phone',
        'Address': 'address',
        'Gender': 'gender',
        'Birthdate': 'birthdate',
        'Age': 'age',
        
        // Business Data
        'Company': 'company',
        'Job Title': 'jobTitle',
        'Department': 'department',
        'Industry': 'industry',
        'Website': 'url',
        
        // Financial Data
        'Credit Card': 'creditCard',
        'Currency': 'currency',
        'Amount': 'amount',
        'IBAN': 'iban',
        'Account Number': 'accountNumber',
        'Invoice Number': 'invoiceNumber',
        'Tax ID': 'taxId',
        'Ledger Code': 'ledgerCode',
        'Cost Center': 'costCenter',
        'Transaction ID': 'transactionId',
        'Transaction Amount': 'amount',
        'Payment Status': 'paymentStatus',
        
        // Technical Data
        'UUID': 'uuid',
        'IP Address v4': 'ipAddress',
        'IP Address v6': 'ipAddress',
        'IP Address': 'ipAddress',
        'URL': 'url',
        'Username': 'username',
        'Password': 'password',
        'MAC Address': 'macAddress',
        'User Agent': 'userAgent',
        
        // Date & Time
        'Date': 'date',
        'DateTime': 'datetime',
        'Time': 'time',
        'Timestamp': 'timestamp',
        'Future Date': 'futureDate',
        'Past Date': 'pastDate',
        
        // Numbers
        'Integer': 'integer',
        'Decimal': 'decimal',
        'Percentage': 'percentage',
        'Row Number': 'rowNumber',
        'Boolean': 'boolean',
        
        // Geographic
        'Latitude': 'latitude',
        'Longitude': 'longitude',
        'Country': 'country',
        'City': 'city',
        'State': 'state',
        'Zip Code': 'zipCode',
        'Street Name': 'streetName',
        'Building Number': 'buildingNumber',
        
        // Default
        'Custom': 'custom'
    };
    
    return typeMap[aiType] || 'custom';
}

/**
 * Gets the current schema state from the UI (not from old data)
 * This ensures user modifications are captured
 * @returns {Array} Array of field objects with name, type, blankPercent
 */
function getCurrentSchemaFromUI() {
    const previewFields = document.querySelectorAll('#main-preview-content .schema-field');
    
        console.log('🔍 getCurrentSchemaFromUI: Found', previewFields.length, 'fields in DOM');
        console.log('🔍 getCurrentSchemaFromUI: currentSchemaState has', currentSchemaState.length, 'fields');
        console.log('🔍 getCurrentSchemaFromUI: DOM preview fields:', previewFields);
        console.log('🔍 getCurrentSchemaFromUI: currentSchemaState:', currentSchemaState);
    
    if (!previewFields || previewFields.length === 0) {
        console.log('No preview fields found, using currentSchemaState fallback');
        // Fallback to currentSchemaState if UI not available
        if (currentSchemaState.length > 0) {
            console.log('✅ Using currentSchemaState fallback:', currentSchemaState);
            return currentSchemaState;
        }
        return null;
    }
    
    const schema = Array.from(previewFields).map((row, index) => {
        const nameInput = row.querySelector('.field-name-input');
        const typeSelect = row.querySelector('.field-type-select');
        const blankPercentInput = row.querySelector('.blank-percent-input');
        const customTypeInput = row.querySelector('.custom-type-input');
        
        const selectedType = typeSelect?.value || 'Custom';
        const customType = (selectedType === 'Custom' && customTypeInput?.value) ? customTypeInput.value : null;
        
        return {
            name: nameInput?.value || `field_${index}`,
            type: selectedType,
            customType: customType,
            blankPercent: parseInt(blankPercentInput?.value) || 0
        };
    });
    
    // Update global state
    currentSchemaState = schema;
    
    console.log('✅ Current schema extracted from UI:', schema);
    return schema;
}

async function confirmGenerateFullData() {
    const recordCountInput = document.getElementById('full-data-record-count');
    const recordCount = parseInt(recordCountInput.value);
    
    // Validation
    if (!recordCount || recordCount < 1) {
        showToast('error', 'Invalid Input', 'Please enter a valid number of records.');
        return;
    }
    
    if (recordCount > 1000) {
        showToast('warning', 'Limit Exceeded', 'Maximum 1,000 records allowed. Please contact admin for larger datasets.');
        return;
    }
    
    // Close the modal
    closeModal();
    
    // Show loading
    showLoading(`Generating ${recordCount} records using fast generation, please wait...`);
    
    // Disable download button during generation
    const downloadBtn = document.querySelector('.btn-download.dropdown-toggle');
    if (downloadBtn) {
        downloadBtn.disabled = true;
    }
    
    try {
        // ✅ Get CURRENT schema state from UI (preserves user modifications!)
        const uiSchema = getCurrentSchemaFromUI();
        
        if (!uiSchema || uiSchema.length === 0) {
            throw new Error('No schema available. Please generate a schema preview first.');
        }
        
        console.log('🚀 Generating full data with user-modified schema:', uiSchema);
        
        // ✅ Convert AI schema to Schema Builder format
        const schemaBuilderFormat = uiSchema.map(field => {
            // Use custom type description if provided, otherwise map AI type to generator type
            const generatorType = field.customType 
                ? field.customType  // Custom types go as-is for AI interpretation
                : mapAITypeToGeneratorType(field.type);
            
            return {
                name: field.name,
                type: generatorType,
                blankPercentage: field.blankPercent || 0
            };
        });
        
        console.log('📋 Schema converted to Schema Builder format:', schemaBuilderFormat);
        
        // ✅ Call the simple generator with the user-modified schema
        // This will use fast deterministic generation based on the user's custom schema
        const response = await fetch(`${CONFIG.n8nBaseUrl}/${CONFIG.simpleGeneratorWebhook}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                schema: schemaBuilderFormat,
                recordCount: recordCount,
                exportFormat: 'csv' // Default format for AI Mode
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('🔍 N8N Response:', result);
        
        // Handle the simple generator response format: result.data
        if (result.success && result.data) {
            currentGeneratedData = result.data;
            
            // ✅ Update the preview with new data, preserving user-modified schema
            renderAIGeneratedSchema(uiSchema);
            
            // ✅ Show download buttons after data is ready
            const downloadActions = document.getElementById('download-actions');
            if (downloadActions) {
                downloadActions.style.display = 'flex';
            }
            
            // ✅ Enable download button after generation
            enableDownloadButton();
            
            showToast('success', 'Data Generated!', `Successfully generated ${result.data.length} records using fast generation. Download is now available.`);
        } else {
            throw new Error(result.error || 'Invalid response from server');
        }
        
    } catch (error) {
        console.error('Error generating full data:', error);
        showToast('error', 'Generation Failed', `AI failed to generate data: ${error.message}`);
        
        // Re-enable download button on error
        enableDownloadButton();
    } finally {
        hideLoading();
    }
}

// Helper function to disable download button
function disableDownloadButton() {
    const downloadBtn = document.querySelector('.btn-download.dropdown-toggle');
    if (downloadBtn) {
        downloadBtn.disabled = true;
        console.log('✅ Download button disabled');
    }
}

// Helper function to enable download button
function enableDownloadButton() {
    const downloadBtn = document.querySelector('.btn-download.dropdown-toggle');
    if (downloadBtn) {
        downloadBtn.disabled = false;
        // Add pulsating animation directly via style
        downloadBtn.style.animation = 'downloadPulse 2s ease-in-out infinite';
        console.log('✅ Download button enabled with pulsating animation');
    }
}


// ===============================
// Contact Admin Modal Functions
// ===============================

function openContactAdminModal() {
    // Close the generate full data modal if open
    closeGenerateFullDataModal();
    
    const modal = document.getElementById('contact-admin-modal');
    if (modal) {
        // Populate request details
        const topic = window.currentTopic || 'Not specified';
        const fieldCount = window.currentFieldCount || 'Not specified';
        
        document.getElementById('request-topic').textContent = topic;
        document.getElementById('request-fields').textContent = fieldCount + ' fields';
        
        // Reset form
        document.getElementById('contact-email').value = '';
        document.getElementById('contact-record-count').value = '';
        document.getElementById('contact-additional-notes').value = '';
        
        modal.style.display = 'flex';
    }
}

function closeContactAdminModal() {
    const modal = document.getElementById('contact-admin-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function submitDataRequest() {
    const email = document.getElementById('contact-email').value.trim();
    const recordCount = parseInt(document.getElementById('contact-record-count').value);
    const additionalNotes = document.getElementById('contact-additional-notes').value.trim();
    
    // Validation
    if (!email) {
        showToast('error', 'Email Required', 'Please enter your email address.');
        return;
    }
    
    if (!recordCount || recordCount < 1001) {
        showToast('error', 'Invalid Count', 'Please enter a number greater than 1,000.');
        return;
    }
    
    // Get schema from current data
    let schemaDetails = 'Not available';
    if (currentGeneratedData && currentGeneratedData.length > 0) {
        const fieldNames = Object.keys(currentGeneratedData[0]);
        schemaDetails = fieldNames.join(', ');
    }
    
    showLoading('Submitting request...');
    
    try {
        // Call N8N workflow to store the request
        const response = await fetch(`${CONFIG.n8nBaseUrl}/submit-data-request`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: email,
                topic: window.currentTopic || 'Not specified',
                fieldCount: window.currentFieldCount || 0,
                requestedRecordCount: recordCount,
                schemaDetails: schemaDetails,
                additionalNotes: additionalNotes,
                timestamp: new Date().toISOString()
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        closeContactAdminModal();
        showToast('success', 'Request Submitted!', 'Our team will contact you shortly via email.');
        
    } catch (error) {
        console.error('Error submitting data request:', error);
        showToast('error', 'Submission Failed', 'Please try again or contact us directly.');
    } finally {
        hideLoading();
    }
}

// ===============================
// Preview Tab Switching (AI Mode)
// ===============================

window.switchAIPreviewTab = function(tabName) {
    console.log('switchAIPreviewTab called:', tabName);
    
    const aiPreviewTabs = document.getElementById('preview-tabs-container');
    if (!aiPreviewTabs) {
        console.log('AI preview tabs not found');
        return;
    }
    
    // Update tab buttons
    aiPreviewTabs.querySelectorAll('.preview-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    aiPreviewTabs.querySelector(`.preview-tab[data-tab="${tabName}"]`)?.classList.add('active');
    
    // Update tab content  
    aiPreviewTabs.querySelectorAll('.preview-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Show/hide buttons based on active tab
    const refreshBtn = document.getElementById('refresh-preview-btn');
    const addFieldBtn = document.getElementById('add-field-btn');
    
    if (tabName === 'fields') {
        document.getElementById('fields-tab-content')?.classList.add('active');
        if (refreshBtn) refreshBtn.style.display = 'none';
        if (addFieldBtn) addFieldBtn.style.display = 'flex';
    } else if (tabName === 'table') {
        document.getElementById('table-tab-content')?.classList.add('active');
        if (refreshBtn) refreshBtn.style.display = 'flex';
        if (addFieldBtn) addFieldBtn.style.display = 'none';
        // Update table view with current data
        updateTableView();
    } else if (tabName === 'raw') {
        document.getElementById('raw-tab-content')?.classList.add('active');
        if (refreshBtn) refreshBtn.style.display = 'flex';
        if (addFieldBtn) addFieldBtn.style.display = 'none';
        // Update raw view with current data
        updateRawView();
    } else if (tabName === 'sql') {
        document.getElementById('sql-tab-content')?.classList.add('active');
        if (refreshBtn) refreshBtn.style.display = 'flex';
        if (addFieldBtn) addFieldBtn.style.display = 'none';
        // Update SQL view with current data
        updateSQLView();
    }
}

function updateTableView() {
    const tableContainer = document.getElementById('table-preview-data');
    if (!tableContainer) return;
    
    if (!currentGeneratedData || currentGeneratedData.length === 0) {
        tableContainer.innerHTML = '<p class="preview-placeholder">No data available to display</p>';
        return;
    }
    
    // Show top 10 records only
    const previewData = currentGeneratedData.slice(0, 10);
    const headers = Object.keys(previewData[0]);
    
    let tableHTML = '<table><thead><tr>';
    headers.forEach(header => {
        tableHTML += `<th>${escapeHtml(header)}</th>`;
    });
    tableHTML += '</tr></thead><tbody>';
    
    previewData.forEach(row => {
        tableHTML += '<tr>';
        headers.forEach(header => {
            tableHTML += `<td>${escapeHtml(String(row[header] || ''))}</td>`;
        });
        tableHTML += '</tr>';
    });
    
    tableHTML += '</tbody></table>';
    
    if (currentGeneratedData.length > 10) {
        tableHTML += `<p style="text-align: center; margin-top: 16px; color: var(--text-secondary); font-size: 14px;">Showing 10 of ${currentGeneratedData.length} records</p>`;
    }
    
    tableContainer.innerHTML = tableHTML;
}

function updateRawView() {
    const rawContainer = document.getElementById('raw-preview-data');
    if (!rawContainer) return;
    
    if (!currentGeneratedData || currentGeneratedData.length === 0) {
        rawContainer.innerHTML = '<p class="preview-placeholder">No data available to display</p>';
        return;
    }
    
    // Generate CSV format
    const headers = Object.keys(currentGeneratedData[0]);
    const csvHeader = headers.join(',');
    const csvRows = currentGeneratedData.map(row => {
        return headers.map(header => {
            const value = row[header];
            if (value === null || value === undefined) return '';
            const stringValue = String(value);
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
        }).join(',');
    }).join('\n');
    
    const csvContent = `${csvHeader}\n${csvRows}`;
    
    rawContainer.innerHTML = `
        <div class="raw-preview-container">
            <pre class="raw-preview-content">${escapeHtml(csvContent)}</pre>
        </div>
    `;
}

function updateSQLView() {
    const sqlContainer = document.getElementById('sql-preview-data');
    if (!sqlContainer) return;
    
    if (!currentGeneratedData || currentGeneratedData.length === 0) {
        sqlContainer.innerHTML = '<p class="preview-placeholder">No data available to display</p>';
        return;
    }
    
    // Get the current schema from the global state
    const schema = currentSchemaState || [];
    
    console.log('=== SQL VIEW DEBUG ===');
    console.log('Current schema state:', currentSchemaState);
    console.log('Schema length:', schema.length);
    console.log('Current generated data:', currentGeneratedData);
    
    if (!schema || schema.length === 0) {
        sqlContainer.innerHTML = `
            <div class="sql-error">
                <p>No schema available. Please generate data first.</p>
            </div>
        `;
        return;
    }
    
    if (!window.sqlGenerator) {
        sqlContainer.innerHTML = `
            <div class="sql-error">
                <p>SQL generator not loaded. Please refresh the page.</p>
            </div>
        `;
        return;
    }
    
    try {
        // Generate SQL using our SQL generator
        const sqlContent = window.sqlGenerator.generateSQL(schema, currentGeneratedData);
        
        sqlContainer.innerHTML = `
            <div class="sql-content">
                <div class="sql-header">
                    <h4>SQL Statements</h4>
                    <button class="copy-sql-btn" onclick="copySQLToClipboard()">
                        📋 Copy SQL
                    </button>
                </div>
                <div class="sql-code">
                    <pre><code id="sql-code-content">${escapeHtml(sqlContent)}</code></pre>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error generating SQL:', error);
        sqlContainer.innerHTML = `
            <div class="sql-error">
                <p>Error generating SQL: ${error.message}</p>
            </div>
        `;
    }
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

// ===============================
// Refresh Preview Function
// ===============================

async function refreshAIPreview() {
    try {
        // Show loading message
        const tableContainer = document.getElementById('table-preview-data');
        if (tableContainer) {
            tableContainer.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <div style="display: inline-block; width: 40px; height: 40px; border: 4px solid var(--border-color); border-top: 4px solid var(--accent-primary); border-radius: 50%; animation: spin 1s linear infinite;"></div>
                    <p style="margin-top: 16px; color: var(--text-secondary);">Refreshing your preview... please wait</p>
                </div>
            `;
        }
        
        // Get current schema from UI
        const currentSchema = getCurrentSchemaFromUI();
        if (!currentSchema || currentSchema.length === 0) {
            throw new Error('No schema found to refresh');
        }
        
        console.log('🔄 Refreshing preview with schema:', currentSchema);
        
        // Convert AI schema to Schema Builder format
        const schemaBuilderFormat = currentSchema.map(field => {
            const generatorType = mapAITypeToGeneratorType(field.type, field.customType);
            return {
                name: field.name,
                type: generatorType,
                blankPercent: field.blankPercent || 0
            };
        });
        
        console.log('📋 Schema converted to Schema Builder format:', schemaBuilderFormat);
        
        // Call N8N deterministic generator (use simple generator for schema-based generation)
        const response = await fetch(`${CONFIG.n8nBaseUrl}/${CONFIG.simpleGeneratorWebhook}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                schema: schemaBuilderFormat,
                recordCount: 10, // Generate 10 records for preview
                sessionId: `refresh_${Date.now()}`
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('🔍 N8N Response:', result);
        
        if (result.success && result.data) {
            // Update current generated data
            currentGeneratedData = result.data;
            
            // Update table view
            updateTableView();
            
            // Show success message
            showToast('success', 'Preview Refreshed', 'Your preview has been updated with the latest schema changes.');
        } else {
            throw new Error(result.error || 'Invalid response from server');
        }
        
    } catch (error) {
        console.error('Error refreshing preview:', error);
        showToast('error', 'Refresh Failed', `Failed to refresh preview: ${error.message}`);
        
        // Restore table view on error
        updateTableView();
    }
}

// ===============================
// Download Dropdown Functions
// ===============================

function toggleDownloadDropdown() {
    const dropdown = document.getElementById('csv-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
}

function closeAllDropdowns() {
    document.querySelectorAll('.dropdown-menu').forEach(menu => {
        menu.classList.remove('show');
    });
}

// Close dropdowns when clicking outside
document.addEventListener('click', function(event) {
    if (!event.target.closest('.dropdown')) {
        closeAllDropdowns();
    }
});
// Enhanced Schema Builder with Row Reordering and Advanced Field Types

// Enhanced field types with specific options
const fieldTypes = {
    'First Name': { type: 'firstName', category: 'Personal', icon: '👤' },
    'Last Name': { type: 'lastName', category: 'Personal', icon: '👤' },
    'Email Address': { type: 'email', category: 'Personal', icon: '📧' },
    'Phone Number': { type: 'phone', category: 'Personal', icon: '📱' },
    'Address': { type: 'address', category: 'Personal', icon: '🏠' },
    'Gender': { type: 'gender', category: 'Personal', icon: '🚻' },
    'Birthdate': { type: 'birthdate', category: 'Personal', icon: '🎂' },
    'Age': { type: 'age', category: 'Personal', icon: '🎂' },
    
    'Company': { type: 'company', category: 'Business', icon: '🏢' },
    'Job Title': { type: 'jobTitle', category: 'Business', icon: '💼' },
    'Department': { type: 'department', category: 'Business', icon: '🏛️' },
    'Industry': { type: 'industry', category: 'Business', icon: '🏭' },
    'Website': { type: 'website', category: 'Business', icon: '🌐' },
    
    'Credit Card': { type: 'creditCard', category: 'Financial', icon: '💳' },
    'Currency': { type: 'currency', category: 'Financial', icon: '💰' },
    'Amount': { type: 'amount', category: 'Financial', icon: '💵' },
    'IBAN': { type: 'iban', category: 'Financial', icon: '🏦' },
    'Account Number': { type: 'accountNumber', category: 'Financial', icon: '📊' },
    'Invoice Number': { type: 'invoiceNumber', category: 'Financial', icon: '📄' },
    'Tax ID': { type: 'taxId', category: 'Financial', icon: '🧾' },
    'Ledger Code': { type: 'ledgerCode', category: 'Financial', icon: '📒' },
    'Cost Center': { type: 'costCenter', category: 'Financial', icon: '🎯' },
    'Transaction ID': { type: 'transactionId', category: 'Financial', icon: '🔖' },
    'Transaction Amount': { type: 'transactionAmount', category: 'Financial', icon: '💸' },
    'Payment Status': { type: 'paymentStatus', category: 'Financial', icon: '✅' },
    
    'UUID': { type: 'uuid', category: 'Technical', icon: '🔑' },
    'IP Address v4': { type: 'ipAddress', category: 'Technical', icon: '🌐' },
    'IP Address v6': { type: 'ipv6', category: 'Technical', icon: '🌐' },
    'URL': { type: 'url', category: 'Technical', icon: '🔗' },
    'Username': { type: 'username', category: 'Technical', icon: '👨‍💻' },
    'Password': { type: 'password', category: 'Technical', icon: '🔒' },
    'MAC Address': { type: 'macAddress', category: 'Technical', icon: '📡' },
    'User Agent': { type: 'userAgent', category: 'Technical', icon: '💻' },
    
    'Date': { type: 'date', category: 'Date & Time', icon: '📅' },
    'DateTime': { type: 'datetime', category: 'Date & Time', icon: '🕐' },
    'Time': { type: 'time', category: 'Date & Time', icon: '⏰' },
    'Timestamp': { type: 'timestamp', category: 'Date & Time', icon: '⏱️' },
    'Future Date': { type: 'futureDate', category: 'Date & Time', icon: '🗓️' },
    'Past Date': { type: 'pastDate', category: 'Date & Time', icon: '📜' },
    
    'Integer': { type: 'integer', category: 'Numbers', icon: '🔢' },
    'Decimal': { type: 'decimal', category: 'Numbers', icon: '🔢' },
    'Percentage': { type: 'percentage', category: 'Numbers', icon: '📊' },
    'Row Number': { type: 'rowNumber', category: 'Numbers', icon: '🔢' },
    'Boolean': { type: 'boolean', category: 'Numbers', icon: '✅' },
    'Latitude': { type: 'latitude', category: 'Numbers', icon: '📍' },
    'Longitude': { type: 'longitude', category: 'Numbers', icon: '🗺️' },
    
    'Country': { type: 'country', category: 'Geographic', icon: '🌍' },
    'City': { type: 'city', category: 'Geographic', icon: '🏙️' },
    'State': { type: 'state', category: 'Geographic', icon: '🗺️' },
    'Zip Code': { type: 'zipCode', category: 'Geographic', icon: '✉️' },
    'Street Name': { type: 'streetName', category: 'Geographic', icon: '🛣️' },
    'Building Number': { type: 'buildingNumber', category: 'Geographic', icon: '🏢' }
};

class SchemaBuilder {
    constructor() {
        this.schema = [];
        this.draggedElement = null;
        this.draggedIndex = null;
        this.init();
    }

    init() {
        this.setupCategoryToggles();
        this.setupDragAndDrop();
        this.renderSchema();
    }

    setupCategoryToggles() {
        const categoryHeaders = document.querySelectorAll('.category-header');
        
        categoryHeaders.forEach(header => {
            header.addEventListener('click', () => {
                const parent = header.parentElement;
                const fieldsDiv = parent.querySelector('.category-fields');
                const toggleIcon = header.querySelector('.toggle-icon');
                const isExpanded = fieldsDiv.classList.contains('expanded');
                
                if (isExpanded) {
                    // Collapse
                    fieldsDiv.classList.remove('expanded');
                    toggleIcon.textContent = '▶';
                } else {
                    // Expand
                    fieldsDiv.classList.add('expanded');
                    toggleIcon.textContent = '▼';
                }
            });
        });
    }

    setupDragAndDrop() {
        const fieldTypes = document.querySelectorAll('.field-type');
        const dropZone = document.getElementById('schema-drop-zone');

        // Setup drag events for field types
        fieldTypes.forEach(field => {
            field.addEventListener('dragstart', (e) => {
                this.draggedElement = e.target;
                e.dataTransfer.effectAllowed = 'copy';
                e.dataTransfer.setData('text/html', e.target.innerHTML);
                e.target.style.opacity = '0.5';
            });

            field.addEventListener('dragend', (e) => {
                e.target.style.opacity = '1';
            });
        });

        // Setup drop zone events
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', (e) => {
            if (e.target === dropZone) {
                dropZone.classList.remove('drag-over');
            }
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');

            if (this.draggedElement && this.draggedElement.classList.contains('field-type')) {
                const fieldType = this.draggedElement.dataset.type;
                this.addFieldToSchema(fieldType);
            }
        });
    }

    setupSchemaDragAndDrop() {
        // This will be called after renderSchema to set up row reordering
    }

    addFieldToSchema(fieldType) {
        const fieldId = `field_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const field = {
            id: fieldId,
            name: this.generateFieldName(fieldType),
            type: fieldType,
            blankPercentage: 0
        };

        this.schema.push(field);
        this.renderSchema();
        this.setupSchemaDragAndDrop();
    }

    addCustomField() {
        const fieldId = `field_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const field = {
            id: fieldId,
            name: this.generateFieldName('custom'),
            type: 'custom',
            blankPercentage: 0
        };
        
        this.schema.push(field);
        this.renderSchema();
        this.setupSchemaDragAndDrop();
    }

    generateFieldName(fieldType) {
        const fieldTypeData = Object.values(fieldTypes).find(f => f.type === fieldType);
        const baseName = fieldTypeData ? fieldTypeData.type : fieldType;
        
        // Convert camelCase to snake_case
        const snakeCase = baseName.replace(/([A-Z])/g, '_$1').toLowerCase();
        
        // Check if name already exists
        const existingNames = this.schema.map(f => f.name);
        let counter = 1;
        let name = snakeCase;
        
        while (existingNames.includes(name)) {
            name = `${snakeCase}_${counter}`;
            counter++;
        }
        
        return name;
    }

    renderSchema() {
        const dropZone = document.getElementById('schema-drop-zone');
        
        if (this.schema.length === 0) {
            dropZone.innerHTML = `
                <div class="empty-state">
                    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                        <path d="M32 8L48 24H16L32 8Z" fill="var(--bg-tertiary)"/>
                        <rect x="16" y="24" width="32" height="32" fill="var(--bg-tertiary)"/>
                    </svg>
                    <p>Drag and drop fields here to build your schema</p>
                </div>
            `;
            return;
        }

        dropZone.innerHTML = this.schema.map((field, index) => this.renderSchemaField(field, index)).join('');
    }

    renderSchemaField(field, index) {
        const fieldTypeOptions = Object.entries(fieldTypes).map(([name, data]) => {
            const isSelected = data.type === field.type ? 'selected' : '';
            return `<option value="${data.type}" ${isSelected}>${name}</option>`;
        }).join('');

        return `
            <div class="schema-field" data-field-id="${field.id}" data-index="${index}">
                <div class="field-cell reorder-cell">
                    <div class="reorder-controls">
                        <button class="reorder-btn" onclick="schemaBuilder.moveFieldUp('${field.id}')" ${index === 0 ? 'disabled' : ''}>
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M8 4.5L4 8.5h8L8 4.5z"/>
                            </svg>
                        </button>
                        <button class="reorder-btn" onclick="schemaBuilder.moveFieldDown('${field.id}')">
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M8 11.5L4 7.5h8L8 11.5z"/>
                            </svg>
                        </button>
                    </div>
                </div>
                
                <div class="field-cell">
                    <input 
                        type="text" 
                        class="field-name-input" 
                        value="${field.name}"
                        onchange="schemaBuilder.updateFieldName('${field.id}', this.value)"
                    >
                </div>
                
                <div class="field-cell">
                    <select 
                        class="field-type-select"
                        onchange="schemaBuilder.updateFieldType('${field.id}', this.value)"
                    >
                        ${fieldTypeOptions}
                        <option value="custom" ${field.type === 'custom' ? 'selected' : ''}>Custom</option>
                    </select>
                </div>
                
                <div class="field-options">
                    <span>blank:</span>
                    <input 
                        type="number" 
                        class="blank-input" 
                        min="0" 
                        max="100" 
                        value="${field.blankPercentage || 0}"
                        oninput="schemaBuilder.updateBlankPercentage('${field.id}', this.value)"
                    >
                    <span>%</span>
                </div>
                
                <div class="field-actions">
                    <button class="btn-remove" onclick="schemaBuilder.removeField('${field.id}')">×</button>
                </div>
            </div>
        `;
    }

    updateFieldName(fieldId, newName) {
        const field = this.schema.find(f => f.id === fieldId);
        if (field) {
            field.name = newName;
        }
    }

    updateFieldType(fieldId, newType) {
        const field = this.schema.find(f => f.id === fieldId);
        if (field) {
            field.type = newType;
        }
    }

    updateBlankPercentage(fieldId, newPercentage) {
        const field = this.schema.find(f => f.id === fieldId);
        if (field) {
            const value = parseInt(newPercentage) || 0;
            field.blankPercentage = Math.max(0, Math.min(100, value));
            console.log(`Updated blank percentage for ${field.name}: ${field.blankPercentage}%`);
        }
    }

    removeField(fieldId) {
        this.schema = this.schema.filter(f => f.id !== fieldId);
        this.renderSchema();
    }

    moveFieldUp(fieldId) {
        const index = this.schema.findIndex(f => f.id === fieldId);
        if (index > 0) {
            // Swap with previous field
            const temp = this.schema[index];
            this.schema[index] = this.schema[index - 1];
            this.schema[index - 1] = temp;
            this.renderSchema();
            console.log(`Moved field ${fieldId} up to index ${index - 1}`);
        }
    }

    moveFieldDown(fieldId) {
        const index = this.schema.findIndex(f => f.id === fieldId);
        if (index < this.schema.length - 1) {
            // Swap with next field
            const temp = this.schema[index];
            this.schema[index] = this.schema[index + 1];
            this.schema[index + 1] = temp;
            this.renderSchema();
            console.log(`Moved field ${fieldId} down to index ${index + 1}`);
        }
    }

    clearSchema() {
        this.schema = [];
        this.renderSchema();
    }

    getSchema() {
        return this.schema;
    }

    validateSchema() {
        if (this.schema.length === 0) {
            return { valid: false, message: 'Please add at least one field to your schema' };
        }

        // Check for duplicate field names
        const names = this.schema.map(f => f.name);
        const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
        
        if (duplicates.length > 0) {
            return { valid: false, message: `Duplicate field names found: ${duplicates.join(', ')}` };
        }

        // Check for empty field names
        const emptyNames = this.schema.filter(f => !f.name || f.name.trim() === '');
        if (emptyNames.length > 0) {
            return { valid: false, message: 'All fields must have a name' };
        }

        return { valid: true };
    }

}

// Initialize schema builder
const schemaBuilder = new SchemaBuilder();

// Global functions for HTML
function clearSchema() {
    if (confirm('Are you sure you want to clear all fields?')) {
        schemaBuilder.clearSchema();
    }
}
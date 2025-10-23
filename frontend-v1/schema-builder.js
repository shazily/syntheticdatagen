// Schema Builder - Drag and Drop Functionality

class SchemaBuilder {
    constructor() {
        this.schema = [];
        this.draggedElement = null;
        this.init();
    }

    init() {
        this.setupDragAndDrop();
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

    addFieldToSchema(fieldType) {
        const fieldId = `field_${Date.now()}`;
        const field = {
            id: fieldId,
            name: this.generateFieldName(fieldType),
            type: fieldType
        };

        this.schema.push(field);
        this.renderSchema();
    }

    generateFieldName(fieldType) {
        // Convert camelCase to snake_case
        const baseName = fieldType.replace(/([A-Z])/g, '_$1').toLowerCase();
        
        // Check if name already exists
        const existingNames = this.schema.map(f => f.name);
        let counter = 1;
        let name = baseName;
        
        while (existingNames.includes(name)) {
            name = `${baseName}_${counter}`;
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
                        <path d="M32 8L48 24H16L32 8Z" fill="#E5E7EB"/>
                        <rect x="16" y="24" width="32" height="32" fill="#E5E7EB"/>
                    </svg>
                    <p>Drag and drop fields here to build your schema</p>
                </div>
            `;
            return;
        }

        dropZone.innerHTML = this.schema.map(field => `
            <div class="schema-field" data-field-id="${field.id}">
                <div class="field-info">
                    <span class="field-icon">${this.getFieldIcon(field.type)}</span>
                    <input 
                        type="text" 
                        class="field-name-input" 
                        value="${field.name}"
                        onchange="schemaBuilder.updateFieldName('${field.id}', this.value)"
                    >
                    <span class="field-type-badge">${this.formatFieldType(field.type)}</span>
                </div>
                <button class="btn-remove" onclick="schemaBuilder.removeField('${field.id}')">
                    ✕ Remove
                </button>
            </div>
        `).join('');
    }

    getFieldIcon(fieldType) {
        const iconMap = {
            firstName: '👤', lastName: '👤', email: '📧', phone: '📱', address: '🏠',
            company: '🏢', jobTitle: '💼', department: '🏛️',
            creditCard: '💳', currency: '💰', amount: '💵', iban: '🏦',
            uuid: '🔑', ipAddress: '🌐', url: '🔗', username: '👨‍💻',
            date: '📅', datetime: '🕐', birthdate: '🎂',
            integer: '🔢', decimal: '🔢', percentage: '📊'
        };
        return iconMap[fieldType] || '📝';
    }

    formatFieldType(fieldType) {
        return fieldType.replace(/([A-Z])/g, ' $1').trim();
    }

    updateFieldName(fieldId, newName) {
        const field = this.schema.find(f => f.id === fieldId);
        if (field) {
            field.name = newName;
        }
    }

    removeField(fieldId) {
        this.schema = this.schema.filter(f => f.id !== fieldId);
        this.renderSchema();
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


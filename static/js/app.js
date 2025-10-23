// Synthetic Data Generator - Frontend JavaScript

class SyntheticDataGenerator {
    constructor() {
        this.currentStep = 1;
        this.currentSchema = [];
        this.currentUserRequest = '';
        this.fieldTypes = [];
        
        this.init();
    }

    async init() {
        await this.loadFieldTypes();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Format change handler
        document.getElementById('format').addEventListener('change', (e) => {
            const format = e.target.value;
            if (format === 'python') {
                this.showNotification('Python code will include database connection and insertion logic', 'info');
            }
        });

        // Number of rows validation
        document.getElementById('numRows').addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            if (value > 10000) {
                e.target.value = 10000;
                this.showNotification('Maximum 10,000 records allowed', 'warning');
            }
        });
    }

    async loadFieldTypes() {
        try {
            const response = await fetch('/api/field-types');
            this.fieldTypes = await response.json();
            this.renderFieldTypes();
        } catch (error) {
            console.error('Error loading field types:', error);
        }
    }

    renderFieldTypes() {
        const container = document.getElementById('fieldTypes');
        container.innerHTML = '';

        this.fieldTypes.forEach(fieldType => {
            const fieldElement = document.createElement('div');
            fieldElement.className = 'col-md-3 col-sm-6 mb-3';
            fieldElement.innerHTML = `
                <div class="field-type" onclick="selectFieldType('${fieldType.type}')">
                    <h6 class="mb-1">${this.formatFieldName(fieldType.type)}</h6>
                    <small class="text-muted">${fieldType.description}</small>
                    <div class="mt-2">
                        <small class="badge bg-light text-dark">${fieldType.example}</small>
                    </div>
                </div>
            `;
            container.appendChild(fieldElement);
        });
    }

    formatFieldName(name) {
        return name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    selectFieldType(type) {
        this.showNotification(`Selected field type: ${this.formatFieldName(type)}`, 'info');
    }

    async generateSchema() {
        const userRequest = document.getElementById('userRequest').value.trim();
        
        if (!userRequest) {
            this.showNotification('Please describe what kind of data you need', 'warning');
            return;
        }

        this.currentUserRequest = userRequest;
        this.showLoadingModal('Generating schema with AI...');

        try {
            const response = await fetch('/api/generate-schema', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ request: userRequest })
            });

            const result = await response.json();
            
            if (response.ok) {
                this.currentSchema = result.schema;
                this.renderSchemaPreview();
                this.goToStep(2);
                this.showNotification('Schema generated successfully!', 'success');
            } else {
                throw new Error(result.error || 'Failed to generate schema');
            }
        } catch (error) {
            console.error('Error generating schema:', error);
            this.showNotification('Error generating schema: ' + error.message, 'danger');
        } finally {
            this.hideLoadingModal();
        }
    }

    renderSchemaPreview() {
        const container = document.getElementById('schemaPreview');
        container.innerHTML = `
            <div class="mb-3">
                <h5>Generated Schema Preview</h5>
                <p class="text-muted">Based on: "${this.currentUserRequest}"</p>
            </div>
        `;

        this.currentSchema.forEach((field, index) => {
            const fieldElement = document.createElement('div');
            fieldElement.className = 'schema-field fade-in';
            fieldElement.style.animationDelay = `${index * 0.1}s`;
            fieldElement.innerHTML = `
                <div class="row align-items-center">
                    <div class="col-md-4">
                        <strong>${field.name}</strong>
                    </div>
                    <div class="col-md-3">
                        <span class="badge bg-primary">${this.formatFieldName(field.type)}</span>
                    </div>
                    <div class="col-md-5">
                        <small class="text-muted">${field.description}</small>
                    </div>
                </div>
            `;
            container.appendChild(fieldElement);
        });

        // Add save schema option
        const saveSection = document.createElement('div');
        saveSection.className = 'mt-3 p-3 bg-light rounded';
        saveSection.innerHTML = `
            <div class="row align-items-center">
                <div class="col-md-8">
                    <label for="schemaName" class="form-label">Save this schema for future use:</label>
                    <input type="text" class="form-control" id="schemaName" placeholder="Enter schema name">
                </div>
                <div class="col-md-4">
                    <button class="btn btn-outline-primary w-100" onclick="saveSchema()">
                        <i class="fas fa-save me-1"></i>Save Schema
                    </button>
                </div>
            </div>
        `;
        container.appendChild(saveSection);
    }

    async saveSchema() {
        const name = document.getElementById('schemaName').value.trim();
        
        if (!name) {
            this.showNotification('Please enter a schema name', 'warning');
            return;
        }

        try {
            const response = await fetch('/api/save-schema', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: name,
                    schema: this.currentSchema,
                    user_request: this.currentUserRequest
                })
            });

            const result = await response.json();
            
            if (response.ok) {
                this.showNotification('Schema saved successfully!', 'success');
                document.getElementById('schemaName').value = '';
                this.loadSchemas(); // Refresh saved schemas
            } else {
                throw new Error(result.error || 'Failed to save schema');
            }
        } catch (error) {
            console.error('Error saving schema:', error);
            this.showNotification('Error saving schema: ' + error.message, 'danger');
        }
    }

    async generateData() {
        const numRows = parseInt(document.getElementById('numRows').value);
        const format = document.getElementById('format').value;

        this.showLoadingModal('Generating data...');

        try {
            const response = await fetch('/api/generate-data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    schema: this.currentSchema,
                    num_rows: numRows,
                    format: format
                })
            });

            const result = await response.json();
            
            if (response.ok) {
                this.downloadData(result.data, result.filename, format);
                this.showNotification(`Generated ${numRows} records successfully!`, 'success');
            } else {
                throw new Error(result.error || 'Failed to generate data');
            }
        } catch (error) {
            console.error('Error generating data:', error);
            this.showNotification('Error generating data: ' + error.message, 'danger');
        } finally {
            this.hideLoadingModal();
        }
    }

    downloadData(data, filename, format) {
        let blob;
        let mimeType;

        if (format === 'csv') {
            blob = new Blob([data], { type: 'text/csv' });
            mimeType = 'text/csv';
        } else if (format === 'json') {
            blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            mimeType = 'application/json';
        } else if (format === 'python') {
            blob = new Blob([data], { type: 'text/python' });
            mimeType = 'text/python';
        }

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }

    async loadSchemas() {
        try {
            const response = await fetch('/api/schemas');
            const schemas = await response.json();
            this.renderSavedSchemas(schemas);
        } catch (error) {
            console.error('Error loading schemas:', error);
            this.showNotification('Error loading saved schemas', 'danger');
        }
    }

    renderSavedSchemas(schemas) {
        const container = document.getElementById('savedSchemas');
        
        if (schemas.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="fas fa-inbox fa-3x mb-3"></i>
                    <p>No saved schemas yet. Create your first schema above!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';

        schemas.forEach((schema, index) => {
            const schemaElement = document.createElement('div');
            schemaElement.className = 'saved-schema fade-in';
            schemaElement.style.animationDelay = `${index * 0.1}s`;
            schemaElement.innerHTML = `
                <div class="row align-items-center">
                    <div class="col-md-6">
                        <h5 class="mb-1">${schema.name}</h5>
                        <p class="text-muted mb-1">${schema.user_request}</p>
                        <small class="text-muted">
                            <i class="fas fa-calendar me-1"></i>
                            Created: ${new Date(schema.created_at).toLocaleDateString()}
                        </small>
                    </div>
                    <div class="col-md-3">
                        <span class="badge bg-info">${schema.schema_data.length} fields</span>
                    </div>
                    <div class="col-md-3">
                        <button class="btn btn-sm btn-primary me-2" onclick="loadSchema(${schema.id})">
                            <i class="fas fa-upload me-1"></i>Load
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteSchema(${schema.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
            container.appendChild(schemaElement);
        });
    }

    loadSchema(schemaId) {
        // Find schema by ID and load it
        fetch('/api/schemas')
            .then(response => response.json())
            .then(schemas => {
                const schema = schemas.find(s => s.id === schemaId);
                if (schema) {
                    this.currentSchema = schema.schema_data;
                    this.currentUserRequest = schema.user_request;
                    this.renderSchemaPreview();
                    this.goToStep(2);
                    this.showNotification('Schema loaded successfully!', 'success');
                }
            })
            .catch(error => {
                console.error('Error loading schema:', error);
                this.showNotification('Error loading schema', 'danger');
            });
    }

    deleteSchema(schemaId) {
        if (confirm('Are you sure you want to delete this schema?')) {
            // Note: You would need to implement a delete endpoint in the backend
            this.showNotification('Delete functionality not implemented yet', 'warning');
        }
    }

    goToStep(stepNumber) {
        // Hide all steps
        document.querySelectorAll('.step').forEach(step => {
            step.classList.add('d-none');
        });

        // Show target step
        document.getElementById(`step${stepNumber}`).classList.remove('d-none');
        this.currentStep = stepNumber;

        // Update navigation
        this.updateNavigation();
    }

    updateNavigation() {
        const prevButtons = document.querySelectorAll('.btn-outline-secondary');
        prevButtons.forEach(btn => {
            if (this.currentStep === 1) {
                btn.disabled = true;
            } else {
                btn.disabled = false;
            }
        });
    }

    showLoadingModal(text = 'Processing...') {
        document.getElementById('loadingText').textContent = text;
        const modal = new bootstrap.Modal(document.getElementById('loadingModal'));
        modal.show();
    }

    hideLoadingModal() {
        const modal = bootstrap.Modal.getInstance(document.getElementById('loadingModal'));
        if (modal) {
            modal.hide();
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        notification.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        document.body.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }
}

// Global functions for HTML onclick handlers
function generateSchema() {
    window.app.generateSchema();
}

function saveSchema() {
    window.app.saveSchema();
}

function generateData() {
    window.app.generateData();
}

function loadSchemas() {
    window.app.loadSchemas();
}

function loadSchema(schemaId) {
    window.app.loadSchema(schemaId);
}

function deleteSchema(schemaId) {
    window.app.deleteSchema(schemaId);
}

function goToStep(stepNumber) {
    window.app.goToStep(stepNumber);
}

function selectFieldType(type) {
    window.app.selectFieldType(type);
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.app = new SyntheticDataGenerator();
    
    // Load saved schemas on page load
    window.app.loadSchemas();
    
    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
});

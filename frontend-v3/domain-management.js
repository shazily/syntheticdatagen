// ========================================
// DOMAIN MANAGEMENT FUNCTIONS
// ========================================

// Load and display domains organized by business area
async function loadDomains() {
    try {
        const response = await fetch('http://localhost:6333/collections/successful_schemas/points/scroll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ limit: 1000, with_payload: true })
        });
        
        const data = await response.json();
        const domains = organizeDomainsByCategory(data.result.points);
        
        displayDomains(domains);
        await loadVectorStats();
    } catch (error) {
        console.error('Error loading domains:', error);
        document.getElementById('domains-container').innerHTML = '<p class="error-message">Error loading domains</p>';
    }
}

// Organize vectors into business domains
function organizeDomainsByCategory(points) {
    const domains = {};
    
    points.forEach(point => {
        if (!point.payload.user_prompt || !point.payload.schema) return;
        
        const prompt = point.payload.user_prompt.toLowerCase();
        let category = 'Other';
        
        // Categorize by keywords
        if (prompt.includes('payment') || prompt.includes('transaction') || prompt.includes('financial') || prompt.includes('bank')) {
            category = 'Payments & Finance';
        } else if (prompt.includes('customer') || prompt.includes('user') || prompt.includes('client')) {
            category = 'Customer Data';
        } else if (prompt.includes('product') || prompt.includes('inventory') || prompt.includes('catalog')) {
            category = 'Product & Inventory';
        } else if (prompt.includes('employee') || prompt.includes('staff') || prompt.includes('hr')) {
            category = 'Human Resources';
        } else if (prompt.includes('order') || prompt.includes('ecommerce') || prompt.includes('shipping')) {
            category = 'E-commerce & Orders';
        } else if (prompt.includes('support') || prompt.includes('ticket') || prompt.includes('help')) {
            category = 'Customer Support';
        } else if (prompt.includes('marketing') || prompt.includes('campaign') || prompt.includes('promotion')) {
            category = 'Marketing & Sales';
        } else if (prompt.includes('logistics') || prompt.includes('shipping') || prompt.includes('delivery')) {
            category = 'Logistics & Shipping';
        }
        
        if (!domains[category]) {
            domains[category] = [];
        }
        
        domains[category].push({
            id: point.id,
            prompt: point.payload.user_prompt,
            schema: point.payload.schema,
            rating: point.payload.rating || 'unknown'
        });
    });
    
    return domains;
}

// Display domains in organized cards
function displayDomains(domains) {
    const container = document.getElementById('domains-container');
    
    if (Object.keys(domains).length === 0) {
        container.innerHTML = '<p class="loading-text">No domains found. Add your first domain to get started!</p>';
        return;
    }
    
    let html = '';
    
    Object.entries(domains).forEach(([category, domainList]) => {
        html += `
            <div class="domain-category">
                <h4 class="category-title">${category}</h4>
                <div class="category-domains">
        `;
        
        domainList.forEach(domain => {
            const fieldCount = Array.isArray(domain.schema) ? domain.schema.length : 0;
            html += `
                <div class="domain-card">
                    <div class="domain-header">
                        <h5 class="domain-name">${domain.prompt}</h5>
                        <div class="domain-stats">
                            <span>${fieldCount} fields</span>
                            <span>${domain.rating === 'thumbs_up' ? '👍' : '👎'}</span>
                        </div>
                    </div>
                    <div class="domain-fields">
                        ${Array.isArray(domain.schema) ? domain.schema.map(field => `
                            <div class="field-item">
                                <div class="field-name">${field.name}</div>
                                <div class="field-type">${field.type}</div>
                            </div>
                        `).join('') : '<div class="field-item">No fields</div>'}
                    </div>
                </div>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Modal Functions
function openUpdateModal() {
    document.getElementById('update-modal').style.display = 'flex';
    loadDomainOptions();
}

function closeUpdateModal() {
    document.getElementById('update-modal').style.display = 'none';
    document.getElementById('update-result').innerHTML = '';
}

function openAddModal() {
    document.getElementById('add-modal').style.display = 'flex';
    // Reset form
    document.getElementById('new-domain-name').value = '';
    document.getElementById('manual-fields').value = '';
    document.getElementById('ai-topic').value = '';
    document.getElementById('ai-preview').innerHTML = '';
    document.getElementById('add-result').innerHTML = '';
}

function closeAddModal() {
    document.getElementById('add-modal').style.display = 'none';
}

function toggleCreationMethod() {
    const method = document.querySelector('input[name="creation-method"]:checked').value;
    const manualEntry = document.getElementById('manual-entry');
    const aiEntry = document.getElementById('ai-entry');
    
    if (method === 'manual') {
        manualEntry.style.display = 'block';
        aiEntry.style.display = 'none';
    } else {
        manualEntry.style.display = 'none';
        aiEntry.style.display = 'block';
    }
}

// Load domain options for update modal
async function loadDomainOptions() {
    try {
        const response = await fetch('http://localhost:6333/collections/successful_schemas/points/scroll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ limit: 1000, with_payload: true })
        });
        
        const data = await response.json();
        const select = document.getElementById('domain-select');
        
        // Clear existing options
        select.innerHTML = '<option value="">Choose a domain...</option>';
        
        // Add unique domains
        const domains = new Set();
        data.result.points.forEach(point => {
            if (point.payload.user_prompt) {
                domains.add(point.payload.user_prompt);
            }
        });
        
        domains.forEach(domain => {
            const option = document.createElement('option');
            option.value = domain;
            option.textContent = domain;
            select.appendChild(option);
        });
        
        // Add change listener
        select.addEventListener('change', loadDomainFields);
        
    } catch (error) {
        console.error('Error loading domain options:', error);
    }
}

// Load fields for selected domain
async function loadDomainFields() {
    const selectedDomain = document.getElementById('domain-select').value;
    if (!selectedDomain) return;
    
    try {
        const response = await fetch('http://localhost:6333/collections/successful_schemas/points/scroll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                limit: 1000, 
                with_payload: true,
                filter: {
                    must: [
                        {
                            key: "user_prompt",
                            match: {
                                value: selectedDomain
                            }
                        }
                    ]
                }
            })
        });
        
        const data = await response.json();
        const currentFields = document.getElementById('current-fields');
        
        if (data.result.points.length > 0) {
            const schema = data.result.points[0].payload.schema;
            if (Array.isArray(schema)) {
                currentFields.innerHTML = schema.map(field => `
                    <div class="field-item">
                        <div class="field-name">${field.name}</div>
                        <div class="field-type">${field.type}</div>
                    </div>
                `).join('');
            } else {
                currentFields.innerHTML = '<p>No fields found</p>';
            }
        } else {
            currentFields.innerHTML = '<p>No fields found</p>';
        }
        
    } catch (error) {
        console.error('Error loading domain fields:', error);
        document.getElementById('current-fields').innerHTML = '<p>Error loading fields</p>';
    }
}

// Update existing domain
async function updateDomain() {
    const selectedDomain = document.getElementById('domain-select').value;
    const newFieldsText = document.getElementById('new-fields').value.trim();
    const resultDiv = document.getElementById('update-result');
    
    if (!selectedDomain) {
        resultDiv.innerHTML = '<div class="result-message error">Please select a domain</div>';
        return;
    }
    
    if (!newFieldsText) {
        resultDiv.innerHTML = '<div class="result-message error">Please provide new fields</div>';
        return;
    }
    
    try {
        // Parse new fields
        const newFields = JSON.parse(newFieldsText);
        if (!Array.isArray(newFields)) {
            throw new Error('Fields must be an array');
        }
        
        // Get existing schema
        const response = await fetch('http://localhost:6333/collections/successful_schemas/points/scroll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                limit: 1, 
                with_payload: true,
                filter: {
                    must: [
                        {
                            key: "user_prompt",
                            match: {
                                value: selectedDomain
                            }
                        }
                    ]
                }
            })
        });
        
        const data = await response.json();
        if (data.result.points.length === 0) {
            throw new Error('Domain not found');
        }
        
        const existingSchema = data.result.points[0].payload.schema || [];
        const updatedSchema = [...existingSchema, ...newFields];
        
        // Update via n8n workflow
        const updateResponse = await fetch(`${ADMIN_CONFIG.n8nBaseUrl}/update-domain`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                domain: selectedDomain,
                newFields: newFields,
                updatedSchema: updatedSchema
            })
        });
        
        if (updateResponse.ok) {
            resultDiv.innerHTML = '<div class="result-message success">✅ Domain updated successfully!</div>';
            setTimeout(() => {
                closeUpdateModal();
                loadDomains();
            }, 1500);
        } else {
            throw new Error('Failed to update domain');
        }
        
    } catch (error) {
        console.error('Error updating domain:', error);
        resultDiv.innerHTML = `<div class="result-message error">❌ Error: ${error.message}</div>`;
    }
}

// Generate AI schema
async function generateAISchema() {
    const topic = document.getElementById('ai-topic').value.trim();
    const fieldCount = document.getElementById('field-count').value;
    const previewDiv = document.getElementById('ai-preview');
    
    if (!topic) {
        previewDiv.innerHTML = '<div class="result-message error">Please enter a topic</div>';
        return;
    }
    
    try {
        previewDiv.innerHTML = '<div class="loading">🤖 Generating schema with AI...</div>';
        
        const response = await fetch(`${ADMIN_CONFIG.n8nBaseUrl}/generate-single-schema`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                topic: topic,
                fieldCount: parseInt(fieldCount)
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to generate schema');
        }
        
        const result = await response.json();
        
        if (result.success && result.schema) {
            previewDiv.innerHTML = `
                <div class="result-message success">✅ AI Generated Schema:</div>
                <pre class="ai-preview-content">${JSON.stringify(result.schema, null, 2)}</pre>
            `;
        } else {
            throw new Error('Invalid response from AI');
        }
        
    } catch (error) {
        console.error('Error generating AI schema:', error);
        previewDiv.innerHTML = `<div class="result-message error">❌ Error: ${error.message}</div>`;
    }
}

// Add new domain
async function addDomain() {
    const domainName = document.getElementById('new-domain-name').value.trim();
    const method = document.querySelector('input[name="creation-method"]:checked').value;
    const resultDiv = document.getElementById('add-result');
    
    if (!domainName) {
        resultDiv.innerHTML = '<div class="result-message error">Please enter a domain name</div>';
        return;
    }
    
    try {
        let schema = [];
        
        if (method === 'manual') {
            const manualFields = document.getElementById('manual-fields').value.trim();
            if (!manualFields) {
                resultDiv.innerHTML = '<div class="result-message error">Please provide fields</div>';
                return;
            }
            schema = JSON.parse(manualFields);
        } else {
            const aiTopic = document.getElementById('ai-topic').value.trim();
            if (!aiTopic) {
                resultDiv.innerHTML = '<div class="result-message error">Please enter a topic for AI generation</div>';
                return;
            }
            
            // Use the AI-generated schema from preview
            const previewContent = document.querySelector('.ai-preview-content');
            if (!previewContent) {
                resultDiv.innerHTML = '<div class="result-message error">Please generate AI schema first</div>';
                return;
            }
            schema = JSON.parse(previewContent.textContent);
        }
        
        if (!Array.isArray(schema)) {
            throw new Error('Schema must be an array');
        }
        
        // Add via n8n workflow
        const response = await fetch(`${ADMIN_CONFIG.n8nBaseUrl}/add-domain`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                domain: domainName,
                schema: schema
            })
        });
        
        if (response.ok) {
            resultDiv.innerHTML = '<div class="result-message success">✅ Domain added successfully!</div>';
            setTimeout(() => {
                closeAddModal();
                loadDomains();
            }, 1500);
        } else {
            throw new Error('Failed to add domain');
        }
        
    } catch (error) {
        console.error('Error adding domain:', error);
        resultDiv.innerHTML = `<div class="result-message error">❌ Error: ${error.message}</div>`;
    }
}

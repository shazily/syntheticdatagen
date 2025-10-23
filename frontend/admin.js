// Admin Analytics Dashboard JavaScript
// For internal monitoring of feedback, chat logs, and AI performance

// Configuration
const ADMIN_CONFIG = {
    n8nBaseUrl: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:5678/webhook' 
        : 'https://n8n.gptlab.ae/webhook',
    refreshInterval: 30000 // Auto-refresh every 30 seconds
};

// Global data storage
let feedbackData = [];
let chatLogsData = [];
let metricsData = {};

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    loadAllData();
    initVectorDBTab();
    
    // Auto-refresh data
    setInterval(loadAllData, ADMIN_CONFIG.refreshInterval);
});

// Tab Switching
function switchAdminTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Update tab panels
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    document.getElementById(`tab-${tabName}`).classList.add('active');
    
    // Load data for specific tabs
    if (tabName === 'vectordb') {
        loadVectorStats();
    }
}

// Load all data from n8n webhooks
async function loadAllData() {
    await Promise.all([
        loadMetrics(),
        loadFeedback(),
        loadChatLogs()
    ]);
}

// Load metrics
async function loadMetrics() {
    try {
        const response = await fetch(`${ADMIN_CONFIG.n8nBaseUrl}/admin/metrics`);
        if (!response.ok) throw new Error('Failed to load metrics');
        
        const data = await response.json();
        // Metrics returns a single object, not an array
        metricsData = data || {};
        
        // Convert string values to numbers
        const totalChats = parseInt(metricsData.total_chats) || 0;
        const successfulChats = parseInt(metricsData.successful_chats) || 0;
        const thumbsUp = parseInt(metricsData.thumbs_up_count) || 0;
        const avgFeedbackRating = parseFloat(metricsData.avg_feedback_rating) || 0;
        
        // Update metric cards
        document.getElementById('metric-total-chats').textContent = totalChats;
        
        const successRate = totalChats > 0 
            ? ((successfulChats / totalChats) * 100).toFixed(1) + '%'
            : '0%';
        document.getElementById('metric-success-rate').textContent = successRate;
        
        document.getElementById('metric-thumbs-up').textContent = thumbsUp;
        
        const avgRating = avgFeedbackRating > 0 
            ? avgFeedbackRating.toFixed(1)
            : 'N/A';
        document.getElementById('metric-avg-rating').textContent = avgRating;
        
        // Update charts
        updateCharts();
        
    } catch (error) {
        console.error('Error loading metrics:', error);
    }
}

// Load feedback data
async function loadFeedback() {
    try {
        const response = await fetch(`${ADMIN_CONFIG.n8nBaseUrl}/admin/feedback`);
        if (!response.ok) throw new Error('Failed to load feedback');
        
        const data = await response.json();
        // n8n can return single object or array - handle both
        feedbackData = Array.isArray(data) ? data : (data ? [data] : []);
        console.log('Feedback data loaded:', feedbackData.length, 'records');
        renderFeedbackTable();
        
    } catch (error) {
        console.error('Error loading feedback:', error);
        document.getElementById('feedback-tbody').innerHTML = 
            '<tr><td colspan="5" class="error-cell">Error loading feedback data</td></tr>';
    }
}

// Load chat logs data
async function loadChatLogs() {
    try {
        const response = await fetch(`${ADMIN_CONFIG.n8nBaseUrl}/admin/chatlogs`);
        if (!response.ok) throw new Error('Failed to load chat logs');
        
        const data = await response.json();
        // n8n can return single object or array - handle both
        chatLogsData = Array.isArray(data) ? data : (data ? [data] : []);
        console.log('Chat logs loaded:', chatLogsData.length, 'records');
        renderChatLogsTable();
        
    } catch (error) {
        console.error('Error loading chat logs:', error);
        document.getElementById('chatlogs-tbody').innerHTML = 
            '<tr><td colspan="7" class="error-cell">Error loading chat logs data</td></tr>';
    }
}

// Render feedback table
function renderFeedbackTable() {
    const tbody = document.getElementById('feedback-tbody');
    
    if (!feedbackData || feedbackData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">No feedback data available</td></tr>';
        return;
    }
    
    tbody.innerHTML = feedbackData.map(row => `
        <tr>
            <td>${formatDate(row.timestamp)}</td>
            <td><span class="rating-badge">${'⭐'.repeat(row.rating || 0)}</span></td>
            <td class="comment-cell">${escapeHtml(row.comment || '-')}</td>
            <td>${escapeHtml(row.email || '-')}</td>
            <td><span class="badge ${row.want_updates ? 'badge-yes' : 'badge-no'}">${row.want_updates ? 'Yes' : 'No'}</span></td>
        </tr>
    `).join('');
}

// Render chat logs table
function renderChatLogsTable() {
    const tbody = document.getElementById('chatlogs-tbody');
    
    if (!chatLogsData || chatLogsData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">No chat logs available</td></tr>';
        return;
    }
    
    tbody.innerHTML = chatLogsData.map(row => {
        // Handle schema - it could be string, object, or array
        let schema = [];
        try {
            if (typeof row.generated_schema === 'string') {
                schema = JSON.parse(row.generated_schema);
            } else if (Array.isArray(row.generated_schema)) {
                schema = row.generated_schema;
            } else if (row.generated_schema && typeof row.generated_schema === 'object') {
                schema = row.generated_schema;
            }
        } catch (e) {
            console.error('Error parsing schema:', e);
            schema = [];
        }
        const fieldCount = Array.isArray(schema) ? schema.length : 0;
        
        return `
            <tr onclick="showChatDetails(${row.id})">
                <td>${formatDate(row.timestamp)}</td>
                <td class="prompt-cell">${escapeHtml(truncate(row.user_prompt, 80))}</td>
                <td class="message-cell">${escapeHtml(truncate(row.ai_message, 60))}</td>
                <td>${fieldCount}</td>
                <td>${row.record_count || 0}</td>
                <td>${getRatingBadge(row.rating)}</td>
                <td><span class="badge ${row.success ? 'badge-success' : 'badge-error'}">${row.success ? 'Success' : 'Error'}</span></td>
            </tr>
        `;
    }).join('');
}

// Store chart instances to destroy before recreating
let ratingChart = null;
let successChart = null;

// Update charts
function updateCharts() {
    // Destroy existing charts
    if (ratingChart) {
        ratingChart.destroy();
        ratingChart = null;
    }
    if (successChart) {
        successChart.destroy();
        successChart = null;
    }
    
    // Convert metrics to numbers
    const totalChats = parseInt(metricsData.total_chats) || 0;
    const successfulChats = parseInt(metricsData.successful_chats) || 0;
    const thumbsUp = parseInt(metricsData.thumbs_up_count) || 0;
    const thumbsDown = parseInt(metricsData.thumbs_down_count) || 0;
    
    // Rating Distribution Chart
    const ratingCtx = document.getElementById('rating-chart');
    if (ratingCtx) {
        ratingChart = new Chart(ratingCtx, {
            type: 'doughnut',
            data: {
                labels: ['Thumbs Up', 'Thumbs Down', 'No Rating'],
                datasets: [{
                    data: [
                        thumbsUp,
                        thumbsDown,
                        totalChats - thumbsUp - thumbsDown
                    ],
                    backgroundColor: ['#10b981', '#ef4444', '#6b7280']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        labels: { color: '#f8fafc' }
                    }
                }
            }
        });
    }
    
    // Success vs. Error Chart
    const successCtx = document.getElementById('success-chart');
    if (successCtx) {
        successChart = new Chart(successCtx, {
            type: 'pie',
            data: {
                labels: ['Successful', 'Failed'],
                datasets: [{
                    data: [
                        successfulChats,
                        totalChats - successfulChats
                    ],
                    backgroundColor: ['#10b981', '#ef4444']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        labels: { color: '#f8fafc' }
                    }
                }
            }
        });
    }
}

// Show chat details in a modal/expanded view
function showChatDetails(chatId) {
    const chat = chatLogsData.find(c => c.id === chatId);
    if (!chat) return;
    
    // Parse schema - handle string or object
    let schema = [];
    try {
        if (typeof chat.generated_schema === 'string') {
            schema = JSON.parse(chat.generated_schema);
        } else if (chat.generated_schema) {
            schema = chat.generated_schema;
        }
    } catch (e) {
        console.error('Error parsing schema in details:', e);
    }
    
    // Parse data sample - handle string or object
    let dataSample = [];
    try {
        if (typeof chat.generated_data_sample === 'string') {
            dataSample = JSON.parse(chat.generated_data_sample);
        } else if (chat.generated_data_sample) {
            dataSample = chat.generated_data_sample;
        }
    } catch (e) {
        console.error('Error parsing data sample in details:', e);
    }
    
    const detailsHtml = `
        <div class="chat-details-modal">
            <div class="details-header">
                <h3>Chat Log Details</h3>
                <button onclick="closeDetails()" class="btn-close">×</button>
            </div>
            <div class="details-body">
                <div class="detail-section">
                    <h4>User Prompt:</h4>
                    <p>${escapeHtml(chat.user_prompt)}</p>
                </div>
                <div class="detail-section">
                    <h4>AI Response:</h4>
                    <p>${escapeHtml(chat.ai_message)}</p>
                </div>
                <div class="detail-section">
                    <h4>Generated Schema (${schema.length} fields):</h4>
                    <pre>${JSON.stringify(schema, null, 2)}</pre>
                </div>
                <div class="detail-section">
                    <h4>Data Sample (${dataSample.length} records):</h4>
                    <pre>${JSON.stringify(dataSample, null, 2)}</pre>
                </div>
                <div class="detail-section">
                    <h4>Metadata:</h4>
                    <p>Session ID: ${chat.session_id}</p>
                    <p>Record Count: ${chat.record_count}</p>
                    <p>Success: ${chat.success ? 'Yes' : 'No'}</p>
                    ${chat.error_message ? `<p>Error: ${chat.error_message}</p>` : ''}
                    ${chat.rating ? `<p>User Rating: ${getRatingBadge(chat.rating)}</p>` : ''}
                </div>
            </div>
        </div>
    `;
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'details-overlay';
    overlay.className = 'details-overlay';
    overlay.innerHTML = detailsHtml;
    overlay.onclick = (e) => {
        if (e.target === overlay) closeDetails();
    };
    document.body.appendChild(overlay);
}

function closeDetails() {
    const overlay = document.getElementById('details-overlay');
    if (overlay) overlay.remove();
}

// Export functions
function exportFeedback() {
    if (!feedbackData || feedbackData.length === 0) {
        alert('No feedback data to export');
        return;
    }
    
    const csv = convertToCSV(feedbackData, ['timestamp', 'rating', 'comment', 'email', 'want_updates', 'user_agent']);
    downloadCSV(csv, `feedback_export_${new Date().toISOString().split('T')[0]}.csv`);
}

function exportChatLogs() {
    if (!chatLogsData || chatLogsData.length === 0) {
        alert('No chat logs to export');
        return;
    }
    
    const csv = convertToCSV(chatLogsData, ['timestamp', 'user_prompt', 'ai_message', 'record_count', 'success', 'rating']);
    downloadCSV(csv, `chatlogs_export_${new Date().toISOString().split('T')[0]}.csv`);
}

// Utility functions
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function truncate(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

function getRatingBadge(rating) {
    if (!rating) return '<span class="badge badge-neutral">No rating</span>';
    if (rating === 'thumbs_up') return '<span class="badge badge-success">👍 Helpful</span>';
    if (rating === 'thumbs_down') return '<span class="badge badge-error">👎 Not Helpful</span>';
    return '<span class="badge badge-neutral">-</span>';
}

function convertToCSV(data, columns) {
    const headers = columns.join(',');
    const rows = data.map(row => {
        return columns.map(col => {
            let value = row[col];
            if (value === null || value === undefined) return '';
            if (typeof value === 'object') value = JSON.stringify(value);
            value = String(value).replace(/"/g, '""');
            return `"${value}"`;
        }).join(',');
    });
    return headers + '\n' + rows.join('\n');
}

function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Search functionality for chat logs
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-chatlogs');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const filteredLogs = chatLogsData.filter(log => 
                log.user_prompt.toLowerCase().includes(searchTerm) ||
                log.ai_message.toLowerCase().includes(searchTerm)
            );
            
            // Temporarily update table with filtered results
            const tbody = document.getElementById('chatlogs-tbody');
            if (filteredLogs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">No matching chat logs found</td></tr>';
            } else {
                chatLogsData = filteredLogs;
                renderChatLogsTable();
            }
        });
    }
});

// ========================================
// VECTOR DB MANAGEMENT
// ========================================

function initVectorDBTab() {
    // Event listeners for Vector DB tab buttons
    document.getElementById('btn-update-existing')?.addEventListener('click', openUpdateModal);
    document.getElementById('btn-add-new')?.addEventListener('click', openAddModal);
    document.getElementById('btn-update-domain')?.addEventListener('click', updateDomain);
    document.getElementById('btn-add-domain')?.addEventListener('click', addDomain);
    document.getElementById('btn-generate-ai')?.addEventListener('click', generateAISchema);
    
    // Method selector for add modal
    const methodRadios = document.querySelectorAll('input[name="creation-method"]');
    methodRadios.forEach(radio => {
        radio.addEventListener('change', toggleCreationMethod);
    });
    
    // Field method selector for manual entry
    const fieldMethodRadios = document.querySelectorAll('input[name="field-method"]');
    fieldMethodRadios.forEach(radio => {
        radio.addEventListener('change', toggleFieldMethod);
    });
    
    // Form builder functionality
    document.getElementById('field-count-manual')?.addEventListener('change', generateFieldInputs);
    document.getElementById('btn-add-field')?.addEventListener('click', addFieldInput);
    
    // Update modal functionality
    const updateMethodRadios = document.querySelectorAll('input[name="update-field-method"]');
    updateMethodRadios.forEach(radio => {
        radio.addEventListener('change', toggleUpdateFieldMethod);
    });
    
    document.getElementById('new-field-count')?.addEventListener('change', generateNewFieldInputs);
    document.getElementById('btn-add-new-field')?.addEventListener('click', addNewFieldInput);
    
    // Load domains on init
    loadDomains();
}

async function loadVectorStats() {
    try {
        // Get vector count from Qdrant
        const response = await fetch('http://localhost:6333/collections/successful_schemas');
        const data = await response.json();
        
        document.getElementById('vector-total').textContent = data.result.vectors_count;
        document.getElementById('vector-status').textContent = data.result.status;
        
        // Get domain count from PostgreSQL registry
        const domainsResponse = await fetch('http://localhost:5678/webhook/get-domains-registry');
        const domainsData = await domainsResponse.json();
        
        if (domainsData.success) {
            document.getElementById('domain-total').textContent = domainsData.count;
        } else {
            document.getElementById('domain-total').textContent = '0';
        }
    } catch (error) {
        console.error('Error loading vector stats:', error);
        document.getElementById('vector-total').textContent = 'Error';
        document.getElementById('vector-status').textContent = 'Error';
        document.getElementById('domain-total').textContent = 'Error';
    }
}

async function loadCurrentVectors() {
    try {
        const response = await fetch('http://localhost:6333/collections/successful_schemas/points/scroll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ limit: 100 })
        });
        const data = await response.json();
        
        const vectorsList = document.getElementById('vectors-list');
        if (data.result.points.length === 0) {
            vectorsList.innerHTML = '<p>No vectors in database yet</p>';
            return;
        }
        
        vectorsList.innerHTML = data.result.points.map(point => `
            <div class="vector-item">
                <div class="vector-id">ID: ${point.id}</div>
                <div class="vector-prompt"><strong>${point.payload.user_prompt}</strong></div>
                <div class="vector-fields">${point.payload.schema?.length || 0} fields</div>
                <div class="vector-rating">${point.payload.rating === 'thumbs_up' ? '👍' : point.payload.seeded ? '🌱' : '❓'}</div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading vectors:', error);
    }
}

// Load and display domains organized by business area
async function loadDomains() {
    try {
        // Fetch domains from PostgreSQL registry
        const response = await fetch('http://localhost:5678/webhook/get-domains-registry', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        const domains = organizeDomainsByCategoryFromPostgres(data.domains || []);
        
        displayDomains(domains);
        await loadVectorStats();
    } catch (error) {
        console.error('Error loading domains:', error);
        document.getElementById('domains-container').innerHTML = '<p class="error-message">Error loading domains</p>';
    }
}

// Organize domains from PostgreSQL registry by category
function organizeDomainsByCategoryFromPostgres(domains) {
    const categorized = {};
    
    domains.forEach(domain => {
        const prompt = domain.domain_name.toLowerCase();
        let category = domain.category || 'Other';
        
        // Auto-categorize if category is "General"
        if (category === 'General') {
            if (prompt.includes('payment') || prompt.includes('transaction') || prompt.includes('financial') || prompt.includes('bank') || prompt.includes('credit card')) {
                category = 'Financial';
            } else if (prompt.includes('customer') || prompt.includes('user') || prompt.includes('person') || prompt.includes('employee')) {
                category = 'Customer Data';
            } else if (prompt.includes('product') || prompt.includes('inventory') || prompt.includes('stock')) {
                category = 'E-commerce';
            } else if (prompt.includes('booking') || prompt.includes('reservation') || prompt.includes('hotel') || prompt.includes('flight')) {
                category = 'Hospitality';
            } else if (prompt.includes('healthcare') || prompt.includes('patient') || prompt.includes('medical')) {
                category = 'Healthcare';
            } else if (prompt.includes('logistics') || prompt.includes('shipping') || prompt.includes('delivery')) {
                category = 'Logistics';
            }
        }
        
        if (!categorized[category]) {
            categorized[category] = [];
        }
        
        const parsedSchema = typeof domain.schema === 'string' ? JSON.parse(domain.schema) : domain.schema;
        
        categorized[category].push({
            name: domain.domain_name,
            schema: parsedSchema,
            description: domain.description || '',
            vectorCount: domain.qdrant_vector_count || 0,
            createdAt: domain.created_at,
            updatedAt: domain.updated_at
        });
    });
    
    return categorized;
}

// Organize vectors into business domains (OLD - from Qdrant)
function organizeDomainsByCategory(points) {
    const domains = {};
    
    // First, deduplicate by user_prompt - keep only one entry per domain
    const uniqueDomains = new Map();
    
    points.forEach(point => {
        const userPrompt = point.payload.user_prompt || point.payload.metadata?.user_prompt;
        const schema = point.payload.schema || point.payload.metadata?.schema;
        
        if (!userPrompt || !schema) return;
        
        // Only keep if not already added
        if (!uniqueDomains.has(userPrompt)) {
            uniqueDomains.set(userPrompt, { point, userPrompt, schema });
        }
    });
    
    // Now categorize the unique domains
    uniqueDomains.forEach(({ point, userPrompt, schema }) => {
        const prompt = userPrompt.toLowerCase();
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
        
        const parsedSchema = typeof schema === 'string' ? JSON.parse(schema) : schema;
        
        domains[category].push({
            id: point.id,
            prompt: userPrompt,
            schema: parsedSchema,
            rating: point.payload.rating || point.payload.metadata?.rating || 'unknown'
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
                        <h5 class="domain-name">${domain.name}</h5>
                        <div class="domain-stats">
                            <span>${fieldCount} fields</span>
                            <span>${domain.vectorCount || 0} vectors</span>
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

async function addCustomSchema() {
    const prompt = document.getElementById('custom-prompt').value.trim();
    const schemaText = document.getElementById('custom-schema').value.trim();
    const resultDiv = document.getElementById('custom-result');
    const btn = document.getElementById('btn-add-custom');
    
    if (!prompt || !schemaText) {
        resultDiv.innerHTML = '<div class="error-message">❌ Please fill in both fields</div>';
        return;
    }
    
    try {
        const schema = JSON.parse(schemaText);
        if (!Array.isArray(schema)) {
            throw new Error('Schema must be an array');
        }
        
        btn.disabled = true;
        btn.textContent = 'Adding...';
        resultDiv.innerHTML = '<p class="loading">⏳ Processing...</p>';
        
        const response = await fetch(`${ADMIN_CONFIG.n8nBaseUrl}/seed-schemas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                schemas: [{
                    user_prompt: prompt,
                    schema: schema,
                    rating: 'thumbs_up'
                }]
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            resultDiv.innerHTML = '<div class="success-message">✅ Schema added successfully!</div>';
            document.getElementById('custom-prompt').value = '';
            document.getElementById('custom-schema').value = '';
            await loadVectorStats();
        } else {
            throw new Error('Failed to add schema');
        }
    } catch (error) {
        resultDiv.innerHTML = `<div class="error-message">❌ Error: ${error.message}</div>`;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Add to Vector DB';
    }
}

// ========================================
// MODAL FUNCTIONS
// ========================================

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
    
    // Initialize form builder
    setTimeout(() => {
        generateFieldInputs();
    }, 100);
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

function toggleFieldMethod() {
    const method = document.querySelector('input[name="field-method"]:checked').value;
    const formBuilder = document.getElementById('form-builder');
    const jsonBuilder = document.getElementById('json-builder');
    
    if (method === 'form') {
        formBuilder.style.display = 'block';
        jsonBuilder.style.display = 'none';
        generateFieldInputs(); // Generate initial fields
    } else {
        formBuilder.style.display = 'none';
        jsonBuilder.style.display = 'block';
    }
}

function generateFieldInputs() {
    const count = parseInt(document.getElementById('field-count-manual').value) || 5;
    const container = document.getElementById('fields-container');
    
    container.innerHTML = '';
    
    for (let i = 0; i < count; i++) {
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'field-input-row';
        fieldDiv.innerHTML = `
            <div class="field-input-group">
                <input type="text" class="field-name-input" placeholder="Field name" />
                <select class="field-type-select">
                    <option value="string">Text</option>
                    <option value="integer">Number</option>
                    <option value="decimal">Decimal</option>
                    <option value="date">Date</option>
                    <option value="datetime">Date & Time</option>
                    <option value="boolean">True/False</option>
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                    <option value="uuid">ID</option>
                </select>
                <input type="text" class="field-description-input" placeholder="Description" />
                <input type="text" class="field-examples-input" placeholder="Examples" />
                <button type="button" class="btn-remove-field" onclick="removeFieldInput(this)">×</button>
            </div>
        `;
        container.appendChild(fieldDiv);
    }
}

function addFieldInput() {
    const container = document.getElementById('fields-container');
    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'field-input-row';
    fieldDiv.innerHTML = `
        <div class="field-input-group">
            <input type="text" class="field-name-input" placeholder="Field name (e.g., customer_id)" />
            <select class="field-type-select">
                <option value="string">Text</option>
                <option value="integer">Number</option>
                <option value="decimal">Decimal</option>
                <option value="date">Date</option>
                <option value="datetime">Date & Time</option>
                <option value="boolean">True/False</option>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="uuid">ID</option>
            </select>
            <input type="text" class="field-description-input" placeholder="Description (optional)" />
            <input type="text" class="field-examples-input" placeholder="Examples: value1, value2, value3" />
            <button type="button" class="btn-remove-field" onclick="removeFieldInput(this)">×</button>
        </div>
    `;
    container.appendChild(fieldDiv);
}

function removeFieldInput(button) {
    button.closest('.field-input-row').remove();
}

// Load domain options for update modal
async function loadDomainOptions() {
    try {
        const response = await fetch('http://localhost:5678/webhook/get-domains-registry');
        const data = await response.json();
        const select = document.getElementById('domain-select');
        
        // Clear existing options
        select.innerHTML = '<option value="">Choose a domain...</option>';
        
        if (data.success && data.domains) {
            data.domains.forEach(domain => {
                const option = document.createElement('option');
                option.value = domain.domain_name;
                option.textContent = domain.domain_name;
                option.dataset.schema = JSON.stringify(domain.schema);
                select.appendChild(option);
            });
        }
        
        // Add change listener
        select.addEventListener('change', loadDomainFields);
        
    } catch (error) {
        console.error('Error loading domain options:', error);
    }
}

// Load fields for selected domain
async function loadDomainFields() {
    const select = document.getElementById('domain-select');
    const selectedDomain = select.value;
    if (!selectedDomain) return;
    
    try {
        const currentFields = document.getElementById('current-fields');
        
        // Get schema from dropdown dataset
        const selectedOption = select.options[select.selectedIndex];
        const schemaJSON = selectedOption.dataset.schema;
        
        if (schemaJSON) {
            const schema = JSON.parse(schemaJSON);
            if (Array.isArray(schema)) {
                currentFields.innerHTML = schema.map((field, index) => `
                    <div class="field-input-group">
                        <input type="text" class="field-name-input" value="${field.name}" placeholder="Field name" />
                        <select class="field-type-select">
                            <option value="string" ${field.type === 'string' ? 'selected' : ''}>Text</option>
                            <option value="integer" ${field.type === 'integer' ? 'selected' : ''}>Number</option>
                            <option value="decimal" ${field.type === 'decimal' ? 'selected' : ''}>Decimal</option>
                            <option value="date" ${field.type === 'date' ? 'selected' : ''}>Date</option>
                            <option value="datetime" ${field.type === 'datetime' ? 'selected' : ''}>Date & Time</option>
                            <option value="boolean" ${field.type === 'boolean' ? 'selected' : ''}>True/False</option>
                            <option value="email" ${field.type === 'email' ? 'selected' : ''}>Email</option>
                            <option value="phone" ${field.type === 'phone' ? 'selected' : ''}>Phone</option>
                            <option value="uuid" ${field.type === 'uuid' ? 'selected' : ''}>ID</option>
                        </select>
                        <input type="text" class="field-description-input" value="${field.description || ''}" placeholder="Description" />
                        <input type="text" class="field-examples-input" value="${(field.examples || []).join(', ')}" placeholder="Examples" />
                        <button type="button" class="btn-remove-field" onclick="removeCurrentField(this)">×</button>
                    </div>
                `).join('');
            } else {
                currentFields.innerHTML = '<p>No fields found</p>';
            }
        } else {
            currentFields.innerHTML = '<p>No fields found for this domain</p>';
        }
        
    } catch (error) {
        console.error('Error loading domain fields:', error);
        document.getElementById('current-fields').innerHTML = '<p>Error loading fields</p>';
    }
}

// Remove current field
function removeCurrentField(button) {
    button.closest('.editable-field').remove();
}

// Toggle update field method
function toggleUpdateFieldMethod() {
    const method = document.querySelector('input[name="update-field-method"]:checked').value;
    const formBuilder = document.getElementById('update-form-builder');
    const jsonBuilder = document.getElementById('update-json-builder');
    
    if (method === 'form') {
        formBuilder.style.display = 'block';
        jsonBuilder.style.display = 'none';
        generateNewFieldInputs();
    } else {
        formBuilder.style.display = 'none';
        jsonBuilder.style.display = 'block';
    }
}

// Generate new field inputs
function generateNewFieldInputs() {
    const count = parseInt(document.getElementById('new-field-count').value) || 2;
    const container = document.getElementById('new-fields-container');
    
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
        addNewFieldInput();
    }
}

// Add new field input
function addNewFieldInput() {
    const container = document.getElementById('new-fields-container');
    const fieldRow = document.createElement('div');
    fieldRow.className = 'field-input-row';
        fieldRow.innerHTML = `
            <div class="field-input-group">
                <input type="text" class="field-name-input" placeholder="Field name" />
                <select class="field-type-select">
                    <option value="string">Text</option>
                    <option value="integer">Number</option>
                    <option value="decimal">Decimal</option>
                    <option value="date">Date</option>
                    <option value="datetime">Date & Time</option>
                    <option value="boolean">True/False</option>
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                    <option value="uuid">ID</option>
                </select>
                <input type="text" class="field-description-input" placeholder="Description" />
                <input type="text" class="field-examples-input" placeholder="Examples" />
                <button type="button" class="btn-remove-field" onclick="removeNewFieldInput(this)">×</button>
            </div>
        `;
    container.appendChild(fieldRow);
}

// Remove new field input
function removeNewFieldInput(button) {
    button.closest('.field-input-row').remove();
}

// Update existing domain
async function updateDomain() {
    const selectedDomain = document.getElementById('domain-select').value;
    const fieldMethod = document.querySelector('input[name="update-field-method"]:checked').value;
    const resultDiv = document.getElementById('update-result');
    
    if (!selectedDomain) {
        resultDiv.innerHTML = '<div class="result-message error">Please select a domain</div>';
        return;
    }
    
    try {
        // Get current fields (edited)
        const currentFieldElements = document.querySelectorAll('.editable-field');
        const currentFields = [];
        currentFieldElements.forEach(fieldElement => {
            const nameInput = fieldElement.querySelector('.field-name-input');
            const typeSelect = fieldElement.querySelector('.field-type-select');
            if (nameInput.value.trim()) {
                currentFields.push({
                    name: nameInput.value.trim(),
                    type: typeSelect.value
                });
            }
        });
        
        // Get new fields
        let newFields = [];
        if (fieldMethod === 'form') {
            // Get fields from form builder
            const newFieldElements = document.querySelectorAll('#new-fields-container .field-input-row');
            newFieldElements.forEach(fieldElement => {
                const nameInput = fieldElement.querySelector('.field-name-input');
                const typeSelect = fieldElement.querySelector('.field-type-select');
                if (nameInput.value.trim()) {
                    newFields.push({
                        name: nameInput.value.trim(),
                        type: typeSelect.value
                    });
                }
            });
        } else {
            // Get fields from JSON
            const newFieldsText = document.getElementById('new-fields').value.trim();
            if (newFieldsText) {
                newFields = JSON.parse(newFieldsText);
            }
        }
        
        // Combine current and new fields
        const allFields = [...currentFields, ...newFields];
        
        // Update via n8n workflow
        const updateResponse = await fetch(`${ADMIN_CONFIG.n8nBaseUrl}/manage-domain-with-registry`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                domain: selectedDomain,
                schema: allFields,
                action: 'update'
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
            const fieldMethod = document.querySelector('input[name="field-method"]:checked').value;
            
            if (fieldMethod === 'form') {
                // Get fields from form builder
                const fieldInputs = document.querySelectorAll('.field-input-row');
                schema = [];
                
                fieldInputs.forEach(row => {
                    const nameInput = row.querySelector('.field-name-input');
                    const typeSelect = row.querySelector('.field-type-select');
                    const descriptionInput = row.querySelector('.field-description-input');
                    const examplesInput = row.querySelector('.field-examples-input');
                    
                    if (nameInput.value.trim()) {
                        const field = {
                            name: nameInput.value.trim(),
                            type: typeSelect.value
                        };
                        
                        // Add description if provided
                        if (descriptionInput.value.trim()) {
                            field.description = descriptionInput.value.trim();
                        }
                        
                        // Add examples if provided
                        if (examplesInput.value.trim()) {
                            const examples = examplesInput.value.split(',').map(ex => ex.trim()).filter(ex => ex);
                            if (examples.length > 0) {
                                field.examples = examples;
                            }
                        }
                        
                        schema.push(field);
                    }
                });
                
                if (schema.length === 0) {
                    resultDiv.innerHTML = '<div class="result-message error">Please add at least one field</div>';
                    return;
                }
            } else {
                // Get fields from JSON
                const manualFields = document.getElementById('manual-fields').value.trim();
                if (!manualFields) {
                    resultDiv.innerHTML = '<div class="result-message error">Please provide fields</div>';
                    return;
                }
                schema = JSON.parse(manualFields);
            }
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
            
            // The preview already contains parsed JSON, so parse it
            try {
                schema = JSON.parse(previewContent.textContent);
            } catch (e) {
                resultDiv.innerHTML = '<div class="result-message error">Invalid AI schema format</div>';
                return;
            }
        }
        
        if (!Array.isArray(schema)) {
            throw new Error('Schema must be an array');
        }
        
        // Get optional description and category
        const domainDescription = document.getElementById('domain-description')?.value?.trim() || '';
        const domainCategory = document.getElementById('domain-category')?.value?.trim() || 'General';
        
        // Add via n8n workflow
        const response = await fetch(`${ADMIN_CONFIG.n8nBaseUrl}/manage-domain-with-registry`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                domain: domainName,
                schema: schema,
                action: 'create',
                description: domainDescription,
                category: domainCategory
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

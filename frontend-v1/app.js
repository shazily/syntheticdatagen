// Main Application Logic

// Configuration
const CONFIG = {
    n8nBaseUrl: 'http://localhost:5678/webhook',
    simpleGeneratorWebhook: 'generate-simple',
    intelligentGeneratorWebhook: 'generate-intelligent'
};

let currentGeneratedData = null;
let chatSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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
        alert(validation.message);
        return;
    }

    const schema = schemaBuilder.getSchema();
    const recordCount = parseInt(document.getElementById('recordCount').value);
    const exportFormat = document.getElementById('exportFormat').value;

    if (recordCount < 1 || recordCount > 10000) {
        alert('Please enter a valid number of records (1-10,000)');
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
            alert(`Successfully generated ${recordCount} records!`);
        } else {
            throw new Error(result.error || 'Unknown error occurred');
        }
    } catch (error) {
        console.error('Error generating data:', error);
        alert(`Error generating data: ${error.message}\n\nPlease ensure n8n is running and the workflow is properly configured.`);
    } finally {
        hideLoading();
    }
}

// Intelligent Data Generation (AI Chat Path)
async function sendChatMessage() {
    const chatInput = document.getElementById('chat-input');
    const message = chatInput.value.trim();

    if (!message) {
        alert('Please enter a description of the data you need');
        return;
    }

    // Add user message to chat
    addMessageToChat('user', message);
    chatInput.value = '';

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
            
            // If data was generated, display it
            if (result.response.data) {
                currentGeneratedData = result.response.data;
                displayDataPreview(result.response.data);
            }
        } else {
            throw new Error('Invalid response from AI');
        }
    } catch (error) {
        console.error('Error:', error);
        addMessageToChat('assistant', `Sorry, I encountered an error: ${error.message}. Please ensure n8n is running and the workflow is configured correctly.`);
    } finally {
        hideLoading();
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
    const previewContent = document.getElementById('preview-content');
    const downloadActions = document.getElementById('download-actions');

    if (!data || data.length === 0) {
        previewContent.innerHTML = '<p class="preview-placeholder">No data to display</p>';
        downloadActions.style.display = 'none';
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
    
    previewContent.innerHTML = tableHtml;
    downloadActions.style.display = 'flex';
}

// Download Functions
function downloadData(format) {
    if (!currentGeneratedData) {
        alert('No data to download');
        return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `synthetic_data_${timestamp}`;

    if (format === 'csv') {
        downloadCSV(currentGeneratedData, filename);
    } else if (format === 'excel') {
        downloadExcel(currentGeneratedData, filename);
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

// Enter key support for chat
document.addEventListener('DOMContentLoaded', () => {
    initTabs();

    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChatMessage();
            }
        });
    }
});


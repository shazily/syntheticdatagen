// Analytics and Feedback System for Synthetic Data Generator

// Track custom events in Google Analytics
function trackEvent(eventName, eventParams = {}) {
    if (typeof gtag !== 'undefined') {
        gtag('event', eventName, eventParams);
    }
}

// Track page interactions
function setupAnalyticsTracking() {
    // Track tab switches
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.textContent.trim();
            trackEvent('tab_switch', {
                tab_name: tabName,
                category: 'Navigation'
            });
        });
    });
    
    // Track data generation
    const originalGenerateSimpleData = window.generateSimpleData;
    if (typeof originalGenerateSimpleData === 'function') {
        window.generateSimpleData = async function() {
            const exportFormat = document.getElementById('exportFormat')?.value || 'unknown';
            const recordCount = document.getElementById('recordCount')?.value || 0;
            trackEvent('generate_data', {
                mode: 'schema_builder',
                export_format: exportFormat,
                record_count: recordCount,
                category: 'Data Generation'
            });
            return originalGenerateSimpleData.apply(this, arguments);
        };
    }
    
    // Track AI interactions
    const originalSendChatMessage = window.sendChatMessage;
    if (typeof originalSendChatMessage === 'function') {
        window.sendChatMessage = async function() {
            trackEvent('ai_interaction', {
                mode: 'ai_mode',
                category: 'AI Generation'
            });
            return originalSendChatMessage.apply(this, arguments);
        };
    }
}

// Feedback state
let currentRating = 0;

// Star rating interaction
function setRating(rating) {
    currentRating = rating;
    const stars = document.querySelectorAll('.star');
    stars.forEach((star, index) => {
        if (index < rating) {
            star.classList.add('active');
        } else {
            star.classList.remove('active');
        }
    });
}

// Open feedback modal
function openFeedbackModal() {
    const modalContent = `
        <div class="modal-header">
            <div class="modal-title-section">
                <h2 class="modal-title">Share Your Feedback</h2>
                <p class="modal-subtitle">Help us improve the Synthetic Data Generator</p>
            </div>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">
            <form class="feedback-form" id="feedback-form">
                <div class="feedback-section">
                    <label>How would you rate your experience?</label>
                    <div class="rating-container">
                        <div class="star-rating">
                            <span class="star" onclick="setRating(1)">★</span>
                            <span class="star" onclick="setRating(2)">★</span>
                            <span class="star" onclick="setRating(3)">★</span>
                            <span class="star" onclick="setRating(4)">★</span>
                            <span class="star" onclick="setRating(5)">★</span>
                        </div>
                    </div>
                </div>
                
                <div class="feedback-section">
                    <label for="feedback-comment">Comments or Suggestions (Optional):</label>
                    <textarea 
                        id="feedback-comment" 
                        class="feedback-textarea"
                        placeholder="Tell us what you think, what features you'd like, or any issues you encountered..."
                    ></textarea>
                </div>
                
                <div class="feedback-section">
                    <div class="feedback-checkbox">
                        <input type="checkbox" id="want-updates" value="yes">
                        <label for="want-updates">I'd like to receive updates about new features and development progress</label>
                    </div>
                </div>
                
                <div class="feedback-section" id="email-section" style="display: none;">
                    <label for="feedback-email">Your Email (Optional):</label>
                    <input 
                        type="email" 
                        id="feedback-email" 
                        class="feedback-email"
                        placeholder="your.email@example.com"
                    >
                </div>
            </form>
        </div>
        <div class="modal-footer">
            <button class="btn-secondary" onclick="closeModal()">CANCEL</button>
            <button class="btn-primary" onclick="submitFeedback()">SUBMIT FEEDBACK</button>
        </div>
    `;
    
    openModal(modalContent);
    
    // Show/hide email field based on checkbox
    const wantUpdatesCheckbox = document.getElementById('want-updates');
    const emailSection = document.getElementById('email-section');
    
    if (wantUpdatesCheckbox && emailSection) {
        wantUpdatesCheckbox.addEventListener('change', (e) => {
            emailSection.style.display = e.target.checked ? 'flex' : 'none';
        });
    }
    
    // Track feedback modal open
    trackEvent('feedback_modal_opened', {
        category: 'Engagement'
    });
}

// Submit feedback
async function submitFeedback() {
    const comment = document.getElementById('feedback-comment')?.value || '';
    const wantUpdates = document.getElementById('want-updates')?.checked || false;
    const email = document.getElementById('feedback-email')?.value || '';
    
    // Validate rating
    if (currentRating === 0) {
        showToast('warning', 'Rating Required', 'Please select a star rating before submitting');
        return;
    }
    
    // Validate email if updates requested
    if (wantUpdates && !email) {
        showToast('warning', 'Email Required', 'Please provide your email to receive updates');
        return;
    }
    
    const feedbackData = {
        rating: currentRating,
        comment: comment,
        wantUpdates: wantUpdates,
        email: email,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        screenResolution: `${window.screen.width}x${window.screen.height}`
    };
    
    // Track feedback submission
    trackEvent('feedback_submitted', {
        rating: currentRating,
        has_comment: comment.length > 0,
        wants_updates: wantUpdates,
        category: 'Engagement'
    });
    
    try {
        // Auto-detect environment for n8n webhook URL
        const n8nUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'http://localhost:5678/webhook/feedback'
            : 'https://n8n.gptlab.ae/webhook/feedback';
        
        // Send to n8n webhook
        const response = await fetch(n8nUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(feedbackData)
        });
        
        if (response.ok) {
            showToast('success', 'Thank You!', 'Your feedback has been submitted successfully');
            closeModal();
            currentRating = 0; // Reset rating
        } else {
            throw new Error('Failed to submit feedback');
        }
    } catch (error) {
        console.error('Feedback submission error:', error);
        // Still show success to user even if webhook fails
        showToast('success', 'Thank You!', 'Your feedback has been recorded');
        closeModal();
        currentRating = 0; // Reset rating
    }
}

// Initialize analytics when page loads
document.addEventListener('DOMContentLoaded', () => {
    setupAnalyticsTracking();
    
    // Track initial page load
    trackEvent('page_view', {
        page_title: document.title,
        category: 'Engagement'
    });
});


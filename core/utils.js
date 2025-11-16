// Utility functions

// Format currency
function formatCurrency(amount, currency = 'GHS') {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2
    }).format(amount);
}

// Format date
function formatDate(date, format = 'medium') {
    if (!(date instanceof Date)) {
        date = new Date(date);
    }
    
    const options = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    
    if (format === 'short') {
        return date.toLocaleDateString();
    } else if (format === 'time') {
        return date.toLocaleTimeString();
    } else if (format === 'iso') {
        return date.toISOString().split('T')[0];
    }
    
    return date.toLocaleString(undefined, options);
}

// Show toast notification with sound
function showToast(message, type = 'info', duration = 3000) {
    // Play sound based on toast type
    if (window.soundManager) {
        try {
            switch(type) {
                case 'success':
                    window.soundManager.playSuccess();
                    break;
                case 'danger':
                case 'error':
                    window.soundManager.playError();
                    break;
                case 'warning':
                    window.soundManager.playWarning();
                    break;
                case 'info':
                default:
                    window.soundManager.playInfo();
                    break;
            }
        } catch (error) {
            console.warn('Error playing toast sound:', error);
        }
    }
    
    const toastContainer = document.getElementById('toast-container') || createToastContainer();
    const toast = document.createElement('div');
    
    toast.className = `toast show align-items-center text-white bg-${type} border-0`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    // Auto-remove toast after duration
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 150);
    }, duration);
    
    // Close button
    const closeButton = toast.querySelector('[data-bs-dismiss="toast"]');
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 150);
        });
    }
    
    return toast;
}

// Create toast container if it doesn't exist
function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container position-fixed top-0 end-0 p-3';
    container.style.zIndex = '1100';
    document.body.appendChild(container);
    return container;
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// Throttle function
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Generate unique ID
function generateId(prefix = '') {
    return `${prefix}${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
}

// Validate email
function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
}

// Format file size
function formatFileSize(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Deep clone object
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

// Get URL parameters
function getUrlParams() {
    const params = {};
    const queryString = window.location.search.substring(1);
    const pairs = queryString.split('&');
    
    for (const pair of pairs) {
        const [key, value] = pair.split('=');
        if (key) {
            params[decodeURIComponent(key)] = decodeURIComponent(value || '');
        }
    }
    
    return params;
}

// Set URL parameters
function setUrlParams(params) {
    const queryString = Object.entries(params)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value || '')}`)
        .join('&');
    
    const newUrl = window.location.pathname + (queryString ? `?${queryString}` : '');
    window.history.pushState({}, '', newUrl);
}

// Show/hide loading overlay
function showLoading(show, key = 'default') {
    try {
        const loadingElement = document.getElementById('loading');
        if (!loadingElement) {
            console.warn('Loading element not found');
            return;
        }

        if (show) {
            loadingElement.style.display = 'flex';
        } else {
            // Add a small delay before hiding to prevent flickering
            setTimeout(() => {
                loadingElement.style.display = 'none';
            }, 300);
        }
    } catch (error) {
        console.error('Error updating loading state:', error);
    }
}

export {
    formatCurrency,
    formatDate,
    showToast,
    debounce,
    throttle,
    generateId,
    isValidEmail,
    formatFileSize,
    deepClone,
    getUrlParams,
    setUrlParams,
    showLoading
};

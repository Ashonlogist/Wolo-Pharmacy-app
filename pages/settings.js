// Settings page functionality
import { settings, system } from '../core/api.js';
import * as events from '../core/events.js';
import { showToast } from '../core/utils.js';

// Add styles for loading overlay
const style = document.createElement('style');
style.textContent = `
    .loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        color: white;
    }
`;
document.head.appendChild(style);

// Default settings configuration
const defaultSettings = {
    company_name: '',
    company_address: '',
    company_phone: '',
    company_email: '',
    currency: 'GHS',
    date_format: 'YYYY-MM-DD',
    theme: 'light',
    developer_mode: 'false',
    smtp_port: '587',
    smtp_secure: 'true',
    backup_frequency: 'daily',
    keep_backups: '30',
    auto_backup: 'false'
};

// Helper function to handle IPC calls safely with timeout
async function handleIpcCall(action, ...args) {
    try {
        const result = await action(...args);
        if (!result || !result.success) {
            throw new Error(result?.error || 'Operation failed');
        }
        return result;
    } catch (error) {
        console.error('IPC call failed:', error);
        throw error; // Re-throw to be handled by the calling function
    }
}

// Helper function to safely load and initialize a setting
async function loadSetting(key, defaultValue = '') {
    try {
        console.log(`Loading setting: ${key}`);
        const result = await settings.get(key);
        
        // If the setting doesn't exist or failed to load, initialize it
        if (!result?.success || !result?.exists) {
            console.log(`Initializing ${key} with default:`, defaultValue);
            try {
                await settings.save(key, defaultValue);
                return defaultValue;
            } catch (saveError) {
                console.error(`Failed to save default value for ${key}:`, saveError);
                return defaultValue;
            }
        }

        return result.value ?? defaultValue;
    } catch (error) {
        console.error(`Error handling setting ${key}:`, error);
        return defaultValue;
    }
}

// Helper function to safely update UI elements
function updateUIElement(id, value, defaultVal = '') {
    try {
        const element = document.getElementById(id);
        if (element) {
            if (element.type === 'checkbox') {
                element.checked = value === true || value === 'true';
            } else {
                element.value = value ?? defaultVal;
            }
        }
    } catch (error) {
        console.error(`Error updating UI element ${id}:`, error);
    }
}

// Export functions that need to be available globally
window.toggleTheme = toggleTheme;
window.saveSettings = saveSettings;
window.testEmailSettings = testEmailSettings;
window.createBackup = createBackup;
window.restoreBackup = restoreBackup;
window.checkForUpdates = checkForUpdates;
window.installUpdate = installUpdate;

// Setup event listeners when DOM is ready
// Helper function to wrap initialization functions with error handling
function wrapInitFunction(fn, name, errorMessage) {
    return fn().catch(error => {
        console.error(`Error in ${name}:`, error);
        showToast(errorMessage, error.critical ? 'danger' : 'warning');
        return Promise.reject(error);
    });
}

// Create loading overlay
const loadingOverlay = document.createElement('div');
loadingOverlay.className = 'loading-overlay';
loadingOverlay.innerHTML = `
    <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
    </div>
    <div class="mt-2">Initializing settings...</div>
`;

// Initialize the page when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Show loading overlay
        document.body.appendChild(loadingOverlay);

        // Wrap all async initialization in Promise.allSettled
        Promise.allSettled([
            wrapInitFunction(loadSettings, 'loadSettings', 'Failed to load settings'),
            wrapInitFunction(setupEventListeners, 'setupEventListeners', 'Failed to initialize some features'),
            wrapInitFunction(checkForUpdates, 'checkForUpdates', 'Failed to check for updates')
        ]).then(results => {
            // Process results
            const failures = results.filter(result => result.status === 'rejected');
            if (failures.length > 0) {
                failures.forEach((failure, index) => {
                    console.error(`Initialization step ${index} failed:`, failure.reason);
                });

                if (failures.length === results.length) {
                    showToast('Failed to initialize settings page. Please try refreshing.', 'danger');
                } else {
                    showToast('Some features failed to initialize. Some functionality may be limited.', 'warning');
                }
            }
        }).catch(error => {
            console.error('Critical initialization error:', error);
            showToast('Failed to initialize settings page. Please try refreshing.', 'danger');
        }).finally(() => {
            // Always remove loading overlay
            loadingOverlay.remove();
        });
    } catch (error) {
        console.error('Error in DOMContentLoaded:', error);
        loadingOverlay.remove();
        showToast('Failed to initialize settings page', 'danger');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    // Wrap all async initialization in Promise.allSettled to handle all possible rejections
    Promise.allSettled([
        loadSettings().catch(error => {
            console.error('Error loading settings:', error);
            showToast('Failed to load settings', 'danger');
            return Promise.reject(error);
        }),
        setupEventListeners().catch(error => {
            console.error('Error setting up event listeners:', error);
            showToast('Failed to initialize some features', 'warning');
            return Promise.reject(error);
        }),
        checkForUpdates().catch(error => {
            console.error('Error checking for updates:', error);
            showToast('Failed to check for updates', 'warning');
            return Promise.reject(error);
        })
    ]).then(results => {
        // Log any failures for debugging
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                console.error(`Initialization step ${index} failed:`, result.reason);
            }
        });
    });
});

// Set up event listeners for the settings page
async function setupEventListeners() {
    // Initialize and handle developer mode toggle
    try {
        const devModeToggle = document.getElementById('developerMode');
        if (devModeToggle) {
            try {
                // Get initial state with default value
                const result = await settings.get('developer_mode');
                if (!result || !result.success) {
                    // Initialize developer_mode setting if it doesn't exist
                    await settings.save('developer_mode', 'false');
                    devModeToggle.checked = false;
                } else {
                    devModeToggle.checked = result.value === 'true';
                }
                
                // Handle toggle changes
                devModeToggle.addEventListener('change', async (e) => {
                    const newValue = e.target.checked;
                    try {
                        await handleIpcCall(settings.save, 'developer_mode', newValue.toString());
                        
                        // Notify the app of developer mode change
                        events.emit('developer-mode-changed', newValue);
                        showToast('Developer mode ' + (newValue ? 'enabled' : 'disabled'), 'success');
                    } catch (error) {
                        console.error('Error toggling developer mode:', error);
                        // Revert the toggle on error
                        e.target.checked = !newValue;
                        showToast('Failed to toggle developer mode: ' + error.message, 'danger');
                        throw error; // Re-throw for proper Promise rejection handling
                    }
                });
            } catch (error) {
                console.error('Error initializing developer mode toggle:', error);
                showToast('Failed to initialize developer mode settings', 'danger');
            }
        }
    } catch (error) {
        console.error('Error initializing developer mode toggle:', error);
        showToast('Failed to initialize developer mode settings', 'danger');
    }    // Save settings button
    const saveBtn = document.getElementById('saveSettingsBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveSettings);
    
    // Test email button
    const testEmailBtn = document.getElementById('testEmailBtn');
    if (testEmailBtn) testEmailBtn.addEventListener('click', testEmailSettings);
    
    // Backup buttons
    const backupBtns = [
        { id: 'backupNowBtn', handler: createBackup },
        { id: 'restoreBackupBtn', handler: restoreBackup }
    ];
    
    backupBtns.forEach(({ id, handler }) => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', handler);
    });
    
    // Theme toggle
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('change', toggleTheme);
    }
    
    // Check for updates button
    const updatesBtn = document.getElementById('checkUpdatesBtn');
    if (updatesBtn) updatesBtn.addEventListener('click', checkForUpdates);
    
    // Form submissions
    const forms = ['generalSettingsForm', 'emailSettingsForm', 'backupSettingsForm'];
    forms.forEach(formId => {
        const form = document.getElementById(formId);
        if (form) {
            form.addEventListener('submit', (e) => e.preventDefault());
        }
    });
}

// Load settings from the database
async function loadSettings() {
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) loadingOverlay.style.display = 'flex';
    
    try {
        const keys = [
            'developer_mode',
            'company_name',
            'company_address',
            'company_phone',
            'company_email',
            'currency',
            'date_format',
            'theme'
        ];
        
        // Load all settings in parallel
        const values = await Promise.all(keys.map(async key => {
            try {
                const value = await loadSetting(key, '');
                return { key, value, success: true };
            } catch (error) {
                console.error(`Error loading setting ${key}:`, error);
                return { key, value: '', success: false, error };
            }
        }));

        // Update UI elements
        values.forEach(({ key, value, success }) => {
            if (!success) return;
            
            const element = document.getElementById(key);
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = value === 'true' || value === true;
                } else {
                    element.value = value;
                }
            }
        });

        // Handle theme specially
        const themeSetting = values.find(item => item.key === 'theme');
        if (themeSetting?.success) {
            document.documentElement.setAttribute('data-bs-theme', themeSetting.value || 'light');
            const themeToggle = document.getElementById('themeToggle');
            if (themeToggle) {
                themeToggle.checked = themeSetting.value === 'dark';
            }
        }

        // Load additional settings
        await Promise.all([
            loadEmailSettings(),
            loadBackupSettings()
        ]);

        showToast('Settings loaded successfully', 'success');
    } catch (error) {
        console.error('Error loading settings:', error);
        showToast('Failed to load settings', 'danger');
    } finally {
        if (loadingOverlay) loadingOverlay.style.display = 'none';
    }
}

// Load email settings
async function loadEmailSettings() {
    try {
        const emailKeys = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_secure', 'from_email', 'from_name'];
        const defaultValues = {
            smtp_port: '587',
            smtp_secure: 'true'
        };

        const values = await Promise.all(emailKeys.map(async key => ({
            key,
            value: await loadSetting(key, defaultValues[key] || '')
        })));

        values.forEach(({ key, value }) => {
            switch (key) {
                case 'smtp_host':
                    updateUIElement('smtpHost', value);
                    break;
                case 'smtp_port':
                    updateUIElement('smtpPort', value, '587');
                    break;
                case 'smtp_user':
                    updateUIElement('smtpUser', value);
                    break;
                case 'smtp_secure':
                    updateUIElement('smtpSecure', value === 'true');
                    break;
                case 'from_email':
                    updateUIElement('fromEmail', value);
                    break;
                case 'from_name':
                    updateUIElement('fromName', value);
                    break;
            }
        });

        // Never show password in UI
        updateUIElement('smtpPass', '');
        
        // Add password visibility toggle and validation
        setupPasswordToggle('smtpPass');
        setupEmailValidation();
    } catch (error) {
        console.error('Error loading email settings:', error);
        showToast('Failed to load email settings', 'warning');
    }
}

// Load backup settings
async function loadBackupSettings() {
    try {
        const backupKeys = ['auto_backup', 'backup_frequency', 'backup_location', 'keep_backups'];
        const defaultValues = {
            auto_backup: 'false',
            backup_frequency: 'daily',
            keep_backups: '30'
        };

        const values = await Promise.all(backupKeys.map(async key => ({
            key,
            value: await loadSetting(key, defaultValues[key] || '')
        })));

        values.forEach(({ key, value }) => {
            switch (key) {
                case 'auto_backup':
                    updateUIElement('autoBackup', value === 'true');
                    break;
                case 'backup_frequency':
                    updateUIElement('backupFrequency', value, 'daily');
                    break;
                case 'backup_location':
                    updateUIElement('backupLocation', value);
                    break;
                case 'keep_backups':
                    updateUIElement('keepBackups', value, '30');
                    break;
            }
        });
    } catch (error) {
        console.error('Error loading backup settings:', error);
        showToast('Failed to load backup settings', 'warning');
    }
}

// Save settings to the database with validation
async function saveSettings() {
    const saveBtn = document.getElementById('saveSettingsBtn');
    const originalBtnText = saveBtn?.innerHTML;
    
    try {
        // Show loading state
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
        }

        // Validate email settings
        if (!validateEmailSettings()) {
            throw new Error('Please fix the validation errors before saving.');
        }

        // Get current settings to preserve password if not changed
        const currentSettings = await settings.get();
        const smtpPassInput = document.getElementById('smtpPass');
        
        const settingsData = {
            general: {
                companyName: document.getElementById('companyName').value.trim(),
                address: document.getElementById('companyAddress').value.trim(),
                phone: document.getElementById('companyPhone').value.trim(),
                email: document.getElementById('companyEmail').value.trim(),
                currency: document.getElementById('currency').value,
                dateFormat: document.getElementById('dateFormat').value,
                theme: document.getElementById('themeToggle').checked ? 'dark' : 'light'
            },
            email: {
                smtpHost: document.getElementById('smtpHost').value.trim(),
                smtpPort: parseInt(document.getElementById('smtpPort').value) || 587,
                smtpUser: document.getElementById('smtpUser').value.trim(),
                smtpSecure: document.getElementById('smtpSecure').checked,
                fromEmail: document.getElementById('fromEmail').value.trim(),
                fromName: document.getElementById('fromName').value.trim()
            },
            backup: {
                autoBackup: document.getElementById('autoBackup').checked,
                backupFrequency: document.getElementById('backupFrequency').value,
                backupLocation: document.getElementById('backupLocation').value.trim(),
                keepBackups: parseInt(document.getElementById('keepBackups').value) || 30
            }
        };

        // Only update password if it was changed (not empty)
        if (smtpPassInput.value) {
            settingsData.email.smtpPass = smtpPassInput.value;
        } else if (currentSettings?.email?.smtpPass) {
            settingsData.email.smtpPass = currentSettings.email.smtpPass;
        }
        
        // Save settings
        await settings.save(settingsData);
        
        // Clear password field after save (for security)
        smtpPassInput.value = '';
        
        showToast('Settings saved successfully', 'success');
        
        // Update theme immediately
        document.documentElement.setAttribute('data-bs-theme', settingsData.general.theme);
        
    } catch (error) {
        console.error('Error saving settings:', error);
        showToast(error.message || 'Failed to save settings', 'danger');
    } finally {
        // Restore button state
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalBtnText;
        }
    }
}

// Test email settings with validation and loading state
async function testEmailSettings() {
    const testBtn = document.getElementById('testEmailBtn');
    const originalBtnText = testBtn?.innerHTML;
    
    try {
        // Validate email settings first
        if (!validateEmailSettings()) {
            throw new Error('Please configure valid email settings before testing.');
        }
        
        // Show loading state
        if (testBtn) {
            testBtn.disabled = true;
            testBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Sending...';
        }
        
        // Send test email
        const result = await settings.testEmail();
        
        if (result && result.success) {
            showToast('✓ Test email sent successfully', 'success');
        } else {
            throw new Error(result?.message || 'Failed to send test email');
        }
    } catch (error) {
        console.error('Error testing email settings:', error);
        showToast(`✗ ${error.message || 'Failed to send test email. Please check your settings.'}`, 'danger');
    } finally {
        // Restore button state
        if (testBtn) {
            testBtn.disabled = false;
            testBtn.innerHTML = originalBtnText || 'Test Email Settings';
        }
    }
}

// Toggle between light and dark theme
function toggleTheme() {
    const isDark = document.getElementById('themeToggle').checked;
    const theme = isDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-bs-theme', theme);
    
    // Save theme preference
    const settingsData = {
        general: {
            theme: theme
        }
    };
    
    // Save theme preference in the background
    settings.save(settingsData).catch(error => {
        console.error('Error saving theme preference:', error);
    });
}

// Create a backup of the database
async function createBackup() {
    try {
        await settings.backup();
        showToast('Backup created successfully', 'success');
    } catch (error) {
        console.error('Error creating backup:', error);
        showToast('Failed to create backup: ' + (error.message || 'Unknown error'), 'danger');
    }
}

// Restore database from a backup
async function restoreBackup() {
    try {
        const confirmed = confirm('Are you sure you want to restore from a backup? This will overwrite your current data.');
        if (!confirmed) return;
        
        showToast('Please select a backup file to restore from', 'info');
        await settings.restore();
        showToast('Database restored successfully. Please restart the application.', 'success');
    } catch (error) {
        console.error('Error restoring backup:', error);
        showToast('Failed to restore backup: ' + (error.message || 'Unknown error'), 'danger');
    }
}

// Check for application updates
async function checkForUpdates() {
    try {
        const updateStatus = document.getElementById('updateStatus');
        if (!updateStatus) return;
        
        updateStatus.innerHTML = '<div class="alert alert-info">Checking for updates...</div>';
        
        const updateInfo = await system.checkForUpdates();
        
        if (updateInfo.updateAvailable) {
            updateStatus.innerHTML = `
                <div class="alert alert-info">
                    Version ${updateInfo.version} is available! 
                    <button class="btn btn-sm btn-primary ms-2" onclick="installUpdate()">
                        Install Update
                    </button>
                </div>
            `;
        } else {
            updateStatus.innerHTML = '<div class="alert alert-success">You are using the latest version</div>';
        }
    } catch (error) {
        console.error('Error checking for updates:', error);
        const updateStatus = document.getElementById('updateStatus');
        if (updateStatus) {
            updateStatus.innerHTML = '<div class="alert alert-warning">Failed to check for updates</div>';
        }
        showToast('Failed to check for updates: ' + (error.message || 'Unknown error'), 'danger');
    }
}

// Install available update
async function installUpdate() {
    try {
        const updateStatus = document.getElementById('updateStatus');
        if (updateStatus) {
            updateStatus.innerHTML = '<div class="alert alert-info">Downloading update...</div>';
        }
        
        await system.installUpdate();
        
        if (updateStatus) {
            updateStatus.innerHTML = '<div class="alert alert-success">Update downloaded. Restart the application to apply updates.</div>';
        }
        
        showToast('Update downloaded. Please restart the application.', 'success');
    } catch (error) {
        console.error('Error installing update:', error);
        const updateStatus = document.getElementById('updateStatus');
        if (updateStatus) {
            updateStatus.innerHTML = '<div class="alert alert-danger">Failed to install update: ' + (error.message || 'Unknown error') + '</div>';
        }
        showToast('Failed to install update: ' + (error.message || 'Unknown error'), 'danger');
    }
}

// Email validation helper functions
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
}

function validatePort(port) {
    const portNum = parseInt(port, 10);
    return !isNaN(portNum) && portNum > 0 && portNum <= 65535;
}

// Setup password visibility toggle
function setupPasswordToggle(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    const wrapper = input.parentElement;
    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'btn btn-outline-secondary';
    toggleBtn.innerHTML = '<i class="fas fa-eye"></i>';
    toggleBtn.style.position = 'absolute';
    toggleBtn.style.right = '5px';
    toggleBtn.style.top = '50%';
    toggleBtn.style.transform = 'translateY(-50%)';
    toggleBtn.style.border = 'none';
    toggleBtn.style.background = 'transparent';
    
    wrapper.style.position = 'relative';
    wrapper.style.paddingRight = '35px';
    
    toggleBtn.addEventListener('click', () => {
        const type = input.type === 'password' ? 'text' : 'password';
        input.type = type;
        toggleBtn.innerHTML = type === 'password' ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
    });
    
    wrapper.appendChild(toggleBtn);
}

// Setup email validation
function setupEmailValidation() {
    const form = document.getElementById('emailSettingsForm');
    if (!form) return;
    
    const validateField = (input, validator, errorMessage) => {
        const isValid = validator(input.value);
        const feedback = input.nextElementSibling;
        
        if (isValid) {
            input.classList.remove('is-invalid');
            input.classList.add('is-valid');
            if (feedback) feedback.style.display = 'none';
        } else {
            input.classList.remove('is-valid');
            input.classList.add('is-invalid');
            if (feedback) {
                feedback.textContent = errorMessage;
                feedback.style.display = 'block';
            }
        }
        
        return isValid;
    };
    
    // Real-time validation
    const smtpHost = document.getElementById('smtpHost');
    const smtpPort = document.getElementById('smtpPort');
    const smtpUser = document.getElementById('smtpUser');
    const fromEmail = document.getElementById('fromEmail');
    
    if (smtpHost) {
        smtpHost.addEventListener('input', () => {
            validateField(smtpHost, val => val.trim().length > 0, 'SMTP host is required');
        });
    }
    
    if (smtpPort) {
        smtpPort.addEventListener('input', () => {
            validateField(smtpPort, validatePort, 'Invalid port number (1-65535)');
        });
    }
    
    if (smtpUser) {
        smtpUser.addEventListener('input', () => {
            validateField(smtpUser, val => val.trim().length > 0, 'SMTP username is required');
        });
    }
    
    if (fromEmail) {
        fromEmail.addEventListener('input', () => {
            validateField(fromEmail, validateEmail, 'Please enter a valid email address');
        });
    }
}

// Validate all email settings
function validateEmailSettings() {
    let isValid = true;
    const smtpHost = document.getElementById('smtpHost');
    const smtpPort = document.getElementById('smtpPort');
    const smtpUser = document.getElementById('smtpUser');
    const fromEmail = document.getElementById('fromEmail');
    
    if (smtpHost && !validateField(smtpHost, val => val.trim().length > 0, 'SMTP host is required')) {
        isValid = false;
    }
    
    if (smtpPort && !validateField(smtpPort, val => validatePort(val), 'Invalid port number (1-65535)')) {
        isValid = false;
    }
    
    if (smtpUser && !validateField(smtpUser, val => val.trim().length > 0, 'SMTP username is required')) {
        isValid = false;
    }
    
    if (fromEmail && !validateField(fromEmail, val => validateEmail(val), 'Please enter a valid email address')) {
        isValid = false;
    }
    
    return isValid;
}

// Helper function to validate a single field
function validateField(input, validator, errorMessage) {
    if (!input) return true; // Skip if element doesn't exist
    
    const isValid = validator(input.value);
    const feedback = input.nextElementSibling;
    
    if (isValid) {
        input.classList.remove('is-invalid');
        input.classList.add('is-valid');
        if (feedback) feedback.style.display = 'none';
    } else {
        input.classList.remove('is-valid');
        input.classList.add('is-invalid');
        if (feedback) {
            feedback.textContent = errorMessage;
            feedback.style.display = 'block';
        }
    }
    
    return isValid;
}
// Export functions that need to be available globally
window.toggleTheme = toggleTheme;
window.saveSettings = saveSettings;
window.testEmailSettings = testEmailSettings;
window.createBackup = createBackup;
window.restoreBackup = restoreBackup;
window.checkForUpdates = checkForUpdates;
window.installUpdate = installUpdate;

// Core navigation functionality
import { showToast } from './utils.js';
import { state } from './state.js';

// Current page state
let currentPage = 'dashboard';
let isInitialized = false;

// Initialize navigation
function setupNavigation() {
    if (isInitialized) {
        console.log('Navigation already initialized');
        return;
    }
    
    console.log('Initializing navigation...');
    
    // Set up navigation items
    document.addEventListener('click', (e) => {
        // Handle nav items
        const navItem = e.target.closest('.nav-item[data-page]');
        if (navItem) {
            e.preventDefault();
            const page = navItem.getAttribute('data-page');
            if (page) {
                navigateTo(page);
            }
            return;
        }
        
        // Handle back buttons
        const backButton = e.target.closest('.back-button');
        if (backButton) {
            e.preventDefault();
            const target = backButton.getAttribute('data-target');
            if (target) {
                navigateTo(target);
            } else {
                console.warn('Back button has no data-target attribute');
            }
            return;
        }
        
        // Handle export buttons
        const exportBtn = e.target.closest('.export-excel-btn');
        if (exportBtn) {
            e.preventDefault();
            const action = exportBtn.getAttribute('data-action');
            if (action === 'export-sales-excel') {
                // Import the function dynamically when needed
                import('../pages/reports.js').then(module => {
                    if (module.exportSalesToExcel) {
                        module.exportSalesToExcel();
                    } else {
                        console.error('exportSalesToExcel function not found in reports module');
                    }
                }).catch(error => {
                    console.error('Error loading reports module:', error);
                });
            }
            return;
        }
    });
    
    // Handle browser back/forward
    window.addEventListener('popstate', handlePopState);
    
    // Mark as initialized
    isInitialized = true;
    console.log('Navigation initialized');
}

// Navigate to a specific page
async function navigateTo(pageName, data = {}) {
    try {
        // If called with event object, get pageName from the element's data-page attribute
        if (pageName && pageName.target) {
            const element = pageName.target;
            pageName = element.getAttribute('data-page') || element.closest('[data-page]')?.getAttribute('data-page');
            if (!pageName) {
                console.error('No page specified for navigation');
                return;
            }
        }

        console.log(`Navigating to: ${pageName}`);
        
        // Handle page name variations (e.g., 'dashboard' vs 'dashboard-page')
        const pageVariations = [pageName, `${pageName}`, `#${pageName}`];
        
        // Simple page switching - hide all pages, show target
        const pages = document.querySelectorAll('.page');
        if (pages.length === 0) {
            console.error('No .page elements found');
            return;
        }
        
        // Hide all pages
        pages.forEach(el => {
            el.classList.remove('active');
        });
        
        // Try to find the target page with variations
        let targetPage = null;
        let actualPageName = pageName;
        
        for (const variation of pageVariations) {
            // Remove # if present for ID lookup
            const cleanVariation = variation.startsWith('#') ? variation.substring(1) : variation;
            const pageId = cleanVariation.endsWith('-page') ? cleanVariation : `${cleanVariation}-page`;
            targetPage = document.getElementById(pageId);
            if (targetPage) {
                actualPageName = cleanVariation.endsWith('-page') ? cleanVariation.replace('-page', '') : cleanVariation;
                break;
            }
        }
        
        if (targetPage) {
            targetPage.classList.add('active');
            console.log(`Successfully navigated to ${actualPageName}`);
            
            // Update URL if we're not handling a hash change
            if (window.location.hash !== `#${actualPageName}`) {
                window.history.pushState({ page: actualPageName }, '', `#${actualPageName}`);
            }
            
            // Update current page
            currentPage = actualPageName;
            
            // Update active navigation
            updateActiveNav(actualPageName);
            
            // Save to state if available
            if (state && state.set) {
                state.set('currentPage', actualPageName);
            }
        } else {
            console.error(`Page not found. Tried: ${pageVariations.join(', ')}`);
        }
    } catch (error) {
        console.error('Navigation error:', error);
        if (showToast) {
            showToast(`Failed to navigate to ${pageName}`, 'danger');
        }
    }
}

// Make navigateTo available globally for HTML onclick handlers
window.navigateTo = navigateTo;

// Update active navigation item
function updateActiveNav(pageName) {
    document.querySelectorAll('.nav-item').forEach(item => {
        if (item.getAttribute('data-page') === pageName) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

// Show the specified page
async function showPage(pageName, data = {}) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Show the target page
    const pageElement = document.getElementById(`${pageName}-page`);
    if (pageElement) {
        pageElement.classList.add('active');
        
        // Load page-specific module if it exists
        try {
            const pageModule = await import(`../pages/${pageName}.js`);
            if (typeof pageModule.init === 'function') {
                await pageModule.init(data);
            }
        } catch (error) {
            console.error(`Error initializing ${pageName} page:`, error);
        }
    } else {
        throw new Error(`Page ${pageName} not found`);
    }
}

// Handle browser back/forward
function handlePopState(event) {
    if (event.state && event.state.page) {
        navigateTo(event.state.page);
    }
}

// Get current page
function getCurrentPage() {
    return currentPage;
}

export {
    setupNavigation,
    navigateTo,
    getCurrentPage
};

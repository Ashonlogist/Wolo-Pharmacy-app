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
            
            // Play page transition sound
            if (window.soundManager && currentPage !== actualPageName) {
                try {
                    window.soundManager.playPageTransition();
                } catch (error) {
                    // Ignore sound errors
                }
            }
            
            // Update URL if we're not handling a hash change
            if (window.location.hash !== `#${actualPageName}`) {
                window.history.pushState({ page: actualPageName }, '', `#${actualPageName}`);
            }
            
            // Update current page
            currentPage = actualPageName;
            
            // Update active navigation
            updateActiveNav(actualPageName);
            
            // Update page headers with shop name when navigating
            if (typeof window.updatePageHeadersWithShopName === 'function') {
                await window.updatePageHeadersWithShopName();
            }
            
            // Re-initialize undo/redo buttons when navigating (in case buttons were recreated)
            if (typeof window.initUndoRedo === 'function') {
                window.initUndoRedo();
            }
            
            // Save to state if available
            if (state && state.set) {
                state.set('currentPage', actualPageName);
            }
            
            // Initialize page-specific functionality if needed
            // This ensures pages refresh when navigated to
            try {
                switch(actualPageName) {
                    case 'dashboard':
                        // Only refresh dashboard data, don't re-initialize button (it's already initialized)
                        // This prevents infinite loops
                        if (typeof window.refreshDashboard === 'function') {
                            // Use a small delay to prevent multiple rapid calls
                            setTimeout(() => {
                                window.refreshDashboard(false).catch(err => {
                                    console.error('Error refreshing dashboard:', err);
                                });
                            }, 100);
                        }
                        break;
                    case 'products':
                        // Re-populate category filter when navigating to products page
                        if (typeof window.loadProducts === 'function') {
                            window.loadProducts();
                        } else {
                            // If loadProducts is not available, try to update category filter directly
                            setTimeout(async () => {
                                if (typeof window.updateCategoryFilter === 'function') {
                                    await window.updateCategoryFilter();
                                }
                            }, 200);
                        }
                        break;
                    case 'sales':
                        // Re-populate product dropdown when navigating to sales page
                        // Wait a bit to ensure the page is visible
                        await new Promise(resolve => setTimeout(resolve, 100));
                        if (typeof window.populateProductDropdown === 'function') {
                            await window.populateProductDropdown();
                        } else {
                            // Try to import and call from sales.js module
                            try {
                                const salesModule = await import(`../pages/sales.js`);
                                if (salesModule && typeof salesModule.populateProductDropdown === 'function') {
                                    await salesModule.populateProductDropdown();
                                }
                            } catch (err) {
                                console.warn('Could not populate sales product dropdown:', err);
                            }
                        }
                        break;
                    case 'reports':
                        // Reports page will auto-initialize on load
                        break;
                    case 'settings':
                        // Settings page will auto-initialize on load
                        break;
                    case 'product-form':
                    case 'add-product':
                        // Reload categories and suppliers when navigating to product form
                        // Wait a bit to ensure the page is visible
                        await new Promise(resolve => setTimeout(resolve, 100));
                        if (typeof window.loadInitialData === 'function') {
                            await window.loadInitialData();
                        }
                        break;
                }
            } catch (error) {
                console.warn(`Error initializing ${actualPageName} page:`, error);
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

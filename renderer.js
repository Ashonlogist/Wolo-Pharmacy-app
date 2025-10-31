// Application initialization
console.log('Application initializing...');

// Import functions from other modules
import { exportSalesToExcel } from './pages/reports.js';

// Check if jQuery is available
if (typeof jQuery === 'undefined') {
    console.error('jQuery is not loaded. The application may not work correctly.');
} else {
    console.log('jQuery version:', jQuery.fn.jquery);
    
    // Initialize the application when DOM is ready
    document.addEventListener('DOMContentLoaded', async () => {
        try {
            // Initialize the application
            await initApp();
            
            // Navigation is handled by the navigation module
            console.log('Renderer initialized');
        } catch (error) {
            console.error('Error initializing application:', error);
        }
    });
}

// Core Modules
let setupNavigation, navigateTo, state, initState, initEvents, showToast, products, sales, reports, settings, system;

// Try to get core modules from window.app if available
function loadCoreModules() {
    return new Promise((resolve) => {
        // Check if we have the core modules in window.app
        if (window.app) {
            setupNavigation = window.app.setupNavigation || function() { console.warn('setupNavigation not available'); };
            navigateTo = window.app.navigateTo || function() { console.warn('navigateTo not available'); };
            state = window.app.state || {};
            initState = window.app.initState || function() { console.warn('initState not available'); };
            initEvents = window.app.initEvents || function() { console.warn('initEvents not available'); };
            showToast = window.app.showToast || function(message, type) { console.log(`[${type}] ${message}`); };
            products = window.app.products || {};
            sales = window.app.sales || {};
            reports = window.app.reports || {};
            settings = window.app.settings || {};
            system = window.app.system || {};
            resolve();
        } else {
            console.warn('window.app not available, trying to load modules directly');
            // Fallback to direct loading if window.app is not available
            Promise.all([
                import('./core/navigation.js'),
                import('./core/state.js'),
                import('./core/events.js'),
                import('./core/utils.js'),
                import('./core/api.js')
            ]).then(([navModule, stateModule, eventsModule, utilsModule, apiModule]) => {
                setupNavigation = navModule.setupNavigation;
                navigateTo = navModule.navigateTo;
                state = stateModule.state;
                initState = stateModule.initState;
                initEvents = eventsModule.initEvents;
                showToast = utilsModule.showToast;
                products = apiModule.products || {};
                sales = apiModule.sales || {};
                reports = apiModule.reports || {};
                settings = apiModule.settings || {};
                system = apiModule.system || {};
                resolve();
            }).catch(error => {
                console.error('Error loading core modules:', error);
                // Initialize with empty functions to prevent further errors
                setupNavigation = function() {};
                navigateTo = function() {};
                state = {};
                initState = function() {};
                initEvents = function() {};
                showToast = function(message, type) { console.log(`[${type}] ${message}`); };
                products = {};
                sales = {};
                reports = {};
                settings = {};
                system = {};
                resolve();
            });
        }
    });
}

// Check if Electron API is available
function isElectronAvailable() {
    try {
        return !!(window.electron && window.electron.ipcRenderer);
    } catch (error) {
        console.warn('Error checking Electron API availability:', error);
        return false;
    }
}

// Check if we're in development mode
const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// Initialize the application
async function initApp() {
    try {
        console.log('Initializing application...');
        
        // Load core modules first
        await loadCoreModules();
        
        // Initialize core modules
        console.log('Initializing state...');
        if (typeof initState === 'function') {
            await initState().catch(err => {
                console.error('Error initializing state:', err);
            });
        } else {
            console.warn('initState is not a function');
        }
        
        console.log('Initializing events...');
        if (typeof initEvents === 'function') {
            try {
                initEvents();
            } catch (err) {
                console.error('Error initializing events:', err);
            }
        } else {
            console.warn('initEvents is not a function');
        }
        
        // Setup navigation
        console.log('Setting up navigation...');
        if (typeof setupNavigation === 'function') {
            try {
                setupNavigation();
            } catch (err) {
                console.error('Error setting up navigation:', err);
            }
        } else {
            console.warn('setupNavigation is not a function');
        }
        
        // Initialize UI components
        console.log('Initializing UI...');
        if (typeof initializeUI === 'function') {
            try {
                initializeUI();
            } catch (err) {
                console.error('Error initializing UI:', err);
            }
        } else {
            console.warn('initializeUI is not a function');
        }
        
        // Show appropriate status message
        if (isElectronAvailable()) {
            console.log('Running in Electron environment');
            if (typeof showToast === 'function') {
                showToast('Welcome to Wolo Inventory Management', 'success');
            } else {
                console.log('Welcome to Wolo Inventory Management');
            }
        } else {
            const errorMsg = 'Electron API not available. This application must run inside Electron.';
            console.error(errorMsg);
            if (typeof showToast === 'function') {
                showToast('Application error: Required features not available', 'danger');
            }
            return;
        }
        
        // Load initial data
        console.log('Loading initial data...');
        if (typeof loadInitialData === 'function') {
            try {
                await loadInitialData();
            } catch (err) {
                console.error('Error loading initial data:', err);
            }
        } else {
            console.warn('loadInitialData is not a function');
        }
        
        // Navigate to the current page or dashboard
        const currentPage = window.location.hash.substring(1) || 'dashboard';
        console.log('Navigating to:', currentPage);
        if (typeof navigateTo === 'function') {
            try {
                await navigateTo(currentPage);
            } catch (err) {
                console.error('Error navigating to page:', err);
            }
        } else {
            console.warn('navigateTo is not a function');
        }
    } catch (error) {
        console.error('Failed to initialize application:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        showToast(`Failed to initialize: ${errorMessage}`, 'danger');
    }
}

// Development-only initialization removed. The app must run inside Electron with real backend IPC.

// Load initial application data
async function loadInitialData() {
    try {
        // Load initial data needed across the app
        const [products, settings] = await Promise.all([
            window.app.products.getAll().catch(() => []),
            window.app.settings.get().catch(() => ({}))
        ]);
        
        // Update global state
        window.appState = {
            products,
            settings,
            isLoading: false
        };
        
        // Update UI
        updateUI();
        
        return { products, settings };
    } catch (error) {
        console.error('Error loading initial data:', error);
        // Don't throw the error to prevent app from crashing
        return { products: [], settings: {} };
    }
}

// Initialize UI components
function initializeUI() {
    // Initialize date pickers
    const dateInputs = document.querySelectorAll('input[type="date"]');
    const today = new Date().toISOString().split('T')[0];
    
    dateInputs.forEach(input => {
        if (!input.value) {
            input.value = today;
        }
        
        // Set min/max dates if needed
        if (input.id === 'startDate' || input.id === 'exportStartDate') {
            input.max = today;
        }
        
        if (input.id === 'endDate' || input.id === 'exportEndDate') {
            input.max = today;
        }
    });

    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));

    // Initialize popovers
    const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
    popoverTriggerList.map(popoverTriggerEl => new bootstrap.Popover(popoverTriggerEl));

    // Initialize modals
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modalEl => {
        modalEl.addEventListener('hidden.bs.modal', () => {
            const form = modalEl.querySelector('form');
            if (form) form.reset();
        });
    });
}

// Global variables
let allProducts = [];
let filteredProducts = [];
let productNameSuggestions = [];

// Load products from database using Electron IPC
async function loadProducts() {
    try {
        console.log('Loading products...');
        if (!window.electron || !window.electron.ipcRenderer) {
            throw new Error('Electron IPC is not available');
        }
        
        // Show loading state
        const productsTable = document.getElementById('productsTable');
        if (productsTable) {
            productsTable.innerHTML = '<tr><td colspan="10" class="text-center py-4"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></td></tr>';
        }
        
        // Use Electron's IPC to get products from the main process
        const products = await window.electron.ipcRenderer.invoke('get-products');
        allProducts = Array.isArray(products) ? products : [];
        filteredProducts = [...allProducts];
        
        // Update the UI
        renderProductsTable();
        updateProductSuggestions();
        updateCategoryFilter();
        
        console.log('Products loaded successfully:', allProducts.length);
        return allProducts;
    } catch (error) {
        console.error('Error loading products:', error);
        showToast('Failed to load products. Please try again.', 'danger');
        
        // Show error state in table
        const productsTable = document.getElementById('productsTable');
        if (productsTable) {
            productsTable.innerHTML = `
                <tr>
                    <td colspan="10" class="text-center py-4 text-danger">
                        <i class="bi bi-exclamation-triangle-fill me-2"></i>
                        Failed to load products. Please try again.
                        <button class="btn btn-sm btn-outline-primary ms-3" onclick="loadProducts()">
                            <i class="bi bi-arrow-clockwise"></i> Retry
                        </button>
                    </td>
                </tr>`;
        }
        
        return [];
    }
}

// Import products from file
async function importProducts(file) {
    try {
        console.log('Importing products from file:', file.name);
        
        // Show loading state
        const importBtn = document.getElementById('processImport');
        const originalBtnText = importBtn.innerHTML;
        importBtn.disabled = true;
        importBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Importing...';
        
        // Read file content
        const fileContent = await readFileContent(file);
        
        // Parse file based on type
        let products = [];
        const fileExt = file.name.split('.').pop().toLowerCase();
        
        if (fileExt === 'csv') {
            products = parseCSV(fileContent);
        } else if (['xlsx', 'xls'].includes(fileExt)) {
            products = await parseExcel(fileContent, file);
        } else {
            throw new Error('Unsupported file format');
        }
        
        if (!Array.isArray(products) || products.length === 0) {
            throw new Error('No valid products found in the file');
        }
        
        console.log(`Found ${products.length} products to import`);
        
        // Validate products
        const validProducts = [];
        const errors = [];
        
        products.forEach((product, index) => {
            const rowNum = index + 2; // +2 for 1-based index and header row
            
            // Basic validation
            if (!product.name) {
                errors.push(`Row ${rowNum}: Product name is required`);
                return;
            }
            
            // Convert numeric fields
            const processedProduct = {
                name: String(product.name || '').trim(),
                description: String(product.description || '').trim(),
                category: String(product.category || '').trim(),
                barcode: String(product.barcode || '').trim(),
                quantityInStock: parseInt(product.quantityInStock || 0, 10),
                reorderLevel: parseInt(product.reorderLevel || 0, 10),
                purchasePrice: parseFloat(product.purchasePrice || 0),
                sellingPrice: parseFloat(product.sellingPrice || 0),
                expiryDate: product.expiryDate || null,
                supplier: product.supplier || '',
                notes: product.notes || ''
            };
            
            // Additional validation
            if (isNaN(processedProduct.quantityInStock)) {
                errors.push(`Row ${rowNum}: Invalid quantity in stock`);
                return;
            }
            
            if (isNaN(processedProduct.purchasePrice) || processedProduct.purchasePrice < 0) {
                errors.push(`Row ${rowNum}: Invalid purchase price`);
                return;
            }
            
            if (isNaN(processedProduct.sellingPrice) || processedProduct.sellingPrice < 0) {
                errors.push(`Row ${rowNum}: Invalid selling price`);
                return;
            }
            
            validProducts.push(processedProduct);
        });
        
        // Show errors if any
        if (errors.length > 0) {
            const errorMessage = `Found ${errors.length} validation error(s):\n\n${errors.slice(0, 10).join('\n')}${errors.length > 10 ? '\n...and ' + (errors.length - 10) + ' more' : ''}`;
            
            if (window.electron && window.electron.ipcRenderer) {
                await window.electron.ipcRenderer.invoke('show-message-box', {
                    type: 'warning',
                    title: 'Import Validation Errors',
                    message: 'Some products could not be imported due to validation errors.',
                    detail: errorMessage,
                    buttons: ['Continue Anyway', 'Cancel'],
                    defaultId: 1,
                    cancelId: 1
                }).then(({ response }) => {
                    if (response === 1) { // Cancel
                        throw new Error('Import cancelled due to validation errors');
                    }
                });
            } else {
                // Fallback for browser
                if (!confirm(`Found ${errors.length} validation errors. Continue with import?\n\n${errorMessage}`)) {
                    throw new Error('Import cancelled due to validation errors');
                }
            }
        }
        
        if (validProducts.length === 0) {
            throw new Error('No valid products to import');
        }
        
        // Save products to database
        console.log(`Importing ${validProducts.length} valid products...`);
        
        // Use IPC to save products in main process
        const result = await window.electron.ipcRenderer.invoke('import-products', validProducts);
        
        if (result && result.success) {
            showToast(`Successfully imported ${result.insertedCount} products`, 'success');
            
            // Close the modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('importProductsModal'));
            if (modal) {
                modal.hide();
            }
            
            // Refresh products list
            await loadProducts();
        } else {
            throw new Error(result?.error || 'Failed to import products');
        }
        
        return result;
    } catch (error) {
        console.error('Error importing products:', error);
        showToast(`Import failed: ${error.message}`, 'danger');
        throw error;
    } finally {
        // Reset button state
        const importBtn = document.getElementById('processImport');
        if (importBtn) {
            importBtn.disabled = false;
            importBtn.innerHTML = originalBtnText || 'Import';
        }
    }
}

// Helper function to read file content
function readFileContent(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (event) => {
            resolve(event.target.result);
        };
        
        reader.onerror = (error) => {
            reject(new Error('Error reading file'));
        };
        
        if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
            reader.readAsText(file);
        } else {
            reader.readAsArrayBuffer(file);
        }
    });
}

// Parse CSV content
function parseCSV(csvContent) {
    // Simple CSV parser - consider using a library like PapaParse for more complex CSV
    const lines = csvContent.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const products = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        if (values.length < headers.length) continue;
        
        const product = {};
        headers.forEach((header, index) => {
            product[header] = values[index] ? values[index].trim() : '';
        });
        
        products.push(product);
    }
    
    return products;
}

// Parse Excel content
async function parseExcel(fileContent, file) {
    // In a real app, you would use a library like xlsx
    // This is a simplified example
    console.warn('Excel import requires additional libraries. Using mock data.');
    
    // In a real implementation, you would use the xlsx library:
    // const workbook = XLSX.read(fileContent, { type: 'array' });
    // const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    // return XLSX.utils.sheet_to_json(firstSheet);
    
    // For now, return an empty array
    return [];
}

// Initialize drag and drop
function initializeDragAndDrop() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const processBtn = document.getElementById('processImport');
    
    if (!dropZone || !fileInput) return;
    
    // Handle drag and drop events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });
    
    // Handle file drop
    dropZone.addEventListener('drop', handleDrop, false);
    
    // Handle click to select files
    dropZone.addEventListener('click', () => fileInput.click());
    
    // Handle file selection
    fileInput.addEventListener('change', handleFileSelect, false);
    
    // Handle process button click
    if (processBtn) {
        processBtn.addEventListener('click', handleProcessImport);
    }
    
    // Handle template download
    const downloadTemplate = document.getElementById('downloadTemplate');
    if (downloadTemplate) {
        downloadTemplate.addEventListener('click', (e) => {
            e.preventDefault();
            downloadCSVTemplate();
        });
    }
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    function highlight() {
        dropZone.classList.add('highlight');
    }
    
    function unhighlight() {
        dropZone.classList.remove('highlight');
    }
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }
    
    function handleFileSelect(e) {
        const files = e.target.files;
        handleFiles(files);
    }
    
    function handleFiles(files) {
        if (!files || files.length === 0) return;
        
        // Only process the first file for now
        const file = files[0];
        const fileExt = file.name.split('.').pop().toLowerCase();
        
        // Validate file type
        if (!['csv', 'xlsx', 'xls'].includes(fileExt)) {
            showToast('Invalid file type. Please upload a CSV or Excel file.', 'danger');
            return;
        }
        
        // Update UI
        const fileName = file.name.length > 30 ? file.name.substring(0, 27) + '...' : file.name;
        dropZone.innerHTML = `
            <i class="bi bi-file-earmark-text fs-1"></i>
            <p class="mt-2 mb-1">${fileName}</p>
            <p class="small text-muted">${formatFileSize(file.size)} • ${fileExt.toUpperCase()}</p>
            <button class="btn btn-sm btn-outline-secondary mt-2" onclick="event.stopPropagation(); document.getElementById('file-input').value = ''; initializeDragAndrop();">
                Change File
            </button>
        `;
        
        // Enable process button
        if (processBtn) {
            processBtn.disabled = false;
        }
    }
    
    async function handleProcessImport() {
        const files = fileInput.files;
        if (!files || files.length === 0) {
            showToast('Please select a file to import', 'warning');
            return;
        }
        
        try {
            await importProducts(files[0]);
        } catch (error) {
            console.error('Import error:', error);
            // Error is already handled in importProducts
        }
    }
    
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Download CSV template
function downloadCSVTemplate() {
    const headers = [
        'name', 'description', 'category', 'barcode', 
        'quantityInStock', 'reorderLevel', 'purchasePrice', 
        'sellingPrice', 'expiryDate', 'supplier', 'notes'
    ];
    
    // Create CSV content
    let csvContent = headers.join(',') + '\n';
    
    // Add example row
    const exampleRow = [
        'Paracetamol 500mg', 
        'Pain reliever and fever reducer', 
        'Pain Relief', 
        '123456789012', 
        '100', 
        '10', 
        '5.99', 
        '9.99', 
        '2025-12-31', 
        'ABC Pharmaceuticals', 
        'Store in a cool, dry place'
    ];
    
    csvContent += exampleRow.join(',');
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'product_import_template.csv');
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Initialize drag and drop when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeDragAndDrop();
    
    // Add event listener for modal show event to reset the form
    const importModal = document.getElementById('importProductsModal');
    if (importModal) {
        importModal.addEventListener('show.bs.modal', () => {
            // Reset file input
            const fileInput = document.getElementById('file-input');
            if (fileInput) {
                fileInput.value = '';
            }
            
            // Reset drop zone
            const dropZone = document.getElementById('drop-zone');
            if (dropZone) {
                dropZone.innerHTML = `
                    <i class="bi bi-cloud-arrow-up fs-1"></i>
                    <p class="mt-2 mb-1">Drag and drop files here</p>
                    <p class="small text-muted">or</p>
                    <button class="btn btn-outline-primary">Select Files</button>
                    <input type="file" id="file-input" class="d-none" accept=".csv,.xlsx,.xls">
                `;
                
                // Re-initialize event listeners
                initializeDragAndDrop();
            }
            
            // Disable process button
            const processBtn = document.getElementById('processImport');
            if (processBtn) {
                processBtn.disabled = true;
            }
        });
    }
});

// Filter products - implementation is at line 1641

// editProduct implementation is at line 1731

// deleteProduct implementation is at line 1775

// updateProduct implementation is at line 1792

// resetForm implementation is at line 1784

// exportSalesToExcel implementation is at line 1785

// Load today's sales
async function loadTodaysSales() {
    const today = new Date().toISOString().split('T')[0];
    await loadSalesByDateRange(today, today);
}

// Load sales by date range - implementation is below

// Global variable to store sales data
let salesData = [];

// Check if running in Electron
const isElectron = typeof window !== 'undefined' && window.process && window.process.type === 'renderer';

// Simple toast notification function if not available
if (typeof showToast !== 'function') {
    window.showToast = function(message, type = 'info') {
        console.log(`[${type}] ${message}`);
        // Create a simple notification if no toast library is available
        const toast = document.createElement('div');
        toast.className = `alert alert-${type} position-fixed bottom-0 end-0 m-3`;
        toast.style.zIndex = '9999';
        toast.role = 'alert';
        toast.textContent = message;
        document.body.appendChild(toast);
            
        // Auto-remove after 3 seconds
        setTimeout(() => {
            toast.remove();
        }, 3000);
    };
}

// Render sales table
function renderSalesTable(sales) {
    const tableBody = document.getElementById('salesTableBody');
    if (!tableBody) return;

    // Clear existing rows
    tableBody.innerHTML = '';

    if (!sales || sales.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="text-center">No sales data available</td></tr>';
        return;
    }

    // Add rows for each sale
    sales.forEach(sale => {
        const row = document.createElement('tr');
            
        // Format date
        const saleDate = new Date(sale.saleDate);
        const formattedDate = saleDate.toLocaleDateString();
            
        // Calculate total
        const total = sale.items ? sale.items.reduce((sum, item) => sum + (item.quantity * (item.price || 0)), 0) : 0;
        const itemCount = sale.items ? sale.items.length : 0;
            
        row.innerHTML = `
            <td>${sale.invoiceNumber || 'N/A'}</td>
            <td>${formattedDate}</td>
            <td>${sale.customerName || 'Walk-in Customer'}</td>
            <td>${itemCount}</td>
            <td>${total.toFixed(2)}</td>
            <td>${sale.paymentMethod || 'Cash'}</td>
            <td>
                <button class="btn btn-sm btn-primary" data-action="view-sale" data-sale-id="${sale._id || ''}">
                    <i class="bi bi-eye"></i> View
                </button>
                <button class="btn btn-sm btn-danger" data-action="delete-sale" data-sale-id="${sale._id || ''}">
                    <i class="bi bi-trash"></i> Delete
                </button>
            </td>
        `;
            
        tableBody.appendChild(row);
    });
}

// Mock data for non-Electron environment
const mockSalesData = [
    {
        _id: '1',
        invoiceNumber: 'INV-001',
        saleDate: new Date().toISOString(),
        customerName: 'Walk-in Customer',
        items: [
            { name: 'Product 1', quantity: 2, price: 10.99 },
            { name: 'Product 2', quantity: 1, price: 24.99 }
        ],
        paymentMethod: 'Cash'
    },
    // Add more mock data as needed
];

// Update loadSalesByDateRange to work in both Electron and browser environments
async function loadSalesByDateRange(startDate = null, endDate = null) {
    try {
        // Show loading state
        const tableBody = document.getElementById('salesTableBody');
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="7" class="text-center">Loading sales data...</td></tr>';
        }

        // If no dates provided, default to last 30 days
        if (!startDate || !endDate) {
            const today = new Date();
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(today.getDate() - 30);
                
            startDate = thirtyDaysAgo.toISOString().split('T')[0];
            endDate = today.toISOString().split('T')[0];
                
            // Update the date inputs if they exist
            const startInput = document.getElementById('startDate');
            const endInput = document.getElementById('endDate');
            if (startInput) startInput.value = startDate;
            if (endInput) endInput.value = endDate;
        }
            
        let sales = [];
            
        if (isElectron && window.ipcRenderer) {
            // In Electron, use IPC to get sales data
            sales = await window.ipcRenderer.invoke('get-sales-by-date-range', {
                startDate,
                endDate
            });
        } else {
            // In browser, use mock data or API call
            console.log('Running in browser mode - using mock sales data');
            // Simulate API delay
            await new Promise(resolve => setTimeout(resolve, 500));
            sales = mockSalesData;
        }
            
        if (sales && Array.isArray(sales)) {
            salesData = sales; // Store in global variable
            renderSalesTable(salesData);
            return sales;
        } else {
            throw new Error('Invalid sales data received');
        }
    } catch (error) {
        console.error('Error loading sales by date range:', error);
            
        // Show error in table
        const tableBody = document.getElementById('salesTableBody');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-danger">
                        Failed to load sales data. ${isElectron ? '' : 'Running in demo mode.'}
                    </td>
                </tr>
            `;
        }
            
        // Show toast notification if available
        if (window.showToast) {
            window.showToast('Error loading sales data', 'danger');
        }
            
        return [];
    }
}

// Define exportToExcel function and make it globally available
window.exportToExcel = async function() {
    const exportBtn = document.querySelector('button[onclick*="exportToExcel"]');
    const originalBtnText = exportBtn?.innerHTML;
    
    try {
        // Disable button during export
        if (exportBtn) {
            exportBtn.disabled = true;
            exportBtn.innerHTML = 'Exporting...';
        }

        // Check if we're running in Electron
        const isElectron = typeof window !== 'undefined' && window.process && window.process.versions && window.process.versions.electron;
        
        if (isElectron && window.require) {
            // Electron environment
            const { ipcRenderer } = window.require('electron');
            const result = await ipcRenderer.invoke('export-to-excel', {
                products: window.filteredProducts || [],
                filename: `wolo-inventory-${new Date().toISOString().split('T')[0]}.xlsx`
            });
        
            if (result && result.success) {
                if (window.showToast) {
                    window.showToast('Products exported successfully', 'success');
                } else {
                    alert('Products exported successfully!');
                }
            } else {
                throw new Error(result?.message || 'Failed to export products');
            }
        } else {
            // Web environment - try using SheetJS if available
            if (typeof XLSX === 'undefined') {
                throw new Error('Excel export requires SheetJS in web browser. Please include the XLSX library.');
            }
            
            // Get products from the global scope or use an empty array
            const products = window.filteredProducts || [];
            
            // Create a new workbook
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(products);
            
            // Add the worksheet to the workbook
            XLSX.utils.book_append_sheet(wb, ws, 'Products');
            
            // Generate the Excel file
            XLSX.writeFile(wb, `wolo-inventory-${new Date().toISOString().split('T')[0]}.xlsx`);
            
            if (window.showToast) {
                window.showToast('Products exported successfully', 'success');
            } else {
                alert('Products exported successfully!');
            }
        }
    } catch (error) {
        console.error('Error exporting to Excel:', error);
        if (window.showToast) {
            window.showToast(`Export failed: ${error.message}`, 'danger');
        } else {
            alert(`Export failed: ${error.message}`);
        }
    } finally {
        // Re-enable button if it exists
        if (exportBtn) {
            exportBtn.disabled = false;
            exportBtn.innerHTML = originalBtnText?.includes('Export') ? originalBtnText : 'Export to Excel';
        }
    }
};

// Make navigateTo globally available
window.navigateTo = navigateTo;

// Make other functions available through app object
window.app = {
    // Core functions
    navigateTo,
    showToast,
    
    // State and modules
    state,
    products,
    sales,
    reports,
    settings,
    system,
    
    // Product functions
    loadProducts,
    filterProducts,
    saveProduct: async function(productData) {
        // This is a wrapper for the main saveProduct function
        const form = document.getElementById('productForm');
        if (form) {
            const event = { preventDefault: () => {} };
            await saveProduct(event);
        } else {
            console.error('Product form not found');
        }
    },
    editProduct,
    deleteProduct,
    updateProduct,
    resetForm,
    
    // Export functions
    exportToExcel: window.exportToExcel,
    exportSalesToExcel: exportSalesToExcel,
    
    // Sales functions
    loadTodaysSales,
    loadSalesByDateRange,
    handleSaleSubmit,
    renderSalesTable,
    
    // Dashboard functions
    refreshData: async function() {
        try {
            // Check if we're on the dashboard page
            const dashboardPage = document.getElementById('dashboard-page');
            if (dashboardPage && !dashboardPage.classList.contains('active')) {
                return;
            }
            
            // Call the refreshDashboard function if it exists

            if (typeof window.refreshDashboard === 'function') {
                await window.refreshDashboard();
            } else {
                console.warn('refreshDashboard function not found');
            }
        } catch (error) {
            console.error('Error refreshing dashboard:', error);
            showToast('Failed to refresh dashboard', 'error');
        }
    },
    
    // Settings
    loadSettings: async function() {
        try {
            // This would typically load settings from your backend
            const settings = await window.app.api.settings.get();
            
            // Update UI with settings
            if (settings) {
                // Update SMTP settings
                if (settings.smtp) {
                    const smtpForm = document.getElementById('smtpSettingsForm');
                    if (smtpForm) {
                        Object.entries(settings.smtp).forEach(([key, value]) => {
                            const input = smtpForm.querySelector(`[name="smtp.${key}"]`);
                            if (input) {
                                if (input.type === 'checkbox') {
                                    input.checked = Boolean(value);
                                } else {
                                    input.value = value || '';
                                }
                            }
                        });
                    }
                }
                
                // Update other settings
                const settingsForm = document.getElementById('appSettingsForm');
                if (settingsForm) {
                    Object.entries(settings).forEach(([key, value]) => {
                        if (key !== 'smtp') {
                            const input = settingsForm.querySelector(`[name="${key}"]`);
                            if (input) {
                                if (input.type === 'checkbox') {
                                    input.checked = Boolean(value);
                                } else {
                                    input.value = value || '';
                                }
                            }
                        }
                    });
                }
            }
            
            return settings;
        } catch (error) {
            console.error('Error loading settings:', error);
            showToast('Failed to load settings', 'error');
            throw error;
        }
    },
    
    saveSmtpSettings: async function(formData) {
        try {
            // This would typically save settings to your backend
            const settings = {};
            const smtpSettings = {};
            
            // Convert form data to settings object
            for (const [key, value] of formData.entries()) {
                if (key.startsWith('smtp.')) {
                    const settingKey = key.replace('smtp.', '');
                    smtpSettings[settingKey] = value;
                } else {
                    settings[key] = value;
                }
            }
            
            if (Object.keys(smtpSettings).length > 0) {
                settings.smtp = smtpSettings;
            }
            
            // Save settings
            const result = await window.app.api.settings.save(settings);
            
            if (result && result.success) {
                showToast('Settings saved successfully', 'success');
                return true;
            } else {
                throw new Error(result?.message || 'Failed to save settings');
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            showToast(error.message || 'Failed to save settings', 'error');
            throw error;
        }
    },
    
    // Other utilities
    calculateSaleTotal: function(items) {
        if (!Array.isArray(items)) return 0;
        return items.reduce((total, item) => {
            const quantity = parseFloat(item.quantity) || 0;
            const price = parseFloat(item.price) || 0;
            const discount = parseFloat(item.discount) || 0;
            const tax = parseFloat(item.tax) || 0;
            
            const subtotal = quantity * price;
            const discountAmount = (subtotal * discount) / 100;
            const taxableAmount = subtotal - discountAmount;
            const taxAmount = (taxableAmount * tax) / 100;
            
            return total + (taxableAmount + taxAmount);
        }, 0);
    },
    initializeProductAutocomplete,
    updateProductSuggestions,
    
    // Sales operations
    deleteSale: async (saleId) => {
        if (!confirm('Are you sure you want to delete this sale?')) return;
        try {
            const response = await sales.delete(saleId);
            if (response && response.success) {
                showToast('Sale deleted successfully', 'success');
                loadTodaysSales();
                updateDashboard();
            } else {
                showToast('Failed to delete sale', 'danger');
            }
        } catch (error) {
            console.error('Error deleting sale:', error);
            showToast('Error deleting sale', 'danger');
        }
    }
};


// Main initialization - implementation is at the top of the file
// This is a placeholder to maintain line numbers - the actual implementation is at the top of the file

// Initialize tooltips
function initializeTooltips() {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
}

// Initialize popovers
function initializePopovers() {
    const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
    popoverTriggerList.map(function (popoverTriggerEl) {
        return new bootstrap.Popover(popoverTriggerEl);
    });
}

// Make functions globally available
window.initializeTooltips = initializeTooltips;
window.initializePopovers = initializePopovers;

// Update loadSettings to use the correct API path
window.loadSettings = async function() {
    try {
        // Use the settings API directly since window.app.api might not be available yet
        const settings = await window.app?.api?.settings?.get() || {};
        
        // Update UI with settings if needed
        console.log('Loaded settings:', settings);
        return settings;
    } catch (error) {
        console.error('Error loading settings:', error);
        return {};
    }
};

// Initialize the application when the DOM is fully loaded
async function initializeApp() {
    console.log('Wolo Inventory Management Started');
    
    // Setup navigation
    setupNavigation();
    
    // Load initial data
    await loadProductNames();
    
    // Initialize date picker
    $('.input-daterange').datepicker({
        format: 'yyyy-mm-dd',
        autoclose: true
    });

    // Navigate to the current page (in case of page refresh)
    const currentPage = document.querySelector('.page.active')?.id?.replace('-page', '') || 'dashboard';
    navigateTo(currentPage);
}

document.addEventListener('DOMContentLoaded', initializeApp);

// Set up event listeners
function setupEventListeners() {
    // Navigation
    document.addEventListener('click', async (e) => {
        // Handle data-navigate-to buttons
        const navButton = e.target.closest('[data-navigate-to]');
        if (navButton) {
            e.preventDefault();
            const targetPage = navButton.getAttribute('data-navigate-to');
            navigateTo(targetPage);
            return;
        }
        
        // Handle nav items with data-page
        const navItem = e.target.closest('.nav-item[data-page]');
        if (navItem) {
            e.preventDefault();
            const targetPage = navItem.getAttribute('data-page');
            navigateTo(targetPage);
            return;
        }
        
        // Handle export action
        const exportBtn = e.target.closest('[data-action="export-excel"]');
        if (exportBtn) {
            e.preventDefault();
            if (typeof exportToExcel === 'function') {
                exportToExcel();
            } else {
                console.error('exportToExcel function is not defined');
                showToast('Export functionality is not available', 'warning');
            }
            return;
        }
        
        // Handle import action
        const importBtn = e.target.closest('[data-action="import-products"]');
        if (importBtn) {
            e.preventDefault();
            // Use Bootstrap's modal API to show the import modal
            const importModal = new bootstrap.Modal(document.getElementById('importProductsModal'));
            importModal.show();
            return;
        }
        
        // Handle view sale action
        const viewSaleBtn = e.target.closest('[data-action="view-sale"]');
        if (viewSaleBtn) {
            e.preventDefault();
            const saleId = viewSaleBtn.getAttribute('data-sale-id');
            if (saleId) {
                // Navigate to sale details or show in modal
                navigateTo('sale-details', { id: saleId });
            }
            return;
        }
        
        // Handle delete sale action
        const deleteSaleBtn = e.target.closest('[data-action="delete-sale"]');
        if (deleteSaleBtn) {
            e.preventDefault();
            const saleId = deleteSaleBtn.getAttribute('data-sale-id');
            if (saleId && confirm('Are you sure you want to delete this sale?')) {
                try {
                    // Show loading state
                    deleteSaleBtn.disabled = true;
                    deleteSaleBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Deleting...';
                    
                    if (isElectron && window.ipcRenderer) {
                        await window.ipcRenderer.invoke('delete-sale', saleId);
                    }
                    
                    // Remove the row from the table
                    const row = deleteSaleBtn.closest('tr');
                    if (row) row.remove();
                    
                    showToast('Sale deleted successfully', 'success');
                    
                    // Reload sales data
                    await loadSalesByDateRange();
                    
                } catch (error) {
                    console.error('Error deleting sale:', error);
                    showToast('Failed to delete sale', 'danger');
                    
                    // Reset button state
                    if (deleteSaleBtn) {
                        deleteSaleBtn.disabled = false;
                        deleteSaleBtn.innerHTML = '<i class="bi bi-trash"></i> Delete';
                    }
                }
            }
            return;
        }
        
        // Input validation
        document.querySelectorAll('input[type="number"]').forEach(input => {
            input.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                const min = parseFloat(e.target.min) || 0;
                const max = parseFloat(e.target.max) || Number.MAX_SAFE_INTEGER;
                
                if (isNaN(value) || value < min) {
                    e.target.value = min;
                } else if (value > max) {
                    e.target.value = max;
                }
            });
        });
        
        // Initialize date pickers for dynamically loaded content
        document.addEventListener('DOMNodeInserted', (e) => {
            if (e.target.matches('input[type="date"]') || e.target.querySelector('input[type="date"]')) {
                initializeDatePickers();
            }
        });
    });
    
    // Form submissions
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', (e) => {
            const formId = form.id;
            
            switch (formId) {
                case 'productForm':
                    e.preventDefault();
                    saveProduct(e);
                    break;
                case 'saleForm':
                    e.preventDefault();
                    handleSaleSubmit(e);
                    break;
                case 'settingsForm':
                    e.preventDefault();
                    saveSettings(e);
                    break;
                case 'smtpForm':
                    e.preventDefault();
                    saveSmtpSettings(e);
                    break;
                case 'activationForm':
                    e.preventDefault();
                    activateApp(e);
                    break;
                case 'emailForm':
                    e.preventDefault();
                    sendEmailReport(e);
                    break;
                default:
                    // Allow default form submission
                    return true;
            }
        });
    });
    
    // Initialize date pickers for dynamically loaded content
    document.addEventListener('DOMNodeInserted', (e) => {
        if (e.target.matches('input[type="date"]') || e.target.querySelector('input[type="date"]')) {
            initializeDatePickers();
        }
    });
}

// Update UI based on current state
function updateUI() {
    // Update active navigation link
    const currentPage = window.location.hash.substring(1) || 'dashboard';
    document.querySelectorAll('.nav-link').forEach(link => {
        const linkPage = link.getAttribute('href').substring(1);
        if (linkPage === currentPage) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
    
    // Update page title
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) {
        const title = currentPage.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
        pageTitle.textContent = title || 'Dashboard';
    }
    
    // Show/hide page sections
    document.querySelectorAll('.page-section').forEach(section => {
        if (section.id === `${currentPage}Section` || 
            (currentPage === '' && section.id === 'dashboardSection')) {
            section.style.display = 'block';
        } else {
            section.style.display = 'none';
        }
    });
    
    // Initialize tooltips and popovers for the current page
    initializeTooltips();
    initializePopovers();
}

// Undo/Redo state
const stateHistory = {
    past: [],
    present: null,
    future: [],
    maxLength: 50, // Maximum number of states to keep in history
    
    // Save current state
    saveState: function(state) {
        // If we're in the middle of undo/redo, clear the future
        if (this.present) {
            this.past.push(JSON.parse(JSON.stringify(this.present)));
            // Limit history size
            if (this.past.length > this.maxLength) {
                this.past.shift();
            }
            this.future = [];
        }
        this.present = JSON.parse(JSON.stringify(state));
    },
    
    // Undo last action
    undo: function() {
        if (this.past.length === 0) return null;
        this.future.unshift(this.present);
        this.present = this.past.pop();
        return this.present;
    },
    
    // Redo last undone action
    redo: function() {
        if (this.future.length === 0) return null;
        this.past.push(this.present);
        this.present = this.future.shift();
        return this.present;
    },
    
    // Check if undo is available
    canUndo: function() {
        return this.past.length > 0;
    },
    
    // Check if redo is available
    canRedo: function() {
        return this.future.length > 0;
    }
};

// Initialize undo/redo buttons
function initUndoRedo() {
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    
    if (undoBtn) {
        undoBtn.addEventListener('click', handleUndo);
        undoBtn.disabled = !stateHistory.canUndo();
    }
    
    if (redoBtn) {
        redoBtn.addEventListener('click', handleRedo);
        redoBtn.disabled = !stateHistory.canRedo();
    }
}

// Handle undo action
function handleUndo() {
    const previousState = stateHistory.undo();
    if (previousState) {
        applyState(previousState);
        updateUndoRedoButtons();
    }
}

// Handle redo action
function handleRedo() {
    const nextState = stateHistory.redo();
    if (nextState) {
        applyState(nextState);
        updateUndoRedoButtons();
    }
}

// Apply a state to the application
function applyState(state) {
    if (!state) return;
    
    // Update products if they exist in the state
    if (state.products) {
        allProducts = state.products;
        filteredProducts = [...allProducts];
        renderProductsTable();
        updateDashboard();
    }
    
    // Update sales if they exist in the state
    if (state.sales) {
        renderSalesTable(state.sales);
    }
    if (state.sales) {
        renderSalesTable(state.sales);
    }
    
    // Update UI elements based on the current state
    updateDashboard();
}

// Update undo/redo button states
function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undoBtn');
    
    if (undoBtn) undoBtn.disabled = !stateHistory.canUndo();
    if (redoBtn) redoBtn.disabled = !stateHistory.canRedo();
}

// Save current application state
async function saveCurrentState() {
    try {
        // Get today's sales data to include in the state
        const today = new Date().toISOString().split('T')[0];
        const salesResponse = await sales.getTodaySales();
        const salesData = Array.isArray(salesResponse) ? salesResponse : (salesResponse?.data || []);
        
        // Get current products
        const productsResponse = await products.getAll();
        const productsData = Array.isArray(productsResponse) ? productsResponse : (productsResponse?.data || []);
        
        // Save the state using the settings API
        const state = {
            sales: salesData,
            products: productsData,
            timestamp: new Date().toISOString()
        };
        
        // Save as a setting called 'app_state'
        await settings.save({ app_state: state });
        
        console.log('Application state saved successfully');
    } catch (error) {
        console.error('Error saving current state:', error);
        throw error;
    }
}

// Initialize app
// Product name autocomplete functionality
async function initializeProductAutocomplete() {
    try {
        // Wait for products to be loaded
        const { products } = await loadInitialData();
        
        // Initialize autocomplete if products exist
        if (products && products.length > 0) {
            const productNames = products.map(p => p.name);
            
            // Initialize autocomplete on product search input
            const $productSearch = $('#productSearch');
            if ($productSearch.length) {
                $productSearch.autocomplete({
                    source: productNames,
                    minLength: 1,
                    select: function(event, ui) {
                        const selectedProduct = products.find(p => p.name === ui.item.value);
                        if (selectedProduct) {
                            updateSaleForm(selectedProduct);
                        }
                    }
                });
            }
        }
    } catch (error) {
        console.error('Error initializing product autocomplete:', error);
    }
    datalist.id = 'productNames';
    document.body.appendChild(datalist);
    productNameInput.setAttribute('list', 'productNames');
    
    // Load initial suggestions
    updateProductSuggestions();
    
    // Update suggestions when input changes
    let debounceTimer;
    productNameInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            updateProductSuggestions(e.target.value);
        }, 300);
    });
}

// Update product suggestions based on input
async function updateProductSuggestions(filter = '') {
    const datalist = document.getElementById('productNames');
    if (!datalist) return;
    
    try {
        // Get all product names
        const products = await ipcRenderer.invoke('get-all-product-names');
        
        // Filter based on input
        const filteredProducts = filter 
            ? products.filter(p => 
                p.name.toLowerCase().includes(filter.toLowerCase()) ||
                p.barcode?.toLowerCase().includes(filter.toLowerCase())
              )
            : products;
        
        // Update datalist
        datalist.innerHTML = '';
        filteredProducts.forEach(product => {
            const option = document.createElement('option');
            option.value = product.name;
            option.dataset.id = product.id;
            option.dataset.barcode = product.barcode || '';
            datalist.appendChild(option);
        });
    } catch (error) {
        console.error('Error updating product suggestions:', error);
    }
}

// Global keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl+Z for undo
    if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        handleUndo();
    }
    // Ctrl+Y for redo
    if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        handleRedo();
    }
});

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Wolo Inventory Management Started');
    
    // Setup navigation
    setupNavigation();
    
    // Initialize undo/redo functionality
    initUndoRedo();
    
    // Load data
    await loadProducts();
    await loadSettings();
    
    // Save initial state
    saveCurrentState();
    
    // Update dashboard
    updateDashboard();
    
    // Initialize help button
    document.getElementById('helpButton')?.addEventListener('click', (e) => {
        e.preventDefault();
        const helpModal = new bootstrap.Modal(document.getElementById('helpModal'));
        helpModal.show();
    });
    
    // Handle help form submission
    document.getElementById('helpForm')?.addEventListener('submit', handleHelpSubmit);
    
    // Initialize product name suggestions
    initializeProductNameSuggestions();
    
    // Initialize sales page components
    const saleQuantityInput = document.getElementById('saleQuantity');
    if (saleQuantityInput) {
        saleQuantityInput.addEventListener('input', calculateSaleTotal);
        populateProductDropdown(); // Load products if we're on the sales page
        
        // Initialize sales-specific undo/redo buttons
        const undoBtnSales = document.getElementById('undoBtnSales');
        const redoBtnSales = document.getElementById('redoBtnSales');
        
        if (undoBtnSales) {
            undoBtnSales.addEventListener('click', handleUndo);
            undoBtnSales.disabled = !stateHistory.canUndo();
        }
        
        if (redoBtnSales) {
            redoBtnSales.addEventListener('click', handleRedo);
            redoBtnSales.disabled = !stateHistory.canRedo();
        }
    }
    
    // Initialize sales form if it exists
    const saleForm = document.getElementById('saleForm');
    if (saleForm) {
        saleForm.addEventListener('submit', handleSaleSubmit);
        
        // Initialize product dropdown and calculate total when inputs change
        const productSelect = document.getElementById('saleProduct');
        const quantityInput = document.getElementById('saleQuantity');
        const priceInput = document.getElementById('saleUnitPrice');
        
        if (productSelect) {
            populateProductDropdown();
            productSelect.addEventListener('change', function() {
                const selectedOption = this.options[this.selectedIndex];
                if (this.value && selectedOption) {
                    this.options[0].textContent = "Select a product";
                    updateSaleForm(selectedOption);
                } else {
                    updateSaleForm(null);
                }
            });
        }
        
        if (quantityInput && priceInput) {
            quantityInput.addEventListener('input', calculateSaleTotal);
            priceInput.addEventListener('input', calculateSaleTotal);
        }
    }
});

// Handle help form submission
async function handleHelpSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const spinner = document.getElementById('helpSpinner');
    const successMsg = document.getElementById('helpSuccess');
    const errorMsg = document.getElementById('helpError');
    
    // Show loading state
    submitBtn.disabled = true;
    spinner.classList.remove('d-none');
    successMsg.classList.add('d-none');
    errorMsg.classList.add('d-none');
    
    try {
        const formData = {
            name: document.getElementById('helpName').value,
            email: document.getElementById('helpEmail').value,
            subject: document.getElementById('helpSubject').value,
            message: document.getElementById('helpMessage').value
        };
        
        // Send the help request
        await ipcRenderer.invoke('send-help-request', formData);
        
        // Show success message
        successMsg.classList.remove('d-none');
        form.reset();
        
        // Hide the modal after 3 seconds
        setTimeout(() => {
            const helpModal = bootstrap.Modal.getInstance(document.getElementById('helpModal'));
            if (helpModal) helpModal.hide();
        }, 3000);
        
    } catch (error) {
        console.error('Error sending help request:', error);
        errorMsg.classList.remove('d-none');
    } finally {
        // Reset button state
        submitBtn.disabled = false;
        spinner.classList.add('d-none');
    }
}

// Function to populate sales product dropdown
async function populateProductDropdown() {
    try {
        const products = await loadProducts(); // Get fresh product data
        const productSelect = document.getElementById('saleProduct');
        if (!productSelect) return;

        // Store the currently selected value to restore it after refresh
        const currentValue = productSelect.value;
        
        // Clear existing options
        productSelect.innerHTML = '<option value="">Select a product</option>';

        // Add options for each product with stock
        products.forEach(product => {
            const totalStock = product.quantity_in_stock + (product.quantity_on_shelf || 0);
            if (totalStock > 0) { // Only show products with stock available
                const sellingPrice = (product.total_bulk_cost * (1 + (product.profit_margin || 0) / 100) / (product.quantity_purchased || 1)).toFixed(2);
                const option = document.createElement('option');
                option.value = product.id;
                option.textContent = `${product.name} (GH₵${sellingPrice})`;
                option.dataset.price = sellingPrice;
                option.dataset.stock = totalStock.toString();
                productSelect.appendChild(option);
            }
        });

        // Restore the selected value if it still exists
        if (currentValue) {
            const optionExists = Array.from(productSelect.options).some(opt => opt.value === currentValue);
            if (optionExists) {
                productSelect.value = currentValue;
                // Trigger change event to update the form
                const event = new Event('change');
                productSelect.dispatchEvent(event);
            }
        }
    } catch (error) {
        console.error('Error populating product dropdown:', error);
    }
};

// Initialize product name suggestions with proper variable scoping
window.initializeProductNameSuggestions = function() {
    // Function to escape HTML to prevent XSS
    const escapeHtml = (unsafe) => {
        if (!unsafe) return '';
        return unsafe
            .toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };

    try {
        const productNameInput = document.getElementById('productName');
        
        // Return early if the input element doesn't exist
        if (!productNameInput) {
            console.warn('Product name input element not found');
            return;
        }
        
        // Ensure productNameSuggestions is defined
        if (!window.productNameSuggestions) {
            console.warn('productNameSuggestions array not found, initializing empty array');
            window.productNameSuggestions = [];
        }
        
        // Create suggestions container if it doesn't exist
        let suggestionsContainer = document.querySelector('.suggestions-container');
        if (!suggestionsContainer) {
            suggestionsContainer = document.createElement('div');
            suggestionsContainer.className = 'suggestions-container position-absolute w-100 bg-white border rounded shadow-sm d-none';
            suggestionsContainer.style.zIndex = '1000';
            suggestionsContainer.style.maxHeight = '200px';
            suggestionsContainer.style.overflowY = 'auto';
            document.body.appendChild(suggestionsContainer);
        }
        
        // Position the container right after the input
        const positionSuggestions = () => {
            if (!productNameInput || !suggestionsContainer) return;
            
            const inputRect = productNameInput.getBoundingClientRect();
            suggestionsContainer.style.top = `${inputRect.bottom + window.scrollY}px`;
            suggestionsContainer.style.left = `${inputRect.left + window.scrollX}px`;
            suggestionsContainer.style.width = `${inputRect.width}px`;
        };
        
        // Initialize resize observer if not already set up
        if (!window.suggestionsResizeObserver) {
            window.suggestionsResizeObserver = new ResizeObserver(positionSuggestions);
            window.suggestionsResizeObserver.observe(document.body);
        }
        
        // Handle input changes
        const handleInput = () => {
            if (!productNameInput || !suggestionsContainer) return;
            
            const input = productNameInput.value.trim().toLowerCase();
            
            if (input.length < 2) {
                suggestionsContainer.classList.add('d-none');
                return;
            }
            
            // Filter suggestions
            const matches = window.productNameSuggestions.filter(name => 
                name && typeof name === 'string' && name.toLowerCase().includes(input)
            );
            
            // Show suggestions if there are matches
            if (matches.length > 0) {
                suggestionsContainer.innerHTML = matches.map(name => 
                    `<div class="suggestion-item p-2 border-bottom hover-bg-light" style="cursor: pointer;">${escapeHtml(name)}</div>`
                ).join('');
                
                // Add click handler for suggestions
                document.querySelectorAll('.suggestion-item').forEach(item => {
                    item.addEventListener('click', () => {
                        if (productNameInput) {
                            productNameInput.value = item.textContent || '';
                            suggestionsContainer.classList.add('d-none');
                            // Trigger change event to update other fields
                            const event = new Event('change');
                            productNameInput.dispatchEvent(event);
                        }
                    });
                });
                
                positionSuggestions();
                suggestionsContainer.classList.remove('d-none');
            } else {
                suggestionsContainer.classList.add('d-none');
            }
        };
        
        // Remove existing event listeners to prevent duplicates
        productNameInput.removeEventListener('input', handleInput);
        productNameInput.removeEventListener('focus', handleInput);
        
        // Add event listeners
        productNameInput.addEventListener('input', handleInput);
        productNameInput.addEventListener('focus', handleInput);
        
        // Hide suggestions when clicking outside
        const handleClickOutside = (e) => {
            if (suggestionsContainer && !suggestionsContainer.contains(e.target) && 
                e.target !== productNameInput) {
                suggestionsContainer.classList.add('d-none');
            }
        };
                
        document.addEventListener('click', handleClickOutside);
                
        // Handle keyboard navigation
        const handleKeyDown = (e) => {
            const visibleItems = Array.from(document.querySelectorAll('.suggestion-item:not(.d-none)'));
            if (visibleItems.length === 0) return;
                        
            const currentIndex = visibleItems.findIndex(item => item.classList.contains('active'));
                        
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                const nextIndex = (currentIndex + 1) % visibleItems.length;
                updateActiveSuggestion(visibleItems, nextIndex);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const prevIndex = (currentIndex - 1 + visibleItems.length) % visibleItems.length;
                updateActiveSuggestion(visibleItems, prevIndex);
            } else if (e.key === 'Enter' && currentIndex >= 0) {
                e.preventDefault();
                visibleItems[currentIndex].click();
            }
        };
                
        productNameInput.addEventListener('keydown', handleKeyDown);
                
        // Cleanup function
        const cleanup = () => {
            productNameInput.removeEventListener('input', handleInput);
            document.removeEventListener('click', handleClickOutside);
            productNameInput.removeEventListener('keydown', handleKeyDown);
            resizeObserver.disconnect();
            if (suggestionsContainer.parentNode) {
                suggestionsContainer.parentNode.removeChild(suggestionsContainer);
            }
        };

        // Return cleanup function
        return cleanup;
    } catch (error) {
        console.error('Error initializing product name suggestions:', error);
    }
}

// Helper function to escape HTML
function escapeHtml(unsafe) {
if (!unsafe) return '';
return unsafe
.replace(/&/g, "&amp;")
.replace(/</g, "&lt;")
.replace(/>/g, "&gt;")
.replace(/"/g, "&quot;")
.replace(/'/g, "&#039;");
}

// Function to update sale form when product is selected
function updateSaleForm(selectedOption) {
const saleUnitPrice = document.getElementById('saleUnitPrice');
const saleQuantity = document.getElementById('saleQuantity');
const saleTotal = document.getElementById('saleTotal');

if (!selectedOption || !selectedOption.value) {
// Reset form fields
saleUnitPrice.value = '';
saleQuantity.value = '1';
saleQuantity.max = '0';
saleQuantity.readOnly = true;
saleTotal.value = '0.00';
return;
}

// Update form with selected product data
const price = selectedOption.dataset.price;
const maxStock = selectedOption.dataset.stock;
const currentQty = parseInt(saleQuantity.value) || 1;
        
// Set the new max stock
saleQuantity.max = maxStock;
        
// Only update quantity if it's not a valid number or exceeds the new max stock
if (isNaN(currentQty) || currentQty < 1 || currentQty > maxStock) {
saleQuantity.value = '1';
} else {
// Ensure quantity doesn't exceed max stock
saleQuantity.value = Math.min(currentQty, maxStock);
}
        
saleUnitPrice.value = price;
saleQuantity.readOnly = false;
        
// Calculate initial total
calculateSaleTotal();
    
    // Only update quantity if it's not a valid number or exceeds the new max stock
    if (isNaN(currentQty) || currentQty < 1 || currentQty > maxStock) {
        saleQuantity.value = '1';
    } else {
        // Ensure quantity doesn't exceed max stock
        saleQuantity.value = Math.min(currentQty, maxStock);
    }
    
    saleUnitPrice.value = price;
    saleQuantity.readOnly = false;
    
    // Calculate initial total
    calculateSaleTotal();
}

// Calculate sale total
function calculateSaleTotal() {
    const quantity = parseInt(document.getElementById('saleQuantity').value) || 0;
    const unitPrice = parseFloat(document.getElementById('saleUnitPrice').value) || 0;
    const total = (quantity * unitPrice).toFixed(2);
    document.getElementById('saleTotal').value = total;
}

// Refresh sales dropdown if it exists
function refreshSalesDropdown() {
    const salesDropdown = document.getElementById('saleProduct');
    if (salesDropdown && document.getElementById('sales-page')?.classList.contains('active')) {
        populateProductDropdown();
    }
}

// Load product names for autocomplete
async function loadProductNames() {
    try {
        const response = await products.getAll();
        const productsData = Array.isArray(response) ? response : (response?.data || []);
        const datalist = document.getElementById('productNamesList');
        
        if (datalist) {
            datalist.innerHTML = '';
            const uniqueNames = [...new Set(productsData.map(p => p.name))];
            
            uniqueNames.forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                datalist.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading product names:', error);
    }
}

// Handle sale submission
async function handleSaleSubmit(event) {
    event.preventDefault();
    
    const productSelect = document.getElementById('saleProduct');
    const selectedOption = productSelect.options[productSelect.selectedIndex];
    
    if (!productSelect.value) {
        showToast('Please select a product', 'warning');
        return;
    }
    
    const quantity = parseInt(document.getElementById('saleQuantity').value);
    const maxStock = parseInt(selectedOption.dataset.stock);
    
    if (quantity > maxStock) {
        showToast(`Only ${maxStock} units available in stock`, 'warning');
        return;
    }
    
    try {
        const saleData = {
            productId: productSelect.value,
            productName: selectedOption.textContent.split(' (')[0], // Extract just the product name
            quantity: quantity,
            unitPrice: parseFloat(document.getElementById('saleUnitPrice').value),
            notes: document.getElementById('saleNotes').value || null
        };
        
        await ipcRenderer.invoke('record-sale', saleData);
        showToast('Sale recorded successfully', 'success');
        
        // Reset form
        event.target.reset();
        document.getElementById('saleTotal').value = '0.00';
        
        // Refresh data
        await loadProducts();
        populateProductDropdown();
        updateDashboard();
        
        // Refresh the sales table if we're on the sales page
        if (document.getElementById('sales-page').classList.contains('active')) {
            const sales = await ipcRenderer.invoke('get-todays-sales');
            renderSalesTable(sales);
        }
        populateProductDropdown();
        
        // Save state after successful sale
        saveCurrentState();
        
    } catch (error) {
        console.error('Error recording sale:', error);
        showToast('Error recording sale: ' + error.message, 'danger');
    }
}

// Render sales table with the provided sales data - using the implementation from line 132

// Call this function when the page loads and after adding new products
document.addEventListener('DOMContentLoaded', () => {
    // Initialize navigation
    setupNavigation();
    
    // Load initial data
    loadProductNames();
    
    // Initialize date picker
    $('.input-daterange').datepicker({
        format: 'yyyy-mm-dd',
        autoclose: true
    });

    // Navigate to the current page (in case of page refresh)
    const currentPage = document.querySelector('.page.active')?.id?.replace('-page', '') || 'dashboard';
    navigateTo(currentPage);
});

// Refresh data
async function refreshData() {
    await loadProducts();
    updateDashboard();
    renderProductsTable();
    showToast('Data refreshed successfully', 'success');
}

// Initialize popovers - implementation is at line 481

// Update dashboard statistics
function updateDashboard() {
    const stats = calculateStats();
    
    // Safely update dashboard elements if they exist
    const updateElement = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };
    
    updateElement('totalProducts', stats.totalProducts);
    updateElement('totalValue', `$${stats.totalValue.toFixed(2)}`);
    updateElement('lowStockCount', stats.lowStockCount);
    updateElement('expiringSoonCount', stats.expiringSoonCount);
    
    // Update alert lists if they exist
    if (typeof renderLowStockAlerts === 'function') {
        renderLowStockAlerts(stats.lowStockItems);
    }
    if (typeof renderExpiringAlerts === 'function') {
        renderExpiringAlerts(stats.expiringItems);
    }
}

function calculateStats() {
    const today = new Date();
    const stats = {
        totalProducts: allProducts.length,
        totalValue: 0,
        lowStockCount: 0,
        expiringSoonCount: 0,
        lowStockItems: [],
        expiringItems: []
    };
    
    allProducts.forEach(product => {
        const unitCost = product.total_bulk_cost / product.quantity_purchased;
        const sellingPrice = unitCost * (1 + product.profit_margin / 100);
        const totalQty = product.quantity_in_stock + product.quantity_on_shelf;
        
        // Total value
        stats.totalValue += (unitCost * product.quantity_in_stock) + (sellingPrice * product.quantity_on_shelf);
        
        // Low stock
        if (totalQty <= product.reorder_level) {
            stats.lowStockCount++;
            stats.lowStockItems.push(product);
        }
        
        // Expiring soon (30 days)
        const expiryDate = new Date(product.expiry_date);
        const daysToExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
        if (daysToExpiry <= 30 && daysToExpiry >= 0) {
            stats.expiringSoonCount++;
            stats.expiringItems.push({ ...product, daysToExpiry });
        }
    });
    
    return stats;
}

function renderLowStockAlerts(items = []) {
    try {
        const container = document.getElementById('lowStockList');
        if (!container) {
            console.warn('Low stock container not found');
            return;
        }

        if (!Array.isArray(items) || items.length === 0) {
            container.innerHTML = '<p class="text-muted">No low stock items</p>';
            return;
        }
        
        container.innerHTML = items.slice(0, 5).map(product => {
            if (!product) return '';
            const totalQty = (product.quantity_in_stock || 0) + (product.quantity_on_shelf || 0);
            return `
                <div class="alert-item warning">
                    <strong>${product.name || 'Unknown Product'}</strong>
                    <small>Stock: ${totalQty} | Reorder Level: ${product.reorder_level || 'N/A'}</small>
                </div>
            `;
        }).filter(Boolean).join('');
    } catch (error) {
        console.error('Error rendering low stock alerts:', error);
    }
}

function renderExpiringAlerts(items = []) {
    try {
        const container = document.getElementById('expiringList');
        if (!container) {
            console.warn('Expiring items container not found');
            return;
        }

        if (!Array.isArray(items) || items.length === 0) {
            container.innerHTML = '<p class="text-muted">No items expiring soon</p>';
            return;
        }
        
        container.innerHTML = items.slice(0, 5).map(product => {
            if (!product) return '';
            return `
                <div class="alert-item danger">
                    <strong>${product.name || 'Unknown Product'}</strong>
                    <small>Expires in ${product.daysToExpiry || '?'} days (${product.expiry_date || 'N/A'})</small>
                </div>
            `;
        }).filter(Boolean).join('');
    } catch (error) {
        console.error('Error rendering expiring alerts:', error);
    }
}

// Products table
function renderProductsTable() {
    const tbody = document.getElementById('productsTableBody');
    
    if (filteredProducts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center py-5">
                    <div class="empty-state">
                        <i class="bi bi-inbox"></i>
                        <h3>No products found</h3>
                        <p>Add your first product to get started</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = filteredProducts.map(product => {
        const unitCost = product.total_bulk_cost / product.quantity_purchased;
        const sellingPrice = unitCost * (1 + product.profit_margin / 100);
        const totalQty = product.quantity_in_stock + product.quantity_on_shelf;
        
        // Check expiry status
        const today = new Date();
        const expiryDate = new Date(product.expiry_date);
        const daysToExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
        let expiryBadge = '';
        
        if (daysToExpiry < 0) {
            expiryBadge = '<span class="badge bg-danger">Expired</span>';
        } else if (daysToExpiry <= 30) {
            expiryBadge = '<span class="badge bg-warning">Expiring Soon</span>';
        }
        
        // Check stock status
        let stockBadge = '';
        if (totalQty === 0) {
            stockBadge = '<span class="badge bg-danger">Out of Stock</span>';
        } else if (totalQty <= product.reorder_level) {
            stockBadge = '<span class="badge bg-warning">Low Stock</span>';
        }
        
        return `
            <tr>
                <td>
                    <strong>${product.name}</strong>
                    ${stockBadge}
                </td>
                <td>${product.category || 'N/A'}</td>
                <td>${product.quantity_in_stock}</td>
                <td>${product.quantity_on_shelf}</td>
                <td>$${unitCost.toFixed(2)}</td>
                <td>$${sellingPrice.toFixed(2)}</td>
                <td>${product.profit_margin}%</td>
                <td>
                    ${product.expiry_date}
                    ${expiryBadge}
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-primary" onclick="editProduct('${product.id}')">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteProduct('${product.id}')">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    // Update category filter
    updateCategoryFilter();
}

function updateCategoryFilter() {
    const categories = [...new Set(allProducts.map(p => p.category).filter(Boolean))];
    const select = document.getElementById('categoryFilter');
    const currentValue = select.value;
    
    select.innerHTML = '<option value="">All Categories</option>' +
        categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    
    select.value = currentValue;
}

// Filter products
function filterProducts() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const category = document.getElementById('categoryFilter').value;
    const stockFilter = document.getElementById('stockFilter').value;
    const expiryFilter = document.getElementById('expiryFilter').value;
    
    const today = new Date();
    
    filteredProducts = allProducts.filter(product => {
        // Search filter
        const matchesSearch = product.name.toLowerCase().includes(search) ||
            (product.barcode && product.barcode.toLowerCase().includes(search));
        
        // Category filter
        const matchesCategory = !category || product.category === category;
        
        // Stock filter
        const totalQty = product.quantity_in_stock + product.quantity_on_shelf;
        let matchesStock = true;
        if (stockFilter === 'low') {
            matchesStock = totalQty <= product.reorder_level && totalQty > 0;
        } else if (stockFilter === 'out') {
            matchesStock = totalQty === 0;
        }
        
        // Expiry filter
        const expiryDate = new Date(product.expiry_date);
        const daysToExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
        let matchesExpiry = true;
        if (expiryFilter === 'expiring') {
            matchesExpiry = daysToExpiry <= 30 && daysToExpiry >= 0;
        } else if (expiryFilter === 'expired') {
            matchesExpiry = daysToExpiry < 0;
        }
        
        return matchesSearch && matchesCategory && matchesStock && matchesExpiry;
    });
    
    renderProductsTable();
}

// Product form functions
function calculatePrices() {
    const bulkCost = parseFloat(document.getElementById('totalBulkCost').value) || 0;
    const qtyPurchased = parseInt(document.getElementById('quantityPurchased').value) || 1;
    const profitMargin = parseFloat(document.getElementById('profitMargin').value) || 0;
    
    const unitCost = bulkCost / qtyPurchased;
    const sellingPrice = unitCost * (1 + profitMargin / 100);
    const marginalProfit = sellingPrice - unitCost;
    
    document.getElementById('unitCostPrice').value = unitCost.toFixed(2);
    document.getElementById('sellingPrice').value = sellingPrice.toFixed(2);
    document.getElementById('marginalProfit').value = marginalProfit.toFixed(2);
}

async function saveProduct(event) {
    event.preventDefault();
    
    // Use the global app object or window.electron if available
    const { ipcRenderer } = window.electron || { ipcRenderer: { invoke: () => Promise.reject('Electron IPC not available') } };
    const showToast = window.showToast || ((message, type) => console.log(`[${type}] ${message}`));
    const navigateTo = window.app?.navigateTo || (() => console.log('Navigate to products'));
    
    const productId = document.getElementById('productId')?.value;
    const productName = document.getElementById('productName')?.value.trim();
    const barcode = document.getElementById('productBarcode')?.value.trim() || null;
    const totalBulkCost = parseFloat(document.getElementById('totalBulkCost')?.value || '0');
    const quantityPurchased = parseInt(document.getElementById('quantityPurchased')?.value || '0');
    const profitMargin = parseFloat(document.getElementById('profitMargin')?.value || '0');
    
    // Basic validation
    if (!productName) {
        showToast('Please enter a product name', 'warning');
        return;
    }
    
    if (isNaN(totalBulkCost) || isNaN(quantityPurchased) || isNaN(profitMargin)) {
        showToast('Please enter valid numbers for cost, quantity, and profit margin', 'warning');
        return;
    }
    
    // Check for duplicate product name
    try {
        const existingProduct = await window.electron?.ipcRenderer?.invoke('check-duplicate-product', {
            id: productId || null, // Exclude current product when updating
            name: productName,
            barcode: barcode
        });
        
        if (existingProduct) {
            showToast(`A product with ${existingProduct.field === 'name' ? 'this name' : 'this barcode'} already exists`, 'warning');
            return;
        }
    } catch (error) {
        console.error('Error checking for duplicate product:', error);
        showToast('Error checking for duplicate product', 'danger');
        return;
    }
    
    const productData = {
        name: productName,
        barcode: barcode,
        category: document.getElementById('productCategory')?.value.trim() || null,
        description: document.getElementById('productDescription')?.value.trim() || null,
        total_bulk_cost: totalBulkCost,
        quantity_purchased: quantityPurchased,
        profit_margin: profitMargin,
        quantity_in_stock: parseInt(document.getElementById('quantityInStock')?.value || '0'),
        quantity_on_shelf: parseInt(document.getElementById('quantityOnShelf')?.value || '0'),
        manufactured_date: document.getElementById('manufacturedDate')?.value || null,
        expiry_date: document.getElementById('expiryDate')?.value || null,
        reorder_level: parseInt(document.getElementById('reorderLevel')?.value || '10')
    };
    
    try {
        if (productId) {
            // Update existing product
            await window.electron?.ipcRenderer?.invoke('update-product', { 
                id: productId, 
                updates: productData 
            });
            showToast('Product updated successfully', 'success');
        } else {
            // Add new product
            await window.electron?.ipcRenderer?.invoke('add-product', productData);
            // After successfully adding the product, refresh the product names list
            if (typeof loadProductNames === 'function') {
                await loadProductNames();
            }
            showToast('Product added successfully', 'success');
        }
        
        if (typeof loadProducts === 'function') {
            await loadProducts();
        }
        
        if (typeof updateDashboard === 'function') {
            updateDashboard();
        }
        
        if (typeof saveCurrentState === 'function') {
            saveCurrentState(); // Save state after product operation
        }
        
        navigateTo('products');
    } catch (error) {
        console.error('Error saving product:', error);
        showToast('Error saving product: ' + (error.message || 'Unknown error'), 'danger');
    }
}

async function editProduct(id) {
    try {
        const product = await ipcRenderer.invoke('get-product', id);
        if (!product) {
            showToast('Product not found', 'error');
            return;
        }
        
        // Set form title and mode
        document.getElementById('productFormTitle').textContent = 'Edit Product';
        document.getElementById('productId').value = product.id;
        
        // Fill in all product details
        const fields = {
            'productName': product.name,
            'productBarcode': product.barcode,
            'productCategory': product.category,
            'productDescription': product.description,
            'totalBulkCost': product.total_bulk_cost,
            'quantityPurchased': product.quantity_purchased,
            'profitMargin': product.profit_margin,
            'quantityInStock': product.quantity_in_stock,
            'quantityOnShelf': product.quantity_on_shelf,
            'manufacturedDate': product.manufactured_date,
            'expiryDate': product.expiry_date,
            'reorderLevel': product.reorder_level
        };
        
        // Set each field, handling null/undefined values
        Object.entries(fields).forEach(([fieldId, value]) => {
            const element = document.getElementById(fieldId);
            if (element) {
                element.value = value || '';
                // For number inputs, ensure we don't display 'null' or 'undefined'
                if (element.type === 'number' && !value) {
                    element.value = '0';
                }
            }
        });
        
        calculatePrices();
        navigateTo('product-form');
    } catch (error) {
        console.error('Error loading product:', error);
        showToast('Error loading product', 'danger');
    }
}

async function deleteProduct(id) {
    if (!confirm('Are you sure you want to delete this product?')) {
        return;
    }
    
    try {
        await ipcRenderer.invoke('delete-product', id);
        showToast('Product deleted successfully', 'success');
        await loadProducts();
        updateDashboard();
        renderProductsTable();
    } catch (error) {
        console.error('Error deleting product:', error);
        showToast('Error deleting product', 'danger');
    }
}

async function updateProduct(productId, updates) {
    try {
        const result = await ipcRenderer.invoke('update-product', {
            id: productId,
            updates: updates
        });
        
        if (result) {
            showToast('Product updated successfully', 'success');
            await loadProducts(); // Refresh product list
            navigateTo('products'); // Return to products page
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error updating product:', error);
        showToast('Failed to update product: ' + error.message, 'error');
        return false;
    }
}

function resetForm() {
    document.getElementById('productFormTitle').textContent = 'Add New Product';
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = '';
    document.getElementById('unitCostPrice').value = '';
    document.getElementById('sellingPrice').value = '';
    document.getElementById('marginalProfit').value = '';
}

// Export functions
// Export current products to Excel
// Make exportToExcel globally available
window.exportToExcel = async function() {
    const exportBtn = document.querySelector('button[onclick*="exportToExcel"]');
    const originalBtnText = exportBtn?.innerHTML;
    
    try {
        // Disable button during export
        if (exportBtn) {
            exportBtn.disabled = true;
            exportBtn.innerHTML = 'Exporting...';
        }

        // Check if we're running in Electron
        const isElectron = typeof window !== 'undefined' && window.process && window.process.versions && window.process.versions.electron;
        
        if (isElectron && window.require) {
            // Electron environment
            const { ipcRenderer } = window.require('electron');
            const result = await ipcRenderer.invoke('export-to-excel', {
                products: window.filteredProducts || [],
                filename: `wolo-inventory-${new Date().toISOString().split('T')[0]}.xlsx`
            });
        
            if (result && result.success) {
                if (window.showToast) {
                    window.showToast('Products exported successfully', 'success');
                } else {
                    alert('Products exported successfully!');
                }
            } else {
                throw new Error(result?.message || 'Failed to export products');
            }
        } else {
            // Web environment - try using SheetJS if available
            if (typeof XLSX === 'undefined') {
                throw new Error('Excel export requires SheetJS in web browser. Please include the XLSX library.');
            }
            
            // Get products from the global scope or use an empty array
            const products = window.filteredProducts || [];
            
            // Create a new workbook
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(products);
            
            // Add the worksheet to the workbook
            XLSX.utils.book_append_sheet(wb, ws, 'Products');
            
            // Generate the Excel file
            XLSX.writeFile(wb, `wolo-inventory-${new Date().toISOString().split('T')[0]}.xlsx`);
            
            if (window.showToast) {
                window.showToast('Products exported successfully', 'success');
            } else {
                alert('Products exported successfully!');
            }
        }
    } catch (error) {
        console.error('Error exporting to Excel:', error);
        if (window.showToast) {
            window.showToast(`Export failed: ${error.message}`, 'danger');
        } else {
            alert(`Export failed: ${error.message}`);
        }
    } finally {
        // Re-enable button if it exists
        if (exportBtn) {
            exportBtn.disabled = false;
            exportBtn.innerHTML = originalBtnText?.includes('Export') ? originalBtnText : 'Export to Excel';
        }
    }
}

/**
 * Helper function to create and download Excel file
 */
async function downloadAsExcel(products) {
    return new Promise((resolve, reject) => {
        try {
            // Check if XLSX is available
            if (typeof XLSX === 'undefined') {
                // Try to load from CDN if not available
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
                script.onload = () => {
                    createAndDownloadExcel(products);
                    resolve();
                };
                script.onerror = () => {
                    reject(new Error('Failed to load XLSX library'));
                };
                document.head.appendChild(script);
            } else {
                // XLSX is already available
                createAndDownloadExcel(products);
                resolve();
            }
        } catch (error) {
            console.error('Error in downloadAsExcel:', error);
            reject(error);
        }
    });
}

/**
 * Helper function to create and trigger Excel download
 */
function createAndDownloadExcel(products) {
    // Get button element and save original state
    const exportBtn = document.querySelector('button[data-action="export-excel"]');
    const originalBtnText = exportBtn?.innerHTML;
    
    try {
        if (exportBtn) {
            exportBtn.disabled = true;
            exportBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Exporting...';
        }

        // Convert products to worksheet
        const data = products.map(product => ({
            'Name': product.name || '',
            'Barcode': product.barcode || '',
            'Category': product.category || '',
            'Description': product.description || '',
            'Quantity in Stock': product.quantity_in_stock || product.quantityInStock || 0,
            'Reorder Level': product.reorder_level || product.reorderLevel || 0,
            'Unit Cost': product.unit_cost || product.unitCost || 0,
            'Selling Price': product.selling_price || product.sellingPrice || 0,
            'Supplier': product.supplier_name || product.supplier || '',
            'Expiry Date': product.expiry_date || product.expiryDate || '',
            'Notes': product.notes || ''
        }));

        // Create workbook and worksheet
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Products');

        // Auto-size columns for product data
        const wscols = [
            {wch: 25}, // Name
            {wch: 15}, // Barcode
            {wch: 20}, // Category
            {wch: 40}, // Description
            {wch: 15}, // Quantity
            {wch: 15}, // Reorder Level
            {wch: 15}, // Unit Cost
            {wch: 15}, // Selling Price
            {wch: 20}, // Supplier
            {wch: 15}, // Expiry Date
            {wch: 30}  // Notes
        ];

        if (ws) {
            ws['!cols'] = wscols;
        }

        // Generate Excel file
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);

        // Create download link
        const link = document.createElement('a');
        link.href = url;
        link.download = `products-export-${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(link);
        link.click();

        // Clean up
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);

        if (window.showToast) {
            window.showToast(`Exported ${products.length} products successfully`, 'success');
        }
        
        return true;
    } catch (error) {
        console.error('Error in createAndDownloadExcel:', error);
        if (window.showToast) {
            window.showToast('Error exporting data: ' + (error.message || 'Unknown error'), 'danger');
        }
        return false;
    } finally {
        // Restore button state
        if (exportBtn) {
            exportBtn.disabled = false;
            exportBtn.innerHTML = originalBtnText || '<i class="bi bi-file-earmark-excel"></i> Export';
        }
    }
}

// Function to generate product reports
async function generateReport() {
    const exportBtn = document.querySelector('button[onclick*="generateReport"]');
    const originalBtnText = exportBtn?.innerHTML;
    
    try {
        if (exportBtn) {
            exportBtn.disabled = true;
            exportBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Generating...';
        }
    } catch (error) {
        console.error('Error during report generation UI update:', error);
    if (exportBtn) {
        exportBtn.disabled = false;
        exportBtn.innerHTML = originalBtnText || 'Generate Report';
    }
    showToast('Error preparing report generation', 'danger');
    }

        let productsToExport = [];
        const reportType = document.getElementById('reportType')?.value || 'all';
        const today = new Date();
        
        // Get all products first
        let allProducts = [];
        if (isElectron && window.ipcRenderer) {
            const productsResponse = await window.ipcRenderer.invoke('get-all-products');
            allProducts = Array.isArray(productsResponse) ? productsResponse : [];
        } else {
            // Fallback for browser environment
            allProducts = Array.isArray(window.productsData) ? window.productsData : [];
        }
        
        if (!allProducts.length) {
            if (window.showToast) {
                window.showToast('No products found to generate report', 'warning');
            }
            return;
        
        switch (reportType) {
        case 'all':
            productsToExport = allProducts;
            break;
        case 'low-stock':
            productsToExport = allProducts.filter(p => 
                (p.quantity_in_stock + p.quantity_on_shelf) <= p.reorder_level
            );
            break;
        case 'expiring':
            productsToExport = allProducts.filter(p => {
                const expiryDate = new Date(p.expiry_date);
                const days = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
                return days <= 30 && days >= 0;
            });
            break;
        case 'expired':
            productsToExport = allProducts.filter(p => 
                new Date(p.expiry_date) < today
            );
            break;
    }
    
    if (productsToExport.length === 0) {
        showToast('No products to export for this report type', 'warning');
        return;
    }
    
    try {
        const result = await ipcRenderer.invoke('export-to-excel', {
            products: productsToExport,
            filename: `wolo-${reportType}-report-${new Date().toISOString().split('T')[0]}.xlsx`
        });
        
        if (result && result.success) {
            if (window.showToast) {
                window.showToast(`${productsToExport.length} products exported successfully`, 'success');
            }
        } else {
            throw new Error('Failed to export products');
        }
    } catch (error) {
        console.error('Error generating report:', error);
        if (window.showToast) {
            window.showToast(`Error generating report: ${error.message || 'Unknown error'}`, 'danger');
        }
    } finally {
        // Reset any loading states if needed
        const exportBtn = document.querySelector('button[onclick*="generateReport"]');
        if (exportBtn) {
            exportBtn.disabled = false;
            const icon = exportBtn.querySelector('i');
            if (icon) {
                icon.className = 'bi bi-file-earmark-spreadsheet';
            }
        }
    }
}}

async function sendEmailReport(event) {
    event.preventDefault();
    
    const reportType = document.getElementById('reportType').value;
    const to = document.getElementById('recipientEmail').value;
    const subject = document.getElementById('emailSubject').value;
    const body = document.getElementById('emailMessage').value;
    
    // First generate the Excel file
    try {
        showToast('Generating report...', 'info');
        
        let productsToExport = [];
        const today = new Date();
        
        switch (reportType) {
            case 'all':
                productsToExport = allProducts;
                break;
            case 'low-stock':
                productsToExport = allProducts.filter(p => 
                    (p.quantity_in_stock + p.quantity_on_shelf) <= p.reorder_level
                );
                break;
            case 'expiring':
                productsToExport = allProducts.filter(p => {
                    const expiryDate = new Date(p.expiry_date);
                    const days = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
                    return days <= 30 && days >= 0;
                });
                break;
            case 'expired':
                productsToExport = allProducts.filter(p => 
                    new Date(p.expiry_date) < today
                );
                break;
        }
        
        const exportResult = await ipcRenderer.invoke('export-to-excel', {
            products: productsToExport,
            filename: `wolo-report-${Date.now()}.xlsx`
        });
        
        if (!exportResult.success) {
            showToast('Failed to generate report', 'danger');
            return;
        }
        
        // Get SMTP settings
        const smtpConfig = {
            host: await ipcRenderer.invoke('get-setting', 'smtp_host') || 'smtp.gmail.com',
            port: parseInt(await ipcRenderer.invoke('get-setting', 'smtp_port')) || 587,
            secure: (await ipcRenderer.invoke('get-setting', 'smtp_secure')) === 'true',
            user: await ipcRenderer.invoke('get-setting', 'smtp_user'),
            pass: await ipcRenderer.invoke('get-setting', 'smtp_pass')
        };
        
        if (!smtpConfig.user || !smtpConfig.pass) {
            showToast('Please configure SMTP settings first', 'warning');
            navigateTo('settings');
            return;
        }
        
        showToast('Sending email...', 'info');
        
        await ipcRenderer.invoke('send-email', {
            to,
            subject,
            body,
            attachmentPath: exportResult.filePath,
            smtpConfig
        });
        
        showToast('Email sent successfully', 'success');
        document.getElementById('emailForm').reset();
    } catch (error) {
        console.error('Error sending email:', error);
        showToast('Error sending email: ' + error.message, 'danger');
    }
}

// Settings
window.loadSettings = async function() {
    try {
        // Get all settings at once
        const settingsData = await settings.get();
        
        // Update the form fields with the settings
        if (settingsData) {
            const setValue = (id, value) => {
                const el = document.getElementById(id);
                if (el) el.value = value || '';
            };
            
            const setChecked = (id, value) => {
                const el = document.getElementById(id);
                if (el) el.checked = value === true || value === 'true';
            };
            
            setValue('smtpHost', settingsData.smtp_host);
            setValue('smtpPort', settingsData.smtp_port || '587');
            setValue('smtpUser', settingsData.smtp_user);
            setValue('smtpPass', settingsData.smtp_pass);
            setChecked('smtpSecure', settingsData.smtp_secure);
            setValue('smtpFrom', settingsData.smtp_from);
        }
    } catch (error) {
        console.error('Error loading settings:', error);
        showToast('Error loading settings', 'danger');
    }
}

async function saveSmtpSettings(event) {
    event.preventDefault();
    
    try {
        const settingsData = {
            smtp_host: document.getElementById('smtpHost').value,
            smtp_port: document.getElementById('smtpPort').value,
            smtp_user: document.getElementById('smtpUser').value,
            smtp_pass: document.getElementById('smtpPass').value,
            smtp_secure: document.getElementById('smtpSecure').checked,
            smtp_from: document.getElementById('smtpFrom').value
        };
        
        await settings.update(settingsData);
        showToast('SMTP settings saved successfully', 'success');
    } catch (error) {
        console.error('Error saving SMTP settings:', error);
        showToast('Error saving SMTP settings: ' + error.message, 'danger');
    }
}


// Activation function
async function activateApp(event) {
    event.preventDefault();
    
    const password = document.getElementById('activationPassword').value;
    const errorDiv = document.getElementById('activationError');
    
    try {
        const result = await ipcRenderer.invoke('activate-app', password);
        
        if (result.success) {
            showToast('App activated successfully!', 'success');
            // Close modal and reload app
            const modal = bootstrap.Modal.getInstance(document.getElementById('activationModal'));
            modal.hide();
            
            // Load data
            await loadProducts();
            await loadSettings();
            updateDashboard();
        } else {
            errorDiv.textContent = result.message;
            errorDiv.classList.remove('d-none');
        }
    } catch (error) {
        console.error('Error activating app:', error);
        errorDiv.textContent = 'An error occurred. Please try again.';
        errorDiv.classList.remove('d-none');
        }
}

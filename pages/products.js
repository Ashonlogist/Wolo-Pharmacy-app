// Products page functionality
import { products } from '../core/api.js';
import { showToast, debounce } from '../core/utils.js';

let currentPage = 1;
const itemsPerPage = 10;
let allProducts = [];
let filteredProducts = [];
let sortConfig = { key: 'name', direction: 'asc' };
let selectedProducts = new Set();

// Initialize products page
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadProducts();
        setupEventListeners();
    } catch (error) {
        console.error('Error  initializing products page:', error);
        showToast('Failed to initialize products page', 'danger');
    }
});

// Setup event listeners for the products page
function setupEventListeners() {
    // Debounced search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(filterProducts, 300));
    }
    
    // Category filter
    document.getElementById('categoryFilter')?.addEventListener('change', filterProducts);
    
    // Stock filter
    document.getElementById('stockFilter')?.addEventListener('change', filterProducts);
    
    // Expiry filter
    document.getElementById('expiryFilter')?.addEventListener('change', filterProducts);
    
    // Add Product button
    const addProductBtn = document.querySelector('[data-navigate-to="product-form"]');
    if (addProductBtn) {
        addProductBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // Reset the form before showing
            const productForm = document.getElementById('productForm');
            if (productForm) productForm.reset();
            // Navigate to product form
            navigateTo('product-form-page');
        });
    }
    
    // Export button
    const exportExcelBtn = document.querySelector('[data-action="export-excel"]');
    if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            exportToExcel();
        });
    }
    
    // Import button and modal handling
    const importBtn = document.querySelector('[data-action="import-products"]');
    const importModalEl = document.getElementById('importProductsModal');
    
    if (importBtn && importModalEl) {
        const importModal = new bootstrap.Modal(importModalEl);
        
        // Handle import button click
        importBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // Reset file input
            const fileInput = document.getElementById('file-input');
            if (fileInput) fileInput.value = '';
            // Enable/disable import button based on file selection
            const processImportBtn = document.getElementById('processImport');
            if (processImportBtn) processImportBtn.disabled = true;
            
            // Show import modal
            importModal.show();
        });
        
        // Handle modal hidden event to ensure cleanup
        importModalEl.addEventListener('hidden.bs.modal', () => {
            // Make sure loading state is reset when modal is closed
            showLoading(false, 'import-modal');
            // Re-enable any disabled elements
            const disabledElements = document.querySelectorAll('[disabled]');
            disabledElements.forEach(el => {
                el.disabled = false;
            });
        });
        
        // Handle file selection
        const fileInput = document.getElementById('file-input');
        const processImportBtn = document.getElementById('processImport');
        
        if (fileInput && processImportBtn) {
            fileInput.addEventListener('change', (e) => {
                processImportBtn.disabled = !e.target.files || e.target.files.length === 0;
            });
        }
    }
    
    // Initialize tooltips
    if (typeof $ !== 'undefined') {
        $('[data-bs-toggle="tooltip"]').tooltip();
    }
}

// Load products from the database
async function loadProducts() {
    try {
        console.log('Fetching products...');
        const response = await products.getAll();
        console.log('Products API response:', response);
        
        // Handle both direct array response and response with success/data structure
        allProducts = Array.isArray(response) ? response : (response.data || []);
        console.log('Parsed products:', allProducts);
        
        if (allProducts.length > 0) {
            console.log('First product sample:', allProducts[0]);
        }
        
        filteredProducts = [...allProducts];
        renderProductsTable();
        updatePagination();
        
        if (allProducts.length > 0) {
            showToast(`${allProducts.length} products loaded`, 'success');
        } else {
            showToast('No products found', 'info');
        }
    } catch (error) {
        console.error('Error loading products:', error);
        showToast('Failed to load products. Check console for details.', 'danger');
    }
}

// Sort products based on current sort configuration
function sortProducts(products) {
    return [...products].sort((a, b) => {
        // Handle null/undefined values
        if (!a[sortConfig.key] && !b[sortConfig.key]) return 0;
        if (!a[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
        if (!b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
        
        // Compare values based on type
        let comparison = 0;
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
            comparison = aValue.localeCompare(bValue);
        } else {
            comparison = aValue > bValue ? 1 : (aValue < bValue ? -1 : 0);
        }
        
        return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
}

// Handle sort when clicking on table headers
function handleSort(key) {
    if (sortConfig.key === key) {
        // Toggle direction if same key
        sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
    } else {
        // New sort key, default to ascending
        sortConfig = { key, direction: 'asc' };
    }
    
    // Update sort indicators
    document.querySelectorAll('.sortable').forEach(header => {
        header.classList.remove('sort-asc', 'sort-desc');
        if (header.dataset.sort === sortConfig.key) {
            header.classList.add(`sort-${sortConfig.direction}`);
        }
    });
    
    renderProductsTable();
}

// Filter products based on search and category
function filterProducts() {
    const searchTerm = document.getElementById('productSearch')?.value.toLowerCase() || '';
    const category = document.getElementById('categoryFilter')?.value || '';
    const showLowStock = document.getElementById('showLowStock')?.checked || false;
    
    filteredProducts = allProducts.filter(product => {
        // Search in multiple fields
        const searchFields = [
            product.name,
            product.barcode,
            product.description,
            product.sku
        ].filter(Boolean).map(f => f.toLowerCase());
        
        const matchesSearch = searchFields.some(field => field.includes(searchTerm));
        const matchesCategory = !category || product.category === category;
        const matchesLowStock = !showLowStock || (product.quantity_in_stock <= (product.low_stock_threshold || 5));
        
        return matchesSearch && matchesCategory && matchesLowStock;
    });
    
    // Apply sorting
    filteredProducts = sortProducts(filteredProducts);
    
    currentPage = 1; // Reset to first page when filtering
    renderProductsTable();
    updatePagination();
    updateBulkActionButtons();
}

// Update pagination controls
function updatePagination() {
    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    const pageInfo = document.getElementById('pageInfo');
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    
    if (pageInfo) {
        pageInfo.textContent = `Page ${currentPage} of ${totalPages || 1}`;
    }
    
    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
}

// Change page
function changePage(direction) {
    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    const newPage = currentPage + direction;
    
    if (newPage > 0 && newPage <= totalPages) {
        currentPage = newPage;
        renderProductsTable();
        updatePagination();
    }
}

// Toggle select all products
function toggleSelectAll(e) {
    const isChecked = e.target.checked;
    const checkboxes = document.querySelectorAll('.product-checkbox');
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = isChecked;
        const productId = parseInt(checkbox.value);
        if (isChecked) {
            selectedProducts.add(productId);
        } else {
            selectedProducts.delete(productId);
        }
    });
    
    updateBulkActionButtons();
}

// Handle product selection
function handleProductSelect(productId, isChecked) {
    if (isChecked) {
        selectedProducts.add(productId);
    } else {
        selectedProducts.delete(productId);
    }
    
    // Update "select all" checkbox
    const selectAllCheckbox = document.getElementById('selectAllProducts');
    if (selectAllCheckbox) {
        const allCheckboxes = document.querySelectorAll('.product-checkbox');
        const allChecked = allCheckboxes.length > 0 && 
                         Array.from(allCheckboxes).every(cb => cb.checked);
        selectAllCheckbox.checked = allChecked;
        selectAllCheckbox.indeterminate = !allChecked && selectedProducts.size > 0;
    }
    
    updateBulkActionButtons();
}

// Update bulk action buttons state
function updateBulkActionButtons() {
    const hasSelection = selectedProducts.size > 0;
    const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
    const exportSelectedBtn = document.getElementById('exportSelectedBtn');
    
    if (bulkDeleteBtn) bulkDeleteBtn.disabled = !hasSelection;
    if (exportSelectedBtn) exportSelectedBtn.disabled = !hasSelection;
    
    // Update selection count
    const selectionCount = document.getElementById('selectionCount');
    if (selectionCount) {
        selectionCount.textContent = hasSelection ? `(${selectedProducts.size} selected)` : '';
    }
}

// Handle bulk delete
async function handleBulkDelete() {
    if (selectedProducts.size === 0) return;
    
    const confirmMessage = `Are you sure you want to delete ${selectedProducts.size} selected product(s)? This action cannot be undone.`;
    
    if (!confirm(confirmMessage)) return;
    
    try {
        showLoading(true, 'bulk-delete');
        const deletePromises = Array.from(selectedProducts).map(id => 
            products.delete(id).catch(e => {
                console.error(`Error deleting product ${id}:`, e);
                return { success: false, id };
            })
        );
        
        const results = await Promise.all(deletePromises);
        const successCount = results.filter(r => r?.success).length;
        
        if (successCount > 0) {
            showToast(`Successfully deleted ${successCount} product(s)`, 'success');
            await loadProducts();
            selectedProducts.clear();
        }
        
        const failedCount = results.length - successCount;
        if (failedCount > 0) {
            showToast(`Failed to delete ${failedCount} product(s)`, 'warning');
        }
    } catch (error) {
        console.error('Error during bulk delete:', error);
        showToast('An error occurred during bulk delete', 'danger');
    } finally {
        showLoading(false, 'bulk-delete');
    }
}

// Render products table
function renderProductsTable() {
    console.log('Rendering products table...');
    const tbody = document.getElementById('productsTableBody');
    if (!tbody) {
        console.error('Could not find #productsTableBody element');
        return;
    }
    
    // Clear existing rows
    tbody.innerHTML = '';
    
    console.log(`Total filtered products: ${filteredProducts.length}`);
    
    // Calculate pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredProducts.length);
    const currentProducts = filteredProducts.slice(startIndex, endIndex);
    
    console.log(`Displaying products ${startIndex + 1} to ${endIndex} of ${filteredProducts.length}`);
    
    if (currentProducts.length === 0) {
        console.log('No products to display');
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="9" class="text-center py-4">
                <i class="bi bi-inbox fs-1 text-muted"></i>
                <p class="mt-2 mb-0">No products found. Try adjusting your search or filters.</p>
            </td>
        `;
        tbody.appendChild(row);
        return;
    }
    
    // Add product rows
    currentProducts.forEach(product => {
        const row = document.createElement('tr');
        
        // Format price and stock
        const price = product.selling_price ? `$${parseFloat(product.selling_price).toFixed(2)}` : '-';
        const stock = product.quantity_in_stock !== undefined ? product.quantity_in_stock : 0;
        const stockClass = stock <= (product.low_stock_threshold || 5) ? 'text-danger fw-bold' : '';
        
        const isSelected = selectedProducts.has(product.id);
        
        row.innerHTML = `
            <td class="text-center">
                <input type="checkbox" class="form-check-input product-checkbox" 
                    value="${product.id}" 
                    ${isSelected ? 'checked' : ''}
                    onchange="handleProductSelect(${product.id}, this.checked)">
            </td>
            <td>
                <div class="d-flex align-items-center">
                    ${product.image_url ? `
                        <img src="${product.image_url}" alt="${product.name}" 
                            class="rounded me-2" style="width: 40px; height: 40px; object-fit: cover;">
                    ` : `
                        <div class="bg-light rounded d-flex align-items-center justify-content-center me-2" 
                            style="width: 40px; height: 40px;">
                            <i class="bi bi-box-seam text-muted"></i>
                        </div>
                    `}
                    <div>
                        <div class="fw-semibold">${product.name || '-'}</div>
                        <small class="text-muted">${product.sku || 'No SKU'}</small>
                    </div>
                </div>
            </td>
            <td>${product.category || '<span class="text-muted">Uncategorized</span>'}</td>
            <td>${product.barcode || '<span class="text-muted">-</span>'}</td>
            <td class="text-end">
                <div class="d-flex flex-column">
                    <span class="text-nowrap">${price}</span>
                    ${product.purchase_price ? `
                        <small class="text-muted">Cost: $${parseFloat(product.purchase_price).toFixed(2)}</small>
                    ` : ''}
                </div>
            </td>
            <td class="text-center ${stockClass}">
                <div class="d-flex align-items-center justify-content-center">
                    ${stock}
                    ${product.low_stock_threshold ? `
                        <small class="text-muted ms-1">/ ${product.low_stock_threshold}</small>
                    ` : ''}
                </div>
            </td>
            <td class="text-center">
                <div class="btn-group btn-group-sm" role="group">
                    <button class="btn btn-outline-primary" 
                            onclick="editProduct(${product.id})"
                            data-bs-toggle="tooltip" 
                            title="Edit Product">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-outline-danger" 
                            onclick="confirmDelete(${product.id}, '${product.name.replace(/'/g, "\\'")}')"
                            data-bs-toggle="tooltip" 
                            title="Delete Product">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        `;
        
        tbody.appendChild(row);
    });
    
    // Update category filter options
    updateCategoryFilter();
}

// Update category filter dropdown
function updateCategoryFilter() {
    const categoryFilter = document.getElementById('categoryFilter');
    if (!categoryFilter) return;
    
    // Get unique categories
    const categories = [...new Set(allProducts.map(p => p.category).filter(Boolean))];
    
    // Save current selection
    const currentValue = categoryFilter.value;
    
    // Update options
    categoryFilter.innerHTML = `
        <option value="">All Categories</option>
        ${categories.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
    `;
    
    // Restore selection if still valid
    if (categories.includes(currentValue)) {
        categoryFilter.value = currentValue;
    }
}

// Confirm before deleting a product
function confirmDelete(productId, productName) {
    if (confirm(`Are you sure you want to delete "${productName}"? This action cannot be undone.`)) {
        deleteProduct(productId);
    }
}

// Delete a product
async function deleteProduct(productId) {
    try {
        await products.delete(productId);
        await loadProducts(); // Refresh the product list
        showToast('Product deleted successfully', 'success');
    } catch (error) {
        console.error('Error deleting product:', error);
        showToast('Failed to delete product', 'danger');
    }
}

// Edit a product
function editProduct(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;
    
    // Populate the edit form
    const form = document.getElementById('editProductForm');
    if (!form) return;
    
    // Set form values
    Object.entries(product).forEach(([key, value]) => {
        const input = form.querySelector(`[name="${key}"]`);
        if (input) {
            if (input.type === 'checkbox') {
                input.checked = !!value;
            } else if (input.type === 'number') {
                input.value = value || '0';
            } else {
                input.value = value || '';
            }
        }
    });
    
    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('editProductModal'));
    modal.show();
}

// Export to Excel
async function exportToExcel(exportSelected = false) {
    try {
        showLoading(true, 'export-products');
        
        // Determine which products to export
        let productsToExport = [];
        
        if (exportSelected && selectedProducts.size > 0) {
            // Export only selected products
            productsToExport = allProducts.filter(p => selectedProducts.has(p.id));
        } else {
            // Export all filtered products
            productsToExport = filteredProducts;
        }
        
        if (productsToExport.length === 0) {
            showToast('No products to export', 'warning');
            return;
        }
        
        // Prepare data for export
        const data = productsToExport.map(product => ({
            'ID': product.id,
            'Name': product.name,
            'SKU': product.sku || '',
            'Category': product.category || '',
            'Barcode': product.barcode || '',
            'Description': product.description || '',
            'Purchase Price': product.purchase_price || 0,
            'Selling Price': product.selling_price || 0,
            'Profit Margin': product.selling_price && product.purchase_price 
                ? `${((product.selling_price - product.purchase_price) / product.purchase_price * 100).toFixed(2)}%` 
                : '0%',
            'Quantity in Stock': product.quantity_in_stock || 0,
            'Low Stock Threshold': product.low_stock_threshold || 5,
            'Unit': product.unit || 'pcs',
            'Status': (product.quantity_in_stock || 0) <= (product.low_stock_threshold || 5) 
                ? 'Low Stock' 
                : 'In Stock',
            'Last Updated': product.updated_at 
                ? new Date(product.updated_at).toLocaleString() 
                : new Date().toLocaleString()
        }));
        
        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `products_${timestamp}`;
        
        // Use the export utility from the API
        await products.exportToExcel(data, filename);
        showToast(`Exported ${data.length} products successfully`, 'success');
    } catch (error) {
        console.error('Error exporting products:', error);
        showToast('Failed to export products: ' + (error.message || 'Unknown error'), 'danger');
    } finally {
        showLoading(false, 'export-products');
    }
}

// Show loading state
function showLoading(show, context = '') {
    const loader = document.getElementById('loadingOverlay');
    if (loader) {
        loader.style.display = show ? 'flex' : 'none';
    }
    
    // Disable/enable buttons during loading
    const buttons = document.querySelectorAll('button');
    buttons.forEach(btn => {
        if (show) {
            btn.disabled = true;
        } else {
            btn.disabled = false;
        }
    });
}

// Navigation function
function navigateTo(page) {
    try {
        // Hide all pages
        document.querySelectorAll('.page').forEach(el => {
            el.classList.remove('active');
        });
        
        // Show target page
        const targetPage = document.getElementById(page);
        if (targetPage) {
            targetPage.classList.add('active');
            // Scroll to top when navigating
            window.scrollTo(0, 0);
            
            // If navigating to products page, refresh the data
            if (page === 'products-page') {
                loadProducts();
            }
        }
    } catch (error) {
        console.error('Navigation error:', error);
    }
}

// Export functions that need to be available globally
window.loadProducts = loadProducts;
window.filterProducts = filterProducts;
window.changePage = changePage;
window.toggleSelectAll = toggleSelectAll;
window.handleProductSelect = handleProductSelect;
window.handleBulkDelete = handleBulkDelete;
window.exportToExcel = exportToExcel;
window.editProduct = editProduct;
window.confirmDelete = confirmDelete;
window.deleteProduct = deleteProduct;

// Initialize the page when DOM is fully loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePage);
} else {
    initializePage();
}

function initializePage() {
    // Setup all event listeners
    setupEventListeners();
    
    // Load initial products
    loadProducts().catch(error => {
        console.error('Failed to load products:', error);
        showToast('Failed to load products. Please try again.', 'danger');
    });
    
    console.log('Products page initialized');
}

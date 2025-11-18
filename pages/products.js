// Products page functionality
import { products } from '../core/api.js';
import { showToast, debounce, formatCurrency } from '../core/utils.js';

let currentPage = 1;
const itemsPerPage = 10;
let allProducts = [];
let filteredProducts = [];
let sortConfig = { key: 'name', direction: 'asc' };
let selectedProducts = new Set();

// Prevent duplicate initialization
let productsPageInitialized = false;

// Initialize products page
async function initializeProductsPage() {
    if (productsPageInitialized) {
        console.warn('Products page already initialized, skipping...');
        // Still update category filter even if already initialized
        await updateCategoryFilter();
        return;
    }
    
    try {
        productsPageInitialized = true;
        await loadProducts();
        setupEventListeners();
        // Ensure category filter is populated after products load
        await updateCategoryFilter();
        console.log('Products page initialized successfully');
    } catch (error) {
        console.error('Error initializing products page:', error);
        showToast('Failed to initialize products page', 'danger');
        productsPageInitialized = false;
    }
}

// Only initialize once when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeProductsPage);
} else {
    // DOM is already ready
    initializeProductsPage();
}

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
            // Navigate to product form (use global navigateTo)
            const navTo = window.navigateTo || window.app?.navigateTo;
            if (navTo) navTo('product-form-page');
        });
    }
    
    // Export button
    const exportExcelBtn = document.querySelector('[data-action="export-excel"]');
    if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // Play export sound
        if (window.soundManager) {
            try {
                window.soundManager.playExport();
            } catch (error) {
                // Ignore sound errors
            }
        }
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
        let productsList = Array.isArray(response) ? response : (response.data || []);
        
        // Filter out inactive products and duplicates
        const seenIds = new Set();
        allProducts = productsList.filter(p => {
            // Skip if no ID
            if (!p.id) return false;
            
            // Skip if already seen (duplicate)
            if (seenIds.has(p.id)) {
                console.warn('Duplicate product found:', p.id, p.name);
                return false;
            }
            
            // Skip inactive products
            if (p.is_active === 0 || p.is_active === false) {
                return false;
            }
            
            seenIds.add(p.id);
            return true;
        });
        
        console.log('Parsed products:', {
            total: allProducts.length,
            products: allProducts.map(p => ({ id: p.id, name: p.name, is_active: p.is_active }))
        });
        
        if (allProducts.length > 0) {
            console.log('First product sample:', allProducts[0]);
        }
        
        filteredProducts = [...allProducts];
        renderProductsTable();
        updatePagination();
        await updateCategoryFilter(); // Make it async since we're loading from API
        
        if (allProducts.length > 0) {
            showToast(`${allProducts.length} product(s) loaded`, 'success');
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
    // Prevent infinite loops
    if (filterProducts.isFiltering) {
        return;
    }
    filterProducts.isFiltering = true;
    
    try {
        const searchInput = document.getElementById('searchInput');
        const searchTerm = searchInput?.value.toLowerCase() || '';
        const category = document.getElementById('categoryFilter')?.value || '';
        const stockFilter = document.getElementById('stockFilter')?.value || '';
        const expiryFilter = document.getElementById('expiryFilter')?.value || '';
    
        filteredProducts = allProducts.filter(product => {
            // Search in multiple fields
            const searchFields = [
                product.name,
                product.barcode,
                product.description,
                product.sku
            ].filter(Boolean).map(f => String(f).toLowerCase());
            
            const matchesSearch = !searchTerm || searchFields.some(field => field.includes(searchTerm));
            const matchesCategory = !category || product.category === category;
            
            // Stock filter
            let matchesStock = true;
            if (stockFilter === 'low') {
                const stock = parseFloat(product.quantity_in_stock || product.quantityInStock || 0);
                const threshold = parseFloat(product.low_stock_threshold || product.reorder_level || 5);
                matchesStock = stock <= threshold;
            } else if (stockFilter === 'out') {
                const stock = parseFloat(product.quantity_in_stock || product.quantityInStock || 0);
                matchesStock = stock === 0;
            }
            
            // Expiry filter
            let matchesExpiry = true;
            if (expiryFilter === 'expiring') {
                const expiryDate = product.expiry_date || product.expiryDate;
                if (expiryDate) {
                    const expiry = new Date(expiryDate);
                    const today = new Date();
                    const daysUntilExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
                    matchesExpiry = daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
                } else {
                    matchesExpiry = false;
                }
            } else if (expiryFilter === 'expired') {
                const expiryDate = product.expiry_date || product.expiryDate;
                if (expiryDate) {
                    const expiry = new Date(expiryDate);
                    const today = new Date();
                    matchesExpiry = expiry < today;
                } else {
                    matchesExpiry = false;
                }
            }
            
            return matchesSearch && matchesCategory && matchesStock && matchesExpiry;
        });
        
        // Apply sorting
        filteredProducts = sortProducts(filteredProducts);
        
        currentPage = 1; // Reset to first page when filtering
        renderProductsTable();
        updatePagination();
        updateBulkActionButtons();
    } finally {
        filterProducts.isFiltering = false;
    }
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
        const productId = checkbox.value; // Keep as string (UUID)
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
    updateSelectionUI();
}

// Update selection UI (count and buttons)
function updateSelectionUI() {
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
                <td colspan="10" class="text-center py-4">
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
        
        // Format data - handle both snake_case and camelCase
        const name = product.name || '-';
        const category = product.category || '<span class="text-muted">Uncategorized</span>';
        const stock = parseFloat(product.quantity_in_stock || product.quantityInStock || 0);
        const shelf = parseFloat(product.quantity_on_shelf || product.quantityOnShelf || 0);
        const unitCost = parseFloat(product.cost_price || product.costPrice || product.purchase_price || 0);
        const sellingPrice = parseFloat(product.selling_price || product.sale_price || 0);
        
        // Calculate profit percentage
        let profitPercent = 0;
        if (unitCost > 0 && sellingPrice > 0) {
            profitPercent = ((sellingPrice - unitCost) / unitCost) * 100;
        }
        
        // Format expiry date
        let expiryDate = '-';
        if (product.expiry_date || product.expiryDate) {
            try {
                const expiry = new Date(product.expiry_date || product.expiryDate);
                expiryDate = expiry.toLocaleDateString();
                // Check if expired
                if (expiry < new Date()) {
                    expiryDate = `<span class="text-danger">${expiryDate} (Expired)</span>`;
                } else {
                    // Check if expiring soon (within 30 days)
                    const daysUntilExpiry = Math.ceil((expiry - new Date()) / (1000 * 60 * 60 * 24));
                    if (daysUntilExpiry <= 30) {
                        expiryDate = `<span class="text-warning">${expiryDate} (${daysUntilExpiry}d)</span>`;
                    }
                }
            } catch (e) {
                expiryDate = product.expiry_date || product.expiryDate || '-';
            }
        }
        
        const stockClass = stock <= (product.low_stock_threshold || product.reorder_level || 5) ? 'text-danger fw-bold' : '';
        const isSelected = selectedProducts.has(product.id);
        
        row.innerHTML = `
            <td>
                <input type="checkbox" 
                       class="form-check-input product-checkbox" 
                       value="${product.id}"
                       ${isSelected ? 'checked' : ''}
                       onchange="handleProductSelect('${product.id}', this.checked)">
            </td>
            <td>
                <div class="fw-semibold">${name}</div>
                <small class="text-muted">${product.sku || 'No SKU'}</small>
            </td>
            <td>${category}</td>
            <td class="text-center ${stockClass}">
                <span class="fw-semibold">${stock}</span>
                ${product.low_stock_threshold || product.reorder_level ? `
                    <small class="text-muted d-block">/ ${product.low_stock_threshold || product.reorder_level}</small>
                ` : ''}
            </td>
            <td class="text-center">${shelf}</td>
            <td class="text-end">${unitCost > 0 ? formatCurrency(unitCost) : '-'}</td>
            <td class="text-end">${sellingPrice > 0 ? formatCurrency(sellingPrice) : '-'}</td>
            <td class="text-center ${profitPercent > 0 ? 'text-success' : ''}">
                ${profitPercent > 0 ? `${profitPercent.toFixed(1)}%` : '-'}
            </td>
            <td class="text-center">${expiryDate}</td>
            <td class="text-center">
                <div class="btn-group btn-group-sm" role="group">
                    <button class="btn btn-outline-primary edit-product-btn" 
                            data-product-id="${product.id}"
                            data-bs-toggle="tooltip" 
                            title="Edit Product">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-outline-danger delete-product-btn" 
                            data-product-id="${product.id}"
                            data-product-name="${(product.name || '').replace(/"/g, '&quot;')}"
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
    
    // Attach event listeners to edit and delete buttons
    attachActionButtonListeners();
}

// Attach event listeners to action buttons
function attachActionButtonListeners() {
    // Edit buttons
    document.querySelectorAll('.edit-product-btn').forEach(btn => {
        // Remove existing listeners by cloning
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', (e) => {
            const productId = e.currentTarget.dataset.productId;
            if (productId) {
                editProduct(productId);
            }
        });
    });
    
    // Delete buttons
    document.querySelectorAll('.delete-product-btn').forEach(btn => {
        // Remove existing listeners by cloning
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', (e) => {
            const productId = e.currentTarget.dataset.productId;
            const productName = e.currentTarget.dataset.productName;
            if (productId) {
                confirmDelete(productId, productName);
            }
        });
    });
}

// Update category filter dropdown
async function updateCategoryFilter() {
    console.log('updateCategoryFilter called, allProducts count:', allProducts.length);
    
    // Find the categoryFilter in the products page (inside filters-bar or products-page)
    let categoryFilter = document.querySelector('#products-page #categoryFilter') || 
                         document.querySelector('.filters-bar #categoryFilter') ||
                         document.querySelector('#categoryFilter');
    
    if (!categoryFilter) {
        console.warn('Category filter element not found. Retrying after delay...');
        // Try again after a short delay in case DOM isn't ready
        await new Promise(resolve => setTimeout(resolve, 200));
        categoryFilter = document.querySelector('#products-page #categoryFilter') || 
                         document.querySelector('.filters-bar #categoryFilter') ||
                         document.querySelector('#categoryFilter');
        if (!categoryFilter) {
            console.error('Category filter element still not found after retry');
            return;
        }
    }
    
    console.log('Category filter element found:', categoryFilter, 'Parent:', categoryFilter.closest('.filters-bar') || categoryFilter.closest('#products-page'));
    
    // Get unique categories from products (handle both snake_case and camelCase)
    const categoriesFromProducts = [...new Set(
        allProducts
            .map(p => p.category || p.category_name || p.categoryName)
            .filter(Boolean)
            .map(cat => String(cat).trim())
            .filter(cat => cat.length > 0)
    )];
    
    // Try to also load from categories API
    let categoriesFromAPI = [];
    try {
        const { categories: categoriesApi } = await import('../core/api.js');
        if (categoriesApi && typeof categoriesApi.getAll === 'function') {
            const apiCategories = await categoriesApi.getAll();
            if (Array.isArray(apiCategories)) {
                categoriesFromAPI = apiCategories.map(cat => 
                    typeof cat === 'string' ? cat : (cat.name || cat.category || '')
                ).filter(Boolean);
            }
        }
    } catch (err) {
        console.warn('Could not load categories from API:', err);
    }
    
    // Combine and deduplicate categories
    const allCategories = [...new Set([...categoriesFromProducts, ...categoriesFromAPI])].sort();
    
    console.log('Categories found:', {
        allProductsCount: allProducts.length,
        fromProducts: categoriesFromProducts,
        fromAPI: categoriesFromAPI,
        combined: allCategories,
        sampleProducts: allProducts.slice(0, 3).map(p => ({ name: p.name, category: p.category, category_name: p.category_name }))
    });
    
    // Save current selection
    const currentValue = categoryFilter.value;
    
    // Clear existing options first
    categoryFilter.innerHTML = '';
    
    // Add "All Categories" option
    const allOption = document.createElement('option');
    allOption.value = '';
    allOption.textContent = 'All Categories';
    categoryFilter.appendChild(allOption);
    
    // Add category options using createElement to ensure proper DOM manipulation
    allCategories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        categoryFilter.appendChild(option);
    });
    
    // Force a reflow to ensure the DOM is updated
    categoryFilter.offsetHeight;
    
    // Restore selection if still valid
    if (allCategories.includes(currentValue)) {
        categoryFilter.value = currentValue;
    }
    
    // Verify the update worked
    const optionCount = categoryFilter.options.length;
    const optionTexts = Array.from(categoryFilter.options).map(opt => opt.textContent);
    console.log(`Category filter updated with ${allCategories.length} categories. Total options: ${optionCount}`, optionTexts);
    
    // Double-check by reading back the options
    if (optionCount <= 1 && allCategories.length > 0) {
        console.error('Options were not added properly! Retrying with innerHTML...');
        // Fallback to innerHTML if appendChild didn't work
        categoryFilter.innerHTML = `
            <option value="">All Categories</option>
            ${allCategories.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
        `;
        if (allCategories.includes(currentValue)) {
            categoryFilter.value = currentValue;
        }
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
        // Get product data before deletion for undo
        const product = await products.getById(productId);
        
        // Delete the product
        const result = await products.delete(productId);
        
        if (result && result.success) {
            // Play delete sound
            if (window.soundManager) {
                try {
                    window.soundManager.playDelete();
                } catch (error) {
                    // Ignore sound errors
                }
            }
            
            // Save to undo/redo history
            if (window.globalUndoRedo && product) {
                window.globalUndoRedo.saveAction({
                    type: 'delete-product',
                    description: `Deleted product: ${product.name || productId}`,
                    productData: product,
                    productId: productId,
                    undo: async () => {
                        // Restore the product
                        if (product) {
                            await products.create(product);
                            await loadProducts();
                            if (typeof window.refreshDashboard === 'function') {
                                window.refreshDashboard(true);
                            }
                        }
                    },
                    redo: async () => {
                        // Delete again
                        await products.delete(productId);
                        await loadProducts();
                        if (typeof window.refreshDashboard === 'function') {
                            window.refreshDashboard(true);
                        }
                    }
                });
            }
            
            await loadProducts(); // Refresh the product list
            if (typeof window.refreshDashboard === 'function') {
                window.refreshDashboard(true);
            }
            showToast('Product deleted successfully', 'success');
        } else {
            throw new Error(result?.error || 'Delete failed');
        }
    } catch (error) {
        console.error('Error deleting product:', error);
        showToast('Failed to delete product: ' + (error.message || 'Unknown error'), 'danger');
    }
}

// Edit a product - navigate to product form page with product ID
async function editProduct(productId) {
    if (!productId) {
        showToast('Product ID is missing', 'danger');
        return;
    }
    
    try {
        console.log('Editing product with ID:', productId);
        
        // Navigate to product form page first
        let navigated = false;
        
        if (typeof window.navigateTo === 'function') {
            try {
                await window.navigateTo('product-form');
                navigated = true;
                console.log('Navigated to product-form via window.navigateTo');
            } catch (e) {
                console.warn('Navigation via window.navigateTo failed:', e);
            }
        }
        
        if (!navigated && window.app && typeof window.app.navigateTo === 'function') {
            try {
                await window.app.navigateTo('product-form');
                navigated = true;
                console.log('Navigated to product-form via window.app.navigateTo');
            } catch (e) {
                console.warn('Navigation via window.app.navigateTo failed:', e);
            }
        }
        
        if (!navigated) {
            // Fallback: use hash navigation
            window.location.hash = '#product-form';
            // Also try direct page switching
            const productFormPage = document.getElementById('product-form-page');
            const productsPage = document.getElementById('products-page');
            if (productFormPage && productsPage) {
                productsPage.classList.remove('active');
                productFormPage.classList.add('active');
                
                // Update navigation active state
                document.querySelectorAll('.nav-item').forEach(item => {
                    item.classList.remove('active');
                    if (item.getAttribute('data-page') === 'product-form') {
                        item.classList.add('active');
                    }
                });
            }
        }
        
        // Set the product ID in the URL
        try {
            const url = new URL(window.location.href);
            url.searchParams.set('id', productId);
            window.history.pushState({}, '', url);
        } catch (e) {
            // If URL manipulation fails, use hash
            window.location.hash = `#product-form?id=${productId}`;
        }
        
        // Wait a bit for the page to be visible, then load the product
        setTimeout(async () => {
            try {
                // Check if loadProductForEditing is available
                if (typeof window.loadProductForEditing === 'function') {
                    await window.loadProductForEditing(productId);
                } else {
                    // Dispatch event for product form to listen to
                    const event = new CustomEvent('product-edit', { 
                        detail: { productId },
                        bubbles: true
                    });
                    window.dispatchEvent(event);
                    
                    // Also try calling it directly if the form module is loaded
                    const productFormPage = document.getElementById('product-form-page');
                    if (productFormPage && productFormPage.classList.contains('active')) {
                        // Try to trigger the load function
                        setTimeout(() => {
                            if (typeof window.loadProductForEditing === 'function') {
                                window.loadProductForEditing(productId);
                            }
                        }, 200);
                    }
                }
            } catch (loadError) {
                console.error('Error loading product for editing:', loadError);
                showToast('Failed to load product data', 'danger');
            }
        }, 300);
        
    } catch (error) {
        console.error('Error navigating to edit product:', error);
        showToast('Failed to open edit form', 'danger');
    }
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
        
        try {
            // Use the backend export API
            const result = await products.exportToExcel(productsToExport);
            showToast(`Successfully exported ${productsToExport.length} product(s) to Excel`, 'success');
        } catch (error) {
            console.error('Error exporting products:', error);
            // Fallback: show info message
            showToast(`Prepared ${productsToExport.length} products for export. Export functionality may need backend implementation.`, 'info');
        }
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

// Use global navigateTo from core/navigation.js instead of duplicating
// Removed duplicate navigateTo function - use window.navigateTo or window.app.navigateTo

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
window.attachActionButtonListeners = attachActionButtonListeners;
window.updateCategoryFilter = updateCategoryFilter;

// Remove duplicate initialization - already handled by initializeProductsPage()

// Product form page functionality
// Using global uuidv4, API objects, and utility functions from index.html

// Alias global API objects and utility functions for better minification
const {
    productsApi: products,
    settingsApi: settings,
    categoriesApi: categories,
    suppliersApi: suppliers,
    showToast,
    showLoading,
    debounce
} = window;

// Debug logging for API availability
console.log('Products API available:', !!products);
console.log('Categories API available:', !!categories);
console.log('Suppliers API available:', !!suppliers);

// Fallback implementations if APIs are not available
if (!products || typeof products.getAll !== 'function') {
    console.warn('Products API not properly initialized');
    window.productsApi = window.productsApi || {
        getAll: () => Promise.resolve([]),
        getById: () => Promise.resolve(null),
        create: () => Promise.resolve({ success: false, error: 'API not initialized' }),
        update: () => Promise.resolve({ success: false, error: 'API not initialized' }),
        delete: () => Promise.resolve({ success: false, error: 'API not initialized' })
    };
}

if (!categories || typeof categories.getAll !== 'function') {
    console.warn('Categories API not properly initialized');
    window.categoriesApi = window.categoriesApi || {
        getAll: () => Promise.resolve([]),
        create: () => Promise.resolve({ success: false, error: 'API not initialized' })
    };
}

if (!suppliers || typeof suppliers.getAll !== 'function') {
    console.warn('Suppliers API not properly initialized');
    window.suppliersApi = window.suppliersApi || {
        getAll: () => Promise.resolve([]),
        create: () => Promise.resolve({ success: false, error: 'API not initialized' })
    };
}

// Form state
let formState = {
    isSubmitting: false,
    productImages: [],
    variants: [],
    variantOptions: []
};

// Initialize the product form
async function initializeForm() {
    // Show loading state
    showLoading(true, 'form-loading');
    
    try {
        // Check for product ID from URL params or hash
        let productId = null;
        const urlParams = new URLSearchParams(window.location.search);
        productId = urlParams.get('id');
        
        // Also check hash for product ID
        if (!productId && window.location.hash) {
            const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
            productId = hashParams.get('id');
        }
        
        // Listen for product-edit event (can be triggered from other pages)
        const handleProductEdit = async (event) => {
            if (event.detail && event.detail.productId) {
                console.log('Received product-edit event for ID:', event.detail.productId);
                await loadProductForEditing(event.detail.productId);
            }
        };
        window.addEventListener('product-edit', handleProductEdit);
        
        // Also expose loadProductForEditing globally so other pages can call it directly
        window.loadProductForEditing = loadProductForEditing;
        
        const isEdit = !!productId;
        
        if (productId) {
            console.log('Loading product for editing from URL:', productId);
            await loadProductForEditing(productId);
        } else {
            // For new products, generate a unique ID using uuid
            const productIdEl = document.getElementById('productId');
            if (productIdEl) {
                productIdEl.value = uuidv4();
            }
        }
        
        // Initialize variant management
        if (typeof initializeVariantManagement === 'function') {
            initializeVariantManagement();
        }
        
    } catch (error) {
        console.error('Error initializing form:', error);
        showToast('Error initializing form. Please try again.', 'danger');
    } finally {
        showLoading(false, 'form-loading');
    }
}

// Load initial data like categories, suppliers, etc.
async function loadInitialData() {
    try {
        showLoading(true, 'initial-data');
        console.log('Loading initial data...');
        
        // Load categories from products (since categories are stored in products table)
        // and suppliers in parallel
        let categoriesResponse = [];
        try {
            // Try to get categories from products API
            const productsResponse = await products.getAll().catch(() => []);
            if (Array.isArray(productsResponse)) {
                // Extract unique categories from products
                const categorySet = new Set();
                productsResponse.forEach(product => {
                    if (product.category && product.category.trim()) {
                        categorySet.add(product.category.trim());
                    }
                });
                categoriesResponse = Array.from(categorySet).map(cat => ({ name: cat, id: cat }));
            }
        } catch (err) {
            console.error('Error loading categories from products:', err);
        }
        
        // Try to get categories from categories API if available
        if (categories && typeof categories.getAll === 'function') {
            try {
                const apiCategories = await categories.getAll();
                if (Array.isArray(apiCategories) && apiCategories.length > 0) {
                    categoriesResponse = apiCategories;
                }
            } catch (err) {
                console.warn('Categories API not available, using categories from products');
            }
        }
        
        // Load suppliers
        const suppliersResponse = await (suppliers && typeof suppliers.getAll === 'function' 
            ? suppliers.getAll().catch(err => {
                console.error('Error loading suppliers:', err);
                return [];
            })
            : Promise.resolve([]));
        
        // Log the responses for debugging
        console.log('Categories response:', categoriesResponse);
        console.log('Suppliers response:', suppliersResponse);
        
        // Check if we got valid data
        if (!Array.isArray(categoriesResponse)) {
            console.warn('Invalid categories data received:', categoriesResponse);
            showToast('Failed to load categories. Using empty list.', 'warning');
        } else {
            // Populate category dropdown and datalist
            populateDropdown('category', categoriesResponse, 'name', 'id');
            populateCategoryDatalist(categoriesResponse);
        }
        
        if (!Array.isArray(suppliersResponse)) {
            console.warn('Invalid suppliers data received:', suppliersResponse);
            showToast('Failed to load suppliers. Using empty list.', 'warning');
        } else {
            populateDropdown('supplierId', suppliersResponse, 'name', 'id');
        }
        
        // Initialize rich text editor if available
        initializeRichTextEditor();
        
    } catch (error) {
        console.error('Error loading initial data:', error);
        throw error;
    }
}

// Populate dropdown with data
function populateDropdown(selectId, data, displayField, valueField = 'id') {
    const select = document.getElementById(selectId);
    if (!select) {
        console.warn(`Dropdown element with ID '${selectId}' not found`);
        return;
    }
    
    // Save current value
    const currentValue = select.value;
    
    // Clear existing options except the first one (usually 'Select...')
    while (select.options.length > 1) {
        select.remove(1);
    }
    
    // Add options from data
    data.forEach(item => {
        const option = document.createElement('option');
        option.value = item[valueField] || item[displayField]; // Use valueField or displayField as fallback
        option.textContent = item[displayField] || `[No ${displayField}]`;
        select.appendChild(option);
    });
    
    // Restore selection if it still exists
    if (currentValue && [...select.options].some(opt => opt.value === currentValue)) {
        select.value = currentValue;
    }
}

// Populate category datalist for autocomplete
function populateCategoryDatalist(categories) {
    const datalist = document.getElementById('categoryList');
    if (!datalist) return;
    
    // Clear existing options
    datalist.innerHTML = '';
    
    // Add options from categories
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.name || category.category || '';
        datalist.appendChild(option);
    });
}

// Initialize rich text editor for description
function initializeRichTextEditor() {
    const descriptionEl = document.getElementById('description');
    if (descriptionEl && window.SimpleMDE) {
        window.descriptionEditor = new SimpleMDE({
            element: descriptionEl,
            spellChecker: false,
            toolbar: [
                'bold', 'italic', 'heading', '|',
                'quote', 'unordered-list', 'ordered-list', '|',
                'link', 'image', 'table', '|',
                'preview', 'side-by-side', 'fullscreen', '|',
                'guide'
            ]
        });
    }
}

// Set up event listeners for the form
function setupEventListeners() {
    const form = document.getElementById('productForm');
    if (!form) return;
    
    // Form submission with validation
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        handleFormSubmit(e);
    });
    
    // Price calculation inputs
    const priceInputs = ['totalBulkCost', 'quantityPurchased', 'profitMargin'];
    priceInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('input', calculatePrices);
            input.addEventListener('change', calculatePrices);
        }
    });
    
    // Reset form button
    const resetBtn = document.getElementById('resetFormBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetForm);
    }
    
    // Real-time validation
    const validateFields = ['name', 'sku', 'barcode', 'quantityInStock', 'costPrice', 'sellingPrice'];
    validateFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('input', debounce(validateField, 300));
            field.addEventListener('blur', validateField);
        }
    });
    
    // Price calculation for profit margin
    const profitInputs = ['costPrice', 'sellingPrice', 'wholesalePrice'];
    profitInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', calculateProfit);
        }
    });
    
    // Barcode scanner
    const barcodeInput = document.getElementById('barcode');
    if (barcodeInput) {
        // Real-time barcode validation
        barcodeInput.addEventListener('input', debounce(() => {
            validateBarcode(barcodeInput.value);
        }, 500));
        
        // Barcode scanner detection (Enter key)
        barcodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                lookupBarcode(barcodeInput.value);
            }
        });
    }
    
    // Image upload
    const imageUpload = document.getElementById('productImages');
    if (imageUpload) {
        imageUpload.addEventListener('change', handleImageUpload);
    }
    
    // Category management
    const addCategoryBtn = document.getElementById('addCategoryBtn');
    if (addCategoryBtn) {
        addCategoryBtn.addEventListener('click', showAddCategoryModal);
    }
    
    // Inventory tracking toggle
    const trackInventory = document.getElementById('trackInventory');
    if (trackInventory) {
        trackInventory.addEventListener('change', (e) => {
            const inventoryFields = document.getElementById('inventoryFields');
            if (inventoryFields) {
                inventoryFields.style.display = e.target.checked ? 'block' : 'none';
            }
        });
    }
    
    // Initialize tooltips if jQuery is available
    if (window.jQuery && typeof jQuery.fn.tooltip === 'function') {
        jQuery('[data-bs-toggle="tooltip"]').tooltip();
    }
    
    // Initialize date picker for expiry date
    const expiryDate = document.getElementById('expiryDate');
    if (expiryDate) {
        if (window.jQuery && jQuery.fn.datepicker) {
            try {
                jQuery(expiryDate).datepicker({
                    dateFormat: 'yy-mm-dd',
                    changeMonth: true,
                    changeYear: true,
                    yearRange: '2020:2030',
                    // Ensure the datepicker is properly initialized even if the input is hidden
                    beforeShow: function(input, inst) {
                        setTimeout(function() {
                            inst.dpDiv.css({
                                position: 'absolute',
                                zIndex: 9999
                            });
                        }, 0);
                    }
                });
                
                // Add a class to indicate datepicker is initialized
                expiryDate.classList.add('has-datepicker');
            } catch (error) {
                console.warn('Failed to initialize datepicker:', error);
                // Fallback to native date input if datepicker fails
                if (expiryDate.type !== 'date') {
                    expiryDate.type = 'date';
                }
            }
        } else if (expiryDate.type !== 'date') {
            // Fallback to native date input if jQuery UI datepicker is not available
            expiryDate.type = 'date';
        }
    }
}

// Load product data for editing
async function loadProductForEditing(productId) {
    showLoading(true, 'product-loading');
    
    try {
        const product = await products.getById(productId);
        if (!product) {
            throw new Error('Product not found');
        }
        
        // Basic info - try both field ID variations
        const productIdEl = document.getElementById('productId');
        if (productIdEl) productIdEl.value = product.id;
        
        // Try name field, fallback to productName
        if (!setFormValue('name', product.name)) {
            setFormValue('productName', product.name);
        }
        setFormValue('sku', product.sku);
        
        // Try barcode field, fallback to productBarcode
        if (!setFormValue('barcode', product.barcode)) {
            setFormValue('productBarcode', product.barcode);
        }
        
        // Category - use category name if available, otherwise categoryId
        const categoryValue = product.category || product.category_name || product.categoryId;
        if (!setFormValue('category', categoryValue)) {
            setFormValue('productCategory', categoryValue);
        }
        
        setFormValue('brand', product.brand);
        setFormValue('supplierId', product.supplierId);
        
        // Description - try both field IDs
        if (window.descriptionEditor) {
            window.descriptionEditor.value(product.description || '');
        } else {
            if (!setFormValue('description', product.description)) {
                setFormValue('productDescription', product.description);
            }
        }
        
        // Pricing - handle both snake_case and camelCase
        const costPrice = product.cost_price || product.costPrice || 0;
        const sellingPrice = product.selling_price || product.sellingPrice || 0;
        const totalBulkCost = product.total_bulk_cost || product.totalBulkCost || 0;
        const quantityPurchased = product.quantity_purchased || product.quantityPurchased || 0;
        
        setFormValue('totalBulkCost', totalBulkCost);
        setFormValue('quantityPurchased', quantityPurchased);
        setFormValue('profitMargin', product.profit_margin || product.profitMargin || 0);
        
        // Calculate and set unit cost price
        if (totalBulkCost > 0 && quantityPurchased > 0) {
            const unitCost = totalBulkCost / quantityPurchased;
            setFormValue('unitCostPrice', unitCost.toFixed(2));
        } else if (costPrice > 0) {
            setFormValue('unitCostPrice', costPrice.toFixed(2));
        }
        
        setFormValue('sellingPrice', sellingPrice);
        setFormValue('wholesalePrice', product.wholesale_price || product.wholesalePrice || 0);
        setFormValue('taxRate', product.tax_rate || product.taxRate || 0);
        setFormValue('taxInclusive', product.tax_inclusive || product.taxInclusive || false);
        
        // Inventory - handle both snake_case and camelCase
        setFormValue('quantityInStock', product.quantity_in_stock || product.quantityInStock || 0);
        setFormValue('quantityOnShelf', product.quantity_on_shelf || product.quantityOnShelf || 0);
        setFormValue('reorderLevel', product.reorder_level || product.reorderLevel || 5);
        setFormValue('unit', product.unit_of_measure || product.unit || 'pcs');
        setFormValue('weight', product.weight || 0);
        setFormValue('dimensions', product.dimensions || '');
        
        // Status
        setFormValue('isActive', product.is_active !== undefined ? product.is_active : (product.isActive !== undefined ? product.isActive : 1));
        setFormValue('trackInventory', product.track_inventory || product.trackInventory || false);
        
        // Dates - handle both snake_case and camelCase
        setFormValue('manufacturedDate', product.manufactured_date || product.manufacturedDate || '');
        setFormValue('expiryDate', product.expiry_date || product.expiryDate || '');
        
        // Trigger price calculation to update calculated fields
        if (typeof calculatePrices === 'function') {
            setTimeout(() => calculatePrices(), 100);
        }
        
        // Images
        if (product.images && product.images.length > 0) {
            formState.selectedImages = product.images;
            renderImagePreviews();
        }
        
        // Variants
        if (product.variants && product.variants.length > 0) {
            formState.variants = product.variants;
            renderVariants();
        }
        
        // Update form title
        const formTitle = document.getElementById('productFormTitle');
        if (formTitle) {
            formTitle.textContent = `Edit Product: ${product.name}`;
        }
        
        // Show success message
        showToast('Product loaded for editing', 'success');
        
    } catch (error) {
        console.error('Error loading product:', error);
        showToast(`Failed to load product: ${error.message}`, 'danger');
        
        // Redirect back after a delay
        setTimeout(() => {
            window.app.navigateTo('products');
        }, 2000);
    } finally {
        showLoading(false, 'product-loading');
    }
}

// Helper function to set form values
function setFormValue(id, value) {
    const element = document.getElementById(id);
    if (!element) return false; // Return false if element not found
    
    if (element.type === 'checkbox') {
        element.checked = !!value;
    } else if (element.type === 'radio') {
        const radio = document.querySelector(`input[name="${id}"][value="${value}"]`);
        if (radio) radio.checked = true;
    } else {
        element.value = value !== null && value !== undefined ? value : '';
    }
    return true; // Return true if element was found and value was set
}

// Calculate profit based on cost and selling price
function calculateProfit() {
    const costPrice = parseFloat(document.getElementById('costPrice').value) || 0;
    const sellingPrice = parseFloat(document.getElementById('sellingPrice').value) || 0;
    
    if (costPrice > 0 && sellingPrice > 0) {
        const profit = sellingPrice - costPrice;
        const profitPercentage = (profit / costPrice) * 100;
        
        const profitElement = document.getElementById('profitInfo');
        if (profitElement) {
            profitElement.textContent = `Profit: $${profit.toFixed(2)} (${profitPercentage.toFixed(2)}%)`;
        }
    }
}

// Lookup product by barcode
async function lookupBarcode(barcode) {
    if (!barcode) return;
    
    try {
        const product = await ipcRenderer.invoke('get-product-by-barcode', barcode);
        if (product) {
            // Fill form with product data
            document.getElementById('name').value = product.name;
            document.getElementById('description').value = product.description || '';
            document.getElementById('category').value = product.category || '';
            // ... fill other fields as needed
            
            showToast('Product found by barcode', 'success');
        } else {
            showToast('No product found with this barcode', 'info');
        }
    } catch (error) {
        console.error('Error looking up barcode:', error);
        showToast('Error looking up barcode', 'danger');
    }
}

// Reset form to default values
function resetForm() {
    const form = document.getElementById('productForm');
    if (form) {
        form.reset();
        document.getElementById('productId').value = '';
        
        // Reset form title
        const formTitle = document.getElementById('productFormTitle');
        if (formTitle) {
            formTitle.textContent = 'Add New Product';
        }
    }
}

// Handle form submission with validation
async function handleFormSubmit(event) {
    // Prevent default form submission
    event.preventDefault();
    
    // Prevent double submission
    if (formState.isSubmitting) return;
    
    // Get product ID from URL for edit mode
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');
    const isEdit = !!productId;
    
    // Validate all fields
    if (!validateForm()) {
        console.log('Form validation failed');
        showToast('Please fill in all required fields', 'warning');
        return;
    }
    
    // Set submitting state
    formState.isSubmitting = true;
    const submitButton = event.target.querySelector('button[type="submit"]');
    const originalButtonText = submitButton ? submitButton.innerHTML : '';
    
    try {
        // Show loading state
        showLoading(true, 'form-submit');
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
        }
        
        // Prepare product data
        const productData = await getFormData();
        
        // Handle image uploads if any
        if (formState.selectedImages && formState.selectedImages.length > 0) {
            try {
                console.log('Processing images...');
                const uploadedImages = await uploadImages(formState.selectedImages);
                productData.images = uploadedImages;
            } catch (error) {
                console.error('Error uploading images:', error);
                // Continue without images if upload fails
                productData.images = [];
            }
        } else {
            productData.images = [];
        }
        
        // Add variants if any
        if (formState.variants && formState.variants.length > 0) {
            productData.variants = formState.variants;
        }
        
        console.log('Form data prepared:', productData);
        
        console.log('Attempting to save product...');
        
        // Save the product
        console.log('Saving product data:', JSON.stringify(productData, null, 2));
        
        let result;
        try {
            result = isEdit 
                ? await products.update(productId, productData)
                : await products.create(productData);
            
            console.log('Save response:', result);
            
            if (!result) {
                throw new Error('No response from server');
            }
            
            if (!result.success) {
                throw new Error(result.error || 'Failed to save product');
            }
            
            // Get the product ID from the response or use the one we generated
            const savedProductId = result.id || result.productId || productData.id || productId;
            
            if (!savedProductId) {
                throw new Error('No product ID returned from server');
            }
            
            console.log('Product saved successfully with ID:', savedProductId, 'Full response:', result);
            
            // Update the form with the server response data if available
            if (result.data) {
                console.log('Updating form with server response data:', result.data);
                // Update any fields that might have been modified by the server
                if (result.data.sku) document.getElementById('sku').value = result.data.sku;
                if (result.data.barcode) document.getElementById('barcode').value = result.data.barcode;
            }
            
            // Play save sound
            if (window.soundManager) {
                try {
                    window.soundManager.playSave();
                } catch (error) {
                    // Ignore sound errors
                }
            }
            
            // After successful save - handle navigation and refresh
            if (isEdit) {
                // For updates, show success message and reload the product
                showToast('Product updated successfully!', 'success', 3000);
                
                // Small delay to ensure the toast is visible before reloading
                setTimeout(async () => {
                    try {
                        await loadProductForEditing(savedProductId);
                    } catch (loadError) {
                        console.error('Error reloading product:', loadError);
                        showToast('Product updated, but there was an error refreshing the view', 'warning');
                    }
                }, 500);
            } else {
                // For new products, show success message
                showToast('Product created successfully!', 'success', 3000);
                
                // Refresh products list and dashboard in parallel for faster execution
                const refreshPromises = [];
                
                if (typeof window.loadProducts === 'function') {
                    refreshPromises.push(
                        window.loadProducts().catch(e => {
                            console.warn('Could not refresh products list:', e);
                        })
                    );
                }
                
                if (typeof window.refreshDashboard === 'function') {
                    refreshPromises.push(
                        window.refreshDashboard(true).catch(e => {
                            console.warn('Could not refresh dashboard:', e);
                        })
                    );
                }
                
                // Wait for refreshes to complete, then navigate
                await Promise.allSettled(refreshPromises);
                
                // Navigate to products page immediately after refresh
                // Try multiple navigation methods to ensure it works
                let navigated = false;
                
                if (typeof window.navigateTo === 'function') {
                    try {
                        await window.navigateTo('products');
                        navigated = true;
                        console.log('Navigated to products page via window.navigateTo');
                    } catch (e) {
                        console.warn('Navigation via window.navigateTo failed:', e);
                    }
                }
                
                if (!navigated && window.app && typeof window.app.navigateTo === 'function') {
                    try {
                        await window.app.navigateTo('products');
                        navigated = true;
                        console.log('Navigated to products page via window.app.navigateTo');
                    } catch (e) {
                        console.warn('Navigation via window.app.navigateTo failed:', e);
                    }
                }
                
                if (!navigated) {
                    // Fallback: use hash navigation and direct page switching
                    window.location.hash = '#products';
                    console.log('Using hash navigation fallback');
                    
                    // Also try direct page switching as last resort
                    setTimeout(() => {
                        const productsPage = document.getElementById('products-page');
                        const productFormPage = document.getElementById('product-form-page');
                        if (productsPage && productFormPage) {
                            productFormPage.classList.remove('active');
                            productsPage.classList.add('active');
                            
                            // Update navigation active state
                            document.querySelectorAll('.nav-item').forEach(item => {
                                item.classList.remove('active');
                                if (item.getAttribute('data-page') === 'products') {
                                    item.classList.add('active');
                                }
                            });
                            
                            console.log('Direct page switch completed');
                        }
                    }, 100);
                }
            }
            
        } catch (error) {
            console.error('Error during save operation:', error);
            throw new Error(`Save failed: ${error.message || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Error saving product:', error);
        showToast(
            `Failed to save product: ${error.message || 'Unknown error'}`,
            'danger'
        );
        // Don't re-throw to prevent unhandled promise rejection
    } finally {
        // Reset form state
        formState.isSubmitting = false;
        showLoading(false, 'form-submit');
        
        // Reset submit button
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonText || 'Save Product';
        }
    }
}

// Wait for jQuery to be available before initializing
$(document).ready(async function() {
    try {
        // Wait for jQuery to be available
        if (!window.jQuery) {
            if (window.jQueryPromise) {
                await window.jQueryPromise;
            } else {
                console.error('jQuery is not loaded and no jQueryPromise available');
                showToast('Error: Required libraries failed to load. Please refresh the page.', 'danger');
                return;
            }
        }

        // Now that jQuery is available, set up the form
        await initializeForm();
        setupEventListeners();
        await loadInitialData();
    } catch (error) {
        console.error('Error initializing product form:', error);
        showToast('Failed to initialize product form: ' + error.message, 'danger');
    }
});

// Get form data as an object
function getFormData() {
    const form = document.getElementById('productForm');
    if (!form) return {};
    
    const data = {};
    
    // Helper function to get element value by ID
    const getValue = (id) => {
        const el = document.getElementById(id);
        return el ? el.value : '';
    };
    
    // Helper function to get number value by ID
    const getNumber = (id, defaultValue = 0) => {
        const val = getValue(id);
        return val === '' ? defaultValue : parseFloat(val) || defaultValue;
    };
    
    // Basic product info - check both possible field IDs
    data.name = getValue('name') || getValue('productName');
    data.description = window.descriptionEditor ? window.descriptionEditor.value() : (getValue('description') || getValue('productDescription'));
    data.barcode = getValue('barcode') || getValue('productBarcode');
    data.sku = getValue('sku');
    
    // Category and supplier - check both possible field IDs
    data.category = getValue('category') || getValue('productCategory');
    data.categoryId = getValue('categoryId');
    data.supplierId = getValue('supplierId');
    data.supplierName = getValue('supplierName');
    data.supplierContact = getValue('supplierContact');
    
    // Pricing and quantities
    // Get cost price from unitCostPrice if available (calculated field), otherwise from costPrice
    const unitCostPrice = getNumber('unitCostPrice');
    data.costPrice = unitCostPrice > 0 ? unitCostPrice : getNumber('costPrice');
    data.sellingPrice = getNumber('sellingPrice');
    data.profitMargin = getNumber('profitMargin');
    data.quantityInStock = getNumber('quantityInStock', 0);
    data.quantityPurchased = getNumber('quantityPurchased', 0);
    data.quantityOnShelf = getNumber('quantityOnShelf', 0);
    data.reorderLevel = getNumber('reorderLevel', 5);
    
    // Dates
    data.manufacturedDate = getValue('manufacturedDate');
    data.expiryDate = getValue('expiryDate');
    
    // Images and variants
    if (formState.productImages && formState.productImages.length > 0) {
        data.images = formState.productImages;
        data.photoPath = formState.productImages[0]; // First image as main photo
    }
    
    if (formState.variants && formState.variants.length > 0) {
        data.variants = formState.variants;
    }
    
    // Notes and additional info
    data.notes = getValue('notes');
    
    // Calculate total bulk cost if we have costPrice and quantityPurchased
    // Otherwise, use the totalBulkCost from the form
    if (data.costPrice > 0 && data.quantityPurchased > 0) {
        data.totalBulkCost = data.costPrice * data.quantityPurchased;
    } else {
        data.totalBulkCost = getNumber('totalBulkCost');
    }
    
    // Ensure quantity_on_shelf is not more than quantity_in_stock
    if (data.quantityOnShelf > data.quantityInStock) {
        data.quantityOnShelf = data.quantityInStock;
    }
    
    // Handle rich text editor if available
    if (window.descriptionEditor) {
        data.description = window.descriptionEditor.value();
    }
    
    // Map form field names to server field names
    const fieldMappings = {
        // Basic info
        'name': 'name',
        'description': 'description',
        'barcode': 'barcode',
        'sku': 'sku',
        
        // Category and supplier
        'category': 'category',
        'categoryId': 'category_id',
        'supplierId': 'supplier_id',
        'supplierName': 'supplier_name',
        'supplierContact': 'supplier_contact',
        
        // Pricing and quantities
        'costPrice': 'cost_price',
        'sellingPrice': 'selling_price',
        'profitMargin': 'profit_margin',
        'totalBulkCost': 'total_bulk_cost',
        'quantityInStock': 'quantity_in_stock',
        'quantityPurchased': 'quantity_purchased',
        'quantityOnShelf': 'quantity_on_shelf',
        'reorderLevel': 'reorder_level',
        
        // Dates
        'manufacturedDate': 'manufactured_date',
        'expiryDate': 'expiry_date',
        
        // Media and variants
        'images': 'images',
        'photoPath': 'photo_path',
        'variants': 'variants',
        
        // Additional info
        'notes': 'notes',
        'isActive': 'is_active'
    };
    
    // Create a new object with mapped field names
    const mappedData = {
        // Set default values for required fields
        quantity_in_stock: 0,
        quantity_purchased: 0,
        quantity_on_shelf: 0,
        cost_price: 0,
        selling_price: 0,
        profit_margin: 0,
        total_bulk_cost: 0,
        reorder_level: 5,
        is_active: 1
    };
    
    // Copy and map the fields
    Object.entries(data).forEach(([key, value]) => {
        const mappedKey = fieldMappings[key] || key;
        // Only include defined values
        if (value !== undefined && value !== null && value !== '') {
            mappedData[mappedKey] = value;
        }
    });
    
    // Ensure calculated fields
    // Calculate cost_price from total_bulk_cost and quantity_purchased if cost_price is not set
    if ((!mappedData.cost_price || mappedData.cost_price === 0) && mappedData.total_bulk_cost && mappedData.quantity_purchased) {
        const calculatedCost = parseFloat(mappedData.total_bulk_cost) / parseInt(mappedData.quantity_purchased);
        if (!isNaN(calculatedCost) && calculatedCost > 0) {
            mappedData.cost_price = calculatedCost;
        }
    }
    
    // Calculate total_bulk_cost from cost_price and quantity_purchased if total_bulk_cost is not set
    if ((!mappedData.total_bulk_cost || mappedData.total_bulk_cost === 0) && mappedData.cost_price && mappedData.quantity_purchased) {
        const calculatedTotal = parseFloat(mappedData.cost_price) * parseInt(mappedData.quantity_purchased);
        if (!isNaN(calculatedTotal) && calculatedTotal > 0) {
            mappedData.total_bulk_cost = calculatedTotal;
        }
    }
    
    // IMPORTANT: If we have totalBulkCost and quantityPurchased, ALWAYS calculate cost_price
    // This ensures inventory value can be calculated
    if (mappedData.total_bulk_cost > 0 && mappedData.quantity_purchased > 0) {
        const unitCost = parseFloat(mappedData.total_bulk_cost) / parseInt(mappedData.quantity_purchased);
        if (!isNaN(unitCost) && unitCost > 0) {
            mappedData.cost_price = unitCost;
        }
    }
    
    // If cost_price is still 0 but we have selling_price, use a default calculation
    // (This is a fallback - ideally cost_price should always be set)
    if ((!mappedData.cost_price || mappedData.cost_price === 0) && mappedData.selling_price > 0) {
        // Assume 30% profit margin if cost is not set
        mappedData.cost_price = parseFloat(mappedData.selling_price) / 1.3;
    }
    
    // Ensure required fields have values - check both field ID variations
    if (!mappedData.name) {
        mappedData.name = document.getElementById('name')?.value || 
                         document.getElementById('productName')?.value || '';
    }
    
    // Ensure category is set - use category name from input field
    if (!mappedData.category) {
        const categoryInput = document.getElementById('category') || document.getElementById('productCategory');
        if (categoryInput) {
            mappedData.category = categoryInput.value || '';
        }
    }
    
    // Ensure required numeric fields have default values
    const numericFields = {
        'quantity_in_stock': 0,
        'quantity_purchased': 0,
        'quantity_on_shelf': 0,
        'cost_price': 0,
        'total_bulk_cost': 0,
        'selling_price': 0,
        'profit_margin': 0,
        'reorder_level': 5
    };
    
    // Calculate total_bulk_cost if we have cost_price and quantity_purchased
    if ((mappedData.cost_price || 0) > 0 && (mappedData.quantity_purchased || 0) > 0) {
        mappedData.total_bulk_cost = (parseFloat(mappedData.cost_price) * parseInt(mappedData.quantity_purchased)) || 0;
    }
    
    // Set default values for numeric fields
    Object.entries(numericFields).forEach(([field, defaultValue]) => {
        if (mappedData[field] === undefined || mappedData[field] === '') {
            mappedData[field] = defaultValue;
        } else {
            mappedData[field] = parseFloat(mappedData[field]) || defaultValue;
        }
    });
    
    // Ensure quantity_on_shelf is not more than quantity_in_stock
    if (mappedData.quantity_on_shelf > mappedData.quantity_in_stock) {
        mappedData.quantity_on_shelf = mappedData.quantity_in_stock;
    }
    
    // Log the data for debugging
    console.log('Original form data:', data);
    console.log('Mapped form data:', mappedData);
    
    return mappedData;
}

// Validate the entire form
function validateForm() {
    let isValid = true;
    
    // Validate name - check both field IDs
    const nameField = document.getElementById('name') || document.getElementById('productName');
    if (!nameField || !nameField.value.trim()) {
        if (nameField) markFieldAsInvalid(nameField, 'Product name is required');
        isValid = false;
    }
    
    // Validate category - check both field IDs
    const categoryField = document.getElementById('category') || document.getElementById('productCategory');
    if (!categoryField || !categoryField.value.trim()) {
        if (categoryField) markFieldAsInvalid(categoryField, 'Category is required');
        isValid = false;
    }
    
    // Validate selling price
    const sellingPriceField = document.getElementById('sellingPrice');
    if (!sellingPriceField || !sellingPriceField.value || parseFloat(sellingPriceField.value) <= 0) {
        if (sellingPriceField) markFieldAsInvalid(sellingPriceField, 'Selling price is required and must be greater than 0');
        isValid = false;
    }
    
    // Validate SKU uniqueness if not empty
    const skuInput = document.getElementById('sku');
    if (skuInput && skuInput.value.trim()) {
        if (!/^[A-Z0-9-]+$/i.test(skuInput.value)) {
            markFieldAsInvalid(skuInput, 'SKU can only contain letters, numbers, and hyphens');
            isValid = false;
        }
    }
    
    // Validate prices
    const costPrice = parseFloat(document.getElementById('costPrice')?.value) || 0;
    const sellingPrice = parseFloat(document.getElementById('sellingPrice')?.value) || 0;
    
    if (costPrice > 0 && sellingPrice > 0 && sellingPrice < costPrice) {
        showToast('Selling price cannot be less than cost price', 'warning');
        markFieldAsInvalid(document.getElementById('sellingPrice'), 'Must be ≥ cost price');
        isValid = false;
    }
    
    return isValid;
}

// Validate a single field
function validateField(event) {
    const field = event?.target || event;
    const value = field.value.trim();
    const fieldId = field.id;
    
    // Skip validation for empty optional fields
    if (!field.required && !value) {
        markFieldAsValid(field);
        return true;
    }
    
    // Field-specific validation rules
    switch (fieldId) {
        case 'name':
            if (value.length < 2) {
                markFieldAsInvalid(field, 'Name must be at least 2 characters');
                return false;
            }
            break;
            
        case 'sku':
            if (value && !/^[A-Z0-9-]+$/i.test(value)) {
                markFieldAsInvalid(field, 'SKU can only contain letters, numbers, and hyphens');
                return false;
            }
            break;
            
        case 'barcode':
            if (value && !/^[0-9]+$/.test(value)) {
                markFieldAsInvalid(field, 'Barcode must contain only numbers');
                return false;
            }
            break;
            
        case 'quantityInStock':
        case 'reorderLevel':
            if (isNaN(value) || parseInt(value) < 0) {
                markFieldAsInvalid(field, 'Must be a positive number');
                return false;
            }
            break;
            
        case 'costPrice':
        case 'sellingPrice':
        case 'wholesalePrice':
            if (isNaN(value) || parseFloat(value) < 0) {
                markFieldAsInvalid(field, 'Must be a positive number');
                return false;
            }
            break;
    }
    
    // If we get here, the field is valid
    markFieldAsValid(field);
    return true;
}

// Mark a field as invalid with an error message
function markFieldAsInvalid(field, message) {
    field.classList.add('is-invalid');
    
    // Add or update error message
    let errorElement = field.nextElementSibling;
    if (!errorElement || !errorElement.classList.contains('invalid-feedback')) {
        errorElement = document.createElement('div');
        errorElement.className = 'invalid-feedback';
        field.parentNode.insertBefore(errorElement, field.nextSibling);
    }
    
    errorElement.textContent = message;
}

// Mark a field as valid
function markFieldAsValid(field) {
    field.classList.remove('is-invalid');
    field.classList.add('is-valid');
    
    // Remove error message if it exists
    const errorElement = field.nextElementSibling;
    if (errorElement && errorElement.classList.contains('invalid-feedback')) {
        errorElement.remove();
    }
}

// Handle image upload
async function handleImageUpload(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    
    // Validate files
    const validFiles = files.filter(file => {
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        const maxSize = 5 * 1024 * 1024; // 5MB
        
        if (!validTypes.includes(file.type)) {
            showToast(`Skipped ${file.name}: Unsupported file type`, 'warning');
            return false;
        }
        
        if (file.size > maxSize) {
            showToast(`Skipped ${file.name}: File is too large (max 5MB)`, 'warning');
            return false;
        }
        
        return true;
    });
    
    // Add to selected images
    formState.selectedImages = [...formState.selectedImages, ...validFiles];
    
    // Render previews
    renderImagePreviews();
    
    // Reset file input
    event.target.value = '';
}

// Render image previews
function renderImagePreviews() {
    const container = document.getElementById('imagePreviews');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (formState.selectedImages.length === 0) {
        container.innerHTML = '<div class="text-muted">No images selected</div>';
        return;
    }
    
    formState.selectedImages.forEach((file, index) => {
        const preview = document.createElement('div');
        preview.className = 'image-preview';
        
        // Create image element
        const img = document.createElement('img');
        img.className = 'img-thumbnail';
        
        // Set image source
        if (file instanceof File) {
            const reader = new FileReader();
            reader.onload = (e) => {
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        } else if (typeof file === 'string') {
            // Handle URLs for existing images
            img.src = file;
        } else if (file.url) {
            // Handle image objects with URL property
            img.src = file.url;
        }
        
        // Create remove button
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn btn-sm btn-danger remove-image';
        removeBtn.innerHTML = '&times;';
        removeBtn.onclick = () => removeImage(index);
        
        // Set as main image button
        const setMainBtn = document.createElement('button');
        setMainBtn.type = 'button';
        setMainBtn.className = `btn btn-sm ${index === 0 ? 'btn-primary' : 'btn-outline-secondary'} set-main-image`;
        setMainBtn.textContent = index === 0 ? 'Main' : 'Set as Main';
        setMainBtn.onclick = () => setMainImage(index);
        
        // Add elements to preview
        const btnGroup = document.createElement('div');
        btnGroup.className = 'btn-group btn-group-sm mt-2 w-100';
        btnGroup.appendChild(removeBtn);
        btnGroup.appendChild(setMainBtn);
        
        preview.appendChild(img);
        preview.appendChild(btnGroup);
        
        container.appendChild(preview);
    });
}

// Remove an image
function removeImage(index) {
    formState.selectedImages.splice(index, 1);
    renderImagePreviews();
}

// Set an image as the main image
function setMainImage(index) {
    if (index === 0) return; // Already main
    
    const [image] = formState.selectedImages.splice(index, 1);
    formState.selectedImages.unshift(image);
    renderImagePreviews();
}

// Upload images to server
async function uploadImages(images) {
    const formData = new FormData();
    
    // Add each image to form data
    images.forEach((file, index) => {
        if (file instanceof File) {
            formData.append('images', file);
        }
        // Skip already uploaded images (they should have URLs)
    });
    
    try {
        const response = await fetch('/api/products/upload-images', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Failed to upload images');
        }
        
        const result = await response.json();
        return result.urls; // Array of uploaded image URLs
        
    } catch (error) {
        console.error('Error uploading images:', error);
        throw new Error('Failed to upload images');
    }
}

// Initialize variant management
function initializeVariantManagement() {
    // Add variant option
    const addOptionBtn = document.getElementById('addVariantOption');
    if (addOptionBtn) {
        addOptionBtn.addEventListener('click', addVariantOption);
    }
    
    // Generate variants button
    const generateVariantsBtn = document.getElementById('generateVariants');
    if (generateVariantsBtn) {
        generateVariantsBtn.addEventListener('click', generateVariants);
    }
}

// Add a new variant option (e.g., Size, Color)
function addVariantOption() {
    const optionsContainer = document.getElementById('variantOptions');
    if (!optionsContainer) return;
    
    const optionId = Date.now();
    
    const optionHtml = `
        <div class="variant-option card mb-3" data-option-id="${optionId}">
            <div class="card-body">
                <div class="row g-3">
                    <div class="col-md-4">
                        <label class="form-label">Option Name</label>
                        <input type="text" class="form-control option-name" placeholder="e.g., Size, Color" required>
                    </div>
                    <div class="col-md-7">
                        <label class="form-label">Option Values</label>
                        <input type="text" class="form-control option-values" 
                               placeholder="Comma-separated values (e.g., S,M,L or Red,Blue,Green)" required>
                    </div>
                    <div class="col-md-1 d-flex align-items-end">
                        <button type="button" class="btn btn-outline-danger remove-option">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    const optionElement = document.createElement('div');
    optionElement.innerHTML = optionHtml;
    optionsContainer.appendChild(optionElement);
    
    // Add event listener for remove button
    const removeBtn = optionElement.querySelector('.remove-option');
    if (removeBtn) {
        removeBtn.addEventListener('click', () => {
            optionElement.remove();
        });
    }
}

// Generate variants based on options
function generateVariants() {
    const optionElements = document.querySelectorAll('.variant-option');
    if (optionElements.length === 0) {
        showToast('Please add at least one variant option', 'warning');
        return;
    }
    
    // Parse variant options
    const options = [];
    let isValid = true;
    
    optionElements.forEach((element, index) => {
        const name = element.querySelector('.option-name').value.trim();
        const valuesStr = element.querySelector('.option-values').value.trim();
        
        if (!name || !valuesStr) {
            showToast(`Please fill in all option fields for option ${index + 1}`, 'warning');
            isValid = false;
            return;
        }
        
        const values = valuesStr.split(',').map(v => v.trim()).filter(Boolean);
        if (values.length === 0) {
            showToast(`Please enter at least one value for option ${name}`, 'warning');
            isValid = false;
            return;
        }
        
        options.push({ name, values });
    });
    
    if (!isValid) return;
    
    // Generate all possible combinations
    const variants = generateCombinations(options);
    
    if (variants.length > 50) {
        const confirmLarge = confirm(`This will create ${variants.length} variants. Are you sure?`);
        if (!confirmLarge) return;
    }
    
    // Store variants in state
    formState.variants = variants.map((variant, index) => ({
        id: `new-${index}`,
        sku: '',
        options: variant,
        price: 0,
        cost: 0,
        quantity: 0,
        barcode: ''
    }));
    
    // Render variants
    renderVariants();
    
    // Scroll to variants section
    const variantsSection = document.getElementById('variantsSection');
    if (variantsSection) {
        variantsSection.scrollIntoView({ behavior: 'smooth' });
    }
}

// Generate all possible combinations of variant options
function generateCombinations(options, current = {}, index = 0, result = []) {
    if (index === options.length) {
        result.push({ ...current });
        return result;
    }
    
    const { name, values } = options[index];
    
    for (const value of values) {
        current[name] = value;
        generateCombinations(options, current, index + 1, result);
    }
    
    return result;
}

// Render variants table
function renderVariants() {
    const container = document.getElementById('variantsContainer');
    if (!container) return;
    
    if (formState.variants.length === 0) {
        container.innerHTML = '<div class="alert alert-info">No variants generated yet. Add variant options above and click "Generate Variants".</div>';
        return;
    }
    
    // Get all unique option names
    const optionNames = [];
    formState.variants.forEach(variant => {
        Object.keys(variant.options || {}).forEach(name => {
            if (!optionNames.includes(name)) {
                optionNames.push(name);
            }
        });
    });
    
    // Build table HTML
    let html = `
        <div class="table-responsive">
            <table class="table table-bordered table-hover">
                <thead class="table-light">
                    <tr>
                        ${optionNames.map(name => `<th>${name}</th>`).join('')}
                        <th>SKU</th>
                        <th>Barcode</th>
                        <th>Price</th>
                        <th>Cost</th>
                        <th>Quantity</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    // Add rows for each variant
    formState.variants.forEach((variant, index) => {
        html += `
            <tr data-variant-id="${variant.id}">
                ${optionNames.map(name => `<td>${variant.options?.[name] || '-'}</td>`).join('')}
                <td><input type="text" class="form-control form-control-sm" data-field="sku" value="${variant.sku || ''}" onchange="updateVariantField(${index}, 'sku', this.value)"></td>
                <td><input type="text" class="form-control form-control-sm" data-field="barcode" value="${variant.barcode || ''}" onchange="updateVariantField(${index}, 'barcode', this.value)"></td>
                <td><input type="number" class="form-control form-control-sm" data-field="price" value="${variant.price || ''}" min="0" step="0.01" onchange="updateVariantField(${index}, 'price', parseFloat(this.value) || 0)"></td>
                <td><input type="number" class="form-control form-control-sm" data-field="cost" value="${variant.cost || ''}" min="0" step="0.01" onchange="updateVariantField(${index}, 'cost', parseFloat(this.value) || 0)"></td>
                <td><input type="number" class="form-control form-control-sm" data-field="quantity" value="${variant.quantity || ''}" min="0" onchange="updateVariantField(${index}, 'quantity', parseInt(this.value) || 0)"></td>
                <td>
                    <button type="button" class="btn btn-sm btn-outline-danger" onclick="removeVariant(${index})">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
        <div class="d-flex justify-content-between align-items-center mt-3">
            <div class="text-muted">
                ${formState.variants.length} variant(s)
            </div>
            <div>
                <button type="button" class="btn btn-outline-secondary btn-sm me-2" onclick="regenerateVariants()">
                    <i class="bi bi-arrow-repeat"></i> Regenerate
                </button>
                <button type="button" class="btn btn-outline-danger btn-sm" onclick="clearVariants()">
                    <i class="bi bi-trash"></i> Clear All
                </button>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

// Update a variant field
function updateVariantField(index, field, value) {
    if (index >= 0 && index < formState.variants.length) {
        formState.variants[index][field] = value;
    }
}

// Remove a variant
function removeVariant(index) {
    if (confirm('Are you sure you want to remove this variant?')) {
        formState.variants.splice(index, 1);
        renderVariants();
    }
}

// Regenerate variants
function regenerateVariants() {
    if (confirm('This will regenerate all variants and reset any changes. Continue?')) {
        generateVariants();
    }
}

// Clear all variants
function clearVariants() {
    if (confirm('Are you sure you want to clear all variants?')) {
        formState.variants = [];
        renderVariants();
    }
}

// Show add category modal
function showAddCategoryModal() {
    const modal = new bootstrap.Modal(document.getElementById('addCategoryModal'));
    modal.show();
}

// Save new category
async function saveNewCategory(event) {
    event.preventDefault();
    
    const form = event.target;
    const nameInput = form.elements['newCategoryName'];
    const name = nameInput.value.trim();
    
    if (!name) {
        showToast('Please enter a category name', 'warning');
        return;
    }
    
    try {
        const result = await categories.create({ name });
        
        if (result && result.success) {
            // Reload categories
            const categoriesData = await categories.getAll();
            populateDropdown('category', categoriesData, 'name', 'id');
            
            // Select the new category
            document.getElementById('category').value = result.id;
            
            // Close modal and reset form
            const modal = bootstrap.Modal.getInstance(document.getElementById('addCategoryModal'));
            if (modal) modal.hide();
            form.reset();
            
            showToast('Category added successfully', 'success');
        } else {
            throw new Error(result?.message || 'Failed to add category');
        }
    } catch (error) { 
        console.error('Error adding category:', error);
        showToast(`Failed to add category: ${error.message}`, 'danger');
    }
}

// Calculate prices based on cost, quantity and profit margin
function calculatePrices() {
    try {
        // Get input elements
        const bulkCostInput = document.getElementById('totalBulkCost');
        const qtyPurchasedInput = document.getElementById('quantityPurchased');
        const profitMarginInput = document.getElementById('profitMargin');
        const unitCostPriceInput = document.getElementById('unitCostPrice');
        const sellingPriceInput = document.getElementById('sellingPrice');
        const marginalProfitInput = document.getElementById('marginalProfit');

        // Check if all required elements exist
        if (!bulkCostInput || !qtyPurchasedInput || !profitMarginInput || 
            !unitCostPriceInput || !sellingPriceInput || !marginalProfitInput) {
            console.warn('One or more form elements are missing', {
                bulkCostInput: !!bulkCostInput,
                qtyPurchasedInput: !!qtyPurchasedInput,
                profitMarginInput: !!profitMarginInput,
                unitCostPriceInput: !!unitCostPriceInput,
                sellingPriceInput: !!sellingPriceInput,
                marginalProfitInput: !!marginalProfitInput
            });
            return;
        }

        // Parse input values with proper error checking
        const bulkCost = parseFloat(bulkCostInput.value) || 0;
        const qtyPurchased = parseInt(qtyPurchasedInput.value) || 1; // Prevent division by zero
        const profitMargin = parseFloat(profitMarginInput.value) || 0;
        
        // Calculate cost per unit (ensure we don't divide by zero)
        const costPerUnit = qtyPurchased > 0 ? bulkCost / qtyPurchased : 0;
        
        // Calculate selling price with profit margin
        const profitAmount = costPerUnit * (profitMargin / 100);
        const sellingPrice = costPerUnit + profitAmount;
        
        // Calculate marginal profit (selling price - cost price)
        const marginalProfit = sellingPrice - costPerUnit;
        
        // Update the form fields
        unitCostPriceInput.value = costPerUnit.toFixed(2);
        sellingPriceInput.value = sellingPrice.toFixed(2);
        marginalProfitInput.value = marginalProfit.toFixed(2);
        
        // Dispatch change events
        const event = new Event('change');
        if (sellingPriceInput) sellingPriceInput.dispatchEvent(event);
        if (marginalProfitInput) marginalProfitInput.dispatchEvent(event);
    } catch (error) {
        console.error('Error in calculatePrices:', error);
        showToast('An error occurred while calculating prices', 'error');
    }
}

// Initialize the application when the DOM is fully loaded
function initializeApplication() {
    try {
        // Show loading state
        showLoading(true, 'app-loading');
        
        // Set a timeout to prevent infinite loading
        const initTimeout = setTimeout(() => {
            showLoading(false, 'app-loading');
            showToast('Initialization is taking longer than expected. Please check your connection and refresh the page.', 'warning');
        }, 10000); // 10 seconds timeout

        // Initialize form and dependencies
        Promise.all([
            initializeForm(),
            loadInitialData()
        ]).then(() => {
            setupEventListeners();
            
            // Export functions that need to be available globally
            window.resetForm = resetForm;
            window.saveProduct = handleFormSubmit;
            window.handleFormSubmit = handleFormSubmit;
            window.validateField = validateField;
            window.calculatePrices = calculatePrices;
            window.removeImage = removeImage;
            window.setMainImage = setMainImage;
            window.addVariantOption = addVariantOption;
            window.generateVariants = generateVariants;
            window.updateVariantField = updateVariantField;
            window.removeVariant = removeVariant;
            window.regenerateVariants = regenerateVariants;
            window.clearVariants = clearVariants;
            window.showAddCategoryModal = showAddCategoryModal;
            window.saveNewCategory = saveNewCategory;
            
            // Clear the timeout as initialization is complete
            clearTimeout(initTimeout);
            showLoading(false, 'app-loading');
            
        }).catch(error => {
            console.error('Error during initialization:', error);
            showToast('Failed to initialize application: ' + (error.message || 'Unknown error'), 'danger');
            showLoading(false, 'app-loading');
        });
        
    } catch (error) {
        console.error('Fatal error during initialization:', error);
        showToast('A critical error occurred. Please refresh the page.', 'danger');
        showLoading(false, 'app-loading');
    }
}

// Start the application when the DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApplication);
} else {
    // DOM is already ready
    initializeApplication();
}
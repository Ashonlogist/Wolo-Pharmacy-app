// Dashboard page functionality
console.log('Dashboard module loaded');

// Import utilities
import { showToast, debounce, formatCurrency, formatDate, showLoading } from '../core/utils.js';

// Import API methods
import { 
    products as productsApi,
    sales as salesApi,
    reports as reportsApi
} from '../core/api.js';

// Wait for jQuery to be available
async function waitForJQuery() {
    return new Promise((resolve) => {
        if (window.jQuery) {
            console.log('jQuery is already loaded');
            return resolve(window.jQuery);
        }
        
        console.log('Waiting for jQuery...');
        const checkInterval = setInterval(() => {
            if (window.jQuery) {
                clearInterval(checkInterval);
                console.log('jQuery loaded successfully');
                resolve(window.jQuery);
            }
        }, 100);
        
        // Timeout after 5 seconds
        setTimeout(() => {
            clearInterval(checkInterval);
            console.warn('jQuery loading timed out');
            resolve(null);
        }, 5000);
    });
}

// Cache for storing API responses
const cache = {
    sales: null,
    products: null,
    summary: null,
    lastUpdated: null,
    CACHE_DURATION: 5 * 60 * 1000 // 5 minutes cache
};

// Chart instances
let salesChart = null;
let productsChart = null;

// Initialize dashboard when the module loads
(async function initDashboard() {
    console.log('Initializing dashboard...');
    
    try {
        // Wait for jQuery to be available
        const $ = await waitForJQuery();
        if (!$) {
            throw new Error('Failed to load jQuery');
        }
        
        console.log('jQuery version:', $.fn.jquery);
        
        // Initialize dashboard components
        const initialized = initializeDashboard();
        if (!initialized) {
            throw new Error('Failed to initialize dashboard components');
        }
        
        initializeEventListeners();
        
        // Initialize charts and load data
        await initializeCharts();
        await refreshDashboard();
        
        console.log('Dashboard initialized successfully');
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        showToast('Failed to load dashboard. Please check console for details.', 'danger');
    }
})();

// Format date as YYYY-MM-DD
function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Initialize dashboard components
function initializeDashboard() {
    try {
        // Set up date range inputs
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        
        // Set initial date values
        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');
        
        if (startDateInput) {
            startDateInput.value = formatDateForInput(thirtyDaysAgo);
            startDateInput.addEventListener('change', applyDateRange);
        }
        
        if (endDateInput) {
            endDateInput.value = formatDateForInput(today);
            endDateInput.addEventListener('change', applyDateRange);
        }
        
        return true;
    } catch (error) {
        console.error('Error initializing dashboard components:', error);
        return false;
    }
}

// Initialize event listeners
function initializeEventListeners() {
    // Refresh button
    const refreshBtn = document.getElementById('refreshDashboardBtn') || document.getElementById('refreshDashboard');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => refreshDashboard().catch(handleDashboardError));
    }
    
    // Date range filter
    const applyDateRangeBtn = document.getElementById('applyDateRange');
    if (applyDateRangeBtn) {
        applyDateRangeBtn.addEventListener('click', () => applyDateRange().catch(handleDashboardError));
    }
    
    // Chart type selector
    const chartTypeSelect = document.getElementById('chartType');
    if (chartTypeSelect) {
        chartTypeSelect.addEventListener('change', updateChartType);
    }
    
    // Sales chart refresh buttons
    const refreshSalesChartBtn = document.getElementById('refreshSalesChartBtn');
    if (refreshSalesChartBtn) {
        refreshSalesChartBtn.addEventListener('click', () => {
            if (typeof refreshSalesChart === 'function') {
                refreshSalesChart();
            }
        });
    }
    
    const refreshSalesChartBtn2 = document.getElementById('refreshSalesChartBtn2');
    if (refreshSalesChartBtn2) {
        refreshSalesChartBtn2.addEventListener('click', () => {
            if (typeof refreshSalesChart === 'function') {
                refreshSalesChart();
            }
        });
    }
    
    // Sales chart filters
    const salesCategoryFilter = document.getElementById('categoryFilter');
    if (salesCategoryFilter && salesCategoryFilter.closest('#dashboard-page')) {
        salesCategoryFilter.addEventListener('change', () => {
            if (typeof refreshSalesChart === 'function') {
                refreshSalesChart();
            }
        });
    }
    
    const timeGrouping = document.getElementById('timeGrouping');
    if (timeGrouping && timeGrouping.closest('#dashboard-page')) {
        timeGrouping.addEventListener('change', () => {
            if (typeof refreshSalesChart === 'function') {
                refreshSalesChart();
            }
        });
    }
}


// Refresh dashboard data with cache and error handling
async function refreshDashboard() {
    const loadingKey = 'dashboard-refresh';
    showLoading(true, loadingKey);
    
    try {
        // Get date range
        const startDate = document.getElementById('startDate')?.value;
        const endDate = document.getElementById('endDate')?.value;
        
        // Check cache first if available
        if (isCacheValid()) {
            updateUI(cache.sales, cache.products, cache.summary);
            updateCharts(cache.sales, cache.products);
            return;
        }
        
        // Fetch fresh data
        const [salesResponse, productResponse, summaryData] = await Promise.all([
            fetchSalesData(startDate, endDate),
            fetchProductData(),
            fetchSummaryData()
        ]);
        
        // Process the data to ensure consistent format
        const salesData = Array.isArray(salesResponse) 
            ? salesResponse 
            : (salesResponse?.data || []);
            
        const productData = Array.isArray(productResponse)
            ? productResponse
            : (productResponse?.data || []);
        
        console.log('Processed data in refreshDashboard:', {
            salesData,
            productData,
            summaryData
        });
        
        // Update cache with processed data
        cache.sales = salesData;
        cache.products = productData;
        cache.summary = summaryData;
        cache.lastUpdated = Date.now();
        
        // Update UI with fresh data
        updateUI(salesData, productData, summaryData);
        
        // Update charts with processed data
        updateCharts(salesData, productData);
        
    } catch (error) {
        handleDashboardError(error);
    } finally {
        showLoading(false, loadingKey);
    }
}

// Fetch sales data with date range
async function fetchSalesData(startDate, endDate) {
    try {
        console.log(`Fetching sales data from ${startDate} to ${endDate}`);
        const response = await salesApi.getByDateRange(startDate, endDate);
        console.log('Sales data response:', response);
        
        // Handle different response formats
        const sales = Array.isArray(response) ? response : 
                    (response && Array.isArray(response.data) ? response.data : []);
                    
        console.log('Processed sales data:', sales);
        return sales;
    } catch (error) {
        console.error('Error fetching sales data:', error);
        return [];
    }
}

// Fetch product data
async function fetchProductData() {
    try {
        console.log('Fetching product data...');
        const response = await productsApi.getAll();
        console.log('Product data response:', response);
        
        // Handle different response formats
        const products = Array.isArray(response) ? response : 
                       (response && Array.isArray(response.data) ? response.data : []);
                       
        console.log(`Fetched ${products.length} products`);
        return products;
    } catch (error) {
        console.error('Error fetching product data:', error);
        return [];
    }
}

// Fetch summary data
async function fetchSummaryData() {
    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
    console.log('Fetching summary data for date:', today);
    
    try {
        // Fetch today's sales
        const todaySalesResponse = await salesApi.getByDateRange(today, today);
        console.log('Today\'s sales response:', todaySalesResponse);
        
        // Process sales data
        const todaySales = Array.isArray(todaySalesResponse) ? todaySalesResponse :
                         (todaySalesResponse && Array.isArray(todaySalesResponse.data) ? 
                          todaySalesResponse.data : []);
        
        // Fetch low stock items
        const lowStockResponse = await reportsApi.getLowStockItems(5); // Threshold of 5 items
        console.log('Low stock items response:', lowStockResponse);
        
        // Process low stock items
        const lowStockItems = Array.isArray(lowStockResponse) ? lowStockResponse :
                            (lowStockResponse && Array.isArray(lowStockResponse.data) ?
                             lowStockResponse.data : []);
        
        // Get all products for inventory value calculation
        const productsResponse = await productsApi.getAll();
        const allProducts = Array.isArray(productsResponse) ? productsResponse :
                          (productsResponse && Array.isArray(productsResponse.data) ?
                           productsResponse.data : []);
        
        // Calculate inventory value - use cost_price or calculate from total_bulk_cost
        const inventoryValue = allProducts.reduce((total, product) => {
            const quantity = parseFloat(product.quantity_in_stock || product.quantityInStock || 0);
            let cost = parseFloat(product.cost_price || product.costPrice || product.purchase_price || 0);
            
            // If cost_price is 0, try to calculate from total_bulk_cost and quantity_purchased
            if (cost === 0 || isNaN(cost)) {
                const totalBulkCost = parseFloat(product.total_bulk_cost || product.totalBulkCost || 0);
                const quantityPurchased = parseFloat(product.quantity_purchased || product.quantityPurchased || 0);
                if (totalBulkCost > 0 && quantityPurchased > 0) {
                    cost = totalBulkCost / quantityPurchased;
                }
            }
            
            const value = quantity * cost;
            return isNaN(value) || value < 0 ? total : total + value;
        }, 0);
        
        // Calculate today's total sales
        const totalSales = todaySales.reduce((sum, sale) => {
            return sum + (parseFloat(sale?.total) || 0);
        }, 0);
        
        // Count low stock items
        const lowStockCount = lowStockItems.length;
        
        return {
            todaySales,
            lowStockItems,
            inventoryValue,
            totalSales,
            totalProducts: allProducts.length,
            lowStockCount
        };
        
    } catch (error) {
        console.error('Error in fetchSummaryData:', error);
        return {
            todaySales: [],
            lowStockItems: [],
            inventoryValue: 0,
            totalSales: 0,
            totalProducts: 0,
            lowStockCount: 0
        };
    }
}

// Update UI with data
function updateUI(salesData, productData, summaryData) {
    try {
        console.log('Updating UI with data:', { salesData, productData, summaryData });
        
        // Handle case where summaryData is not provided (second parameter pattern)
        if (arguments.length === 2) {
            summaryData = productData;
            productData = arguments[0];
            salesData = arguments[0];
        }
        
        // Process product data first
        const productArray = Array.isArray(productData) ? productData : 
                           (productData?.success && Array.isArray(productData.data)) ? 
                           productData.data : 
                           [];
        
        // Process sales data
        const salesArray = Array.isArray(salesData) ? salesData : 
                          (salesData?.success && Array.isArray(salesData.data)) ? 
                          salesData.data : 
                          [];
        
        console.log('Processed data for UI update:', {
            productCount: productArray.length,
            salesCount: salesArray.length,
            hasSummaryData: !!summaryData
        });
        
        // Update product summary with the actual product data
        updateProductSummary(productArray);
        
        // Update summary cards if summary data is available
        if (summaryData) {
            console.log('Updating summary data:', summaryData);
            if (summaryData.totalSales !== undefined) {
                updateSummaryElement('totalSales', formatCurrency(summaryData.totalSales));
            }
            if (summaryData.todaySales !== undefined) {
                updateSummaryElement('todaySalesCount', summaryData.todaySales);
            }
            if (summaryData.averageOrderValue !== undefined) {
                updateSummaryElement('avgOrderValue', formatCurrency(summaryData.averageOrderValue));
            }
            // Update inventory value from summary data if available
            if (summaryData.inventoryValue !== undefined) {
                const totalValueEl = document.getElementById('totalValue');
                if (totalValueEl) {
                    totalValueEl.textContent = formatCurrency(summaryData.inventoryValue);
                    console.log('Updated total inventory value from summary:', formatCurrency(summaryData.inventoryValue));
                }
            }
        }
        
        // Update UI components
        updateRecentSales(salesArray);
        updateTopProducts(productArray);
        updateCharts(salesArray, productArray);
        
    } catch (error) {
        console.error('UI update error:', error);
        // Update UI with zeros on error
        const totalValueEl = document.getElementById('totalValue');
        if (totalValueEl) totalValueEl.textContent = formatCurrency(0);
        throw new Error('Failed to update dashboard UI');
    }
}


// Update recent sales table
function updateRecentSales(salesData) {
    const tbody = document.querySelector('#recentSalesTable tbody');
    if (!tbody) return;
    
    // Clear existing rows
    tbody.innerHTML = '';
    
    // Sort by date (newest first) and take first 5
    const recentSales = [...salesData]
        .sort((a, b) => new Date(b.sale_date) - new Date(a.sale_date))
        .slice(0, 5);
    
    // Add rows
    recentSales.forEach(sale => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(sale.sale_date)}</td>
            <td>${sale.invoice_number || 'N/A'}</td>
            <td>${sale.customer_name || 'Walk-in'}</td>
            <td class="text-end">${formatCurrency(sale.total)}</td>
            <td class="text-center">
                <button class="btn btn-sm btn-outline-primary" onclick="viewSaleDetails('${sale.id}')">
                    <i class="bi bi-eye"></i> View
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Update top products list
function updateTopProducts(products) {
    const container = document.getElementById('topProductsList');
    if (!container) return;
    
    // Clear existing content
    container.innerHTML = '';
    
    // Sort by quantity sold (descending) and take top 5
    const topProducts = [...products]
        .sort((a, b) => (b.quantity_sold || 0) - (a.quantity_sold || 0))
        .slice(0, 5);
    
    // Add product items
    topProducts.forEach((product, index) => {
        const item = document.createElement('div');
        item.className = 'd-flex justify-content-between align-items-center mb-2';
        item.innerHTML = `
            <div class="d-flex align-items-center">
                <span class="badge bg-primary me-2">${index + 1}</span>
                <div>
                    <div class="fw-bold">${product.name}</div>
                    <small class="text-muted">${product.quantity_sold || 0} sold</small>
                </div>
            </div>
            <span class="text-primary fw-bold">${formatCurrency(product.selling_price || 0)}</span>
        `;
        container.appendChild(item);
    });
}



// Group sales by date
function groupSalesByDate(salesData) {
    return salesData.reduce((acc, sale) => {
        const date = sale.sale_date.split('T')[0];
        acc[date] = (acc[date] || 0) + sale.total;
        return acc;
    }, {});
}

// Get top selling products
function getTopProductsBySales(products, limit = 5) {
    return [...products]
        .sort((a, b) => (b.quantity_sold || 0) - (a.quantity_sold || 0))
        .slice(0, limit);
}

// Handle chart type change
function updateChartType() {
    const chartType = document.getElementById('chartType')?.value;
    if (salesChart && chartType) {
        salesChart.config.type = chartType;
        salesChart.update();
    }
}

// Handle view sale details
function viewSaleDetails(saleId) {
    // Navigate to sales page with the specific sale selected
    window.navigateTo('sales', { saleId });
}

// Handle errors
function handleDashboardError(error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Dashboard error:', error);
    
    // Only show toast if showToast function is available
    if (typeof showToast === 'function') {
        showToast(`Error: ${errorMessage}`, 'error');
    } else {
        // Fallback error display
        const errorContainer = document.createElement('div');
        errorContainer.className = 'alert alert-danger';
        errorContainer.textContent = `Error: ${errorMessage}`;
        document.body.prepend(errorContainer);
    }
    
    // Re-throw the error for further handling if needed
    throw error;
}

// Make functions available globally
window.refreshDashboard = refreshDashboard;
window.applyDateRange = applyDateRange;
window.viewSaleDetails = viewSaleDetails;
window.updateChartType = updateChartType;

// Initialize date range picker event listener
// Date range picker initialization is handled in initializeEventListeners()

// Check if cache is still valid
function isCacheValid() {
    return cache.lastUpdated && 
           (Date.now() - cache.lastUpdated) < cache.CACHE_DURATION;
}


// Apply date range filter with validation
async function applyDateRange() {
    const startDate = document.getElementById('startDate')?.value;
    const endDate = document.getElementById('endDate')?.value;
    
    if (!startDate || !endDate) {
        showToast('Please select both start and end dates', 'warning');
        return;
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        showToast('Invalid date format', 'warning');
        return;
    }
    
    if (start > end) {
        showToast('Start date cannot be after end date', 'warning');
        return;
    }
    
    const loadingKey = 'date-range-apply';
    
    try {
        showLoading(true, loadingKey);
        
        // Clear cache for sales data
        cache.sales = null;
        
        // Refresh dashboard with the new date range
        await refreshDashboard();
        
        // The refreshDashboard function already updates the charts with the latest data
        // So we don't need to update them again here
        
        showToast('Date range applied successfully', 'success');
        
    } catch (error) {
        handleDashboardError(error);
    } finally {
        showLoading(false, loadingKey);
    }
}

/**
 * Update sales summary with the latest data
 * @param {Object|Array} apiResponse - API response containing sales data
 */
function updateSalesSummary(apiResponse) {
    try {
        // Handle case where we get the full API response
        const salesData = Array.isArray(apiResponse) ? apiResponse : 
                        (apiResponse?.success && Array.isArray(apiResponse.data)) ? 
                        apiResponse.data : [];

        if (!salesData.length) {
            console.warn('No sales data available');
            return;
        }

        const totalSales = salesData.reduce((sum, sale) => sum + (parseFloat(sale.total) || 0), 0);
        const totalItems = salesData.reduce((sum, sale) => sum + (parseInt(sale.quantity) || 0), 0);
        const totalTransactions = salesData.length;

        updateSummaryElement('totalSales', formatCurrency(totalSales));
        updateSummaryElement('totalItems', totalItems.toLocaleString());
        updateSummaryElement('totalTransactions', totalTransactions.toLocaleString());
    } catch (error) {
        console.error('Error updating sales summary:', error);
    }
}

/**
 * Update product summary with the latest data
 * @param {Object|Array} apiResponse - API response containing product data
 */
function updateProductSummary(apiResponse) {
    try {
        // Get the products array from the response
        let products = Array.isArray(apiResponse) ? apiResponse : 
                       (apiResponse?.data || []);
        
        // Filter out inactive products and duplicates
        const seenIds = new Set();
        products = products.filter(p => {
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
        
        console.log('Products data in updateProductSummary:', {
            total: products.length,
            products: products.map(p => ({ id: p.id, name: p.name, is_active: p.is_active }))
        });
        
        // Calculate the values
        const totalProducts = products.length;
        
        // Calculate low stock items (quantityInStock <= reorderLevel)
        const lowStockItems = products.filter(p => {
            // Try both snake_case and camelCase field names for compatibility
            const quantity = parseFloat(p.quantityInStock || p.quantity_in_stock || 0);
            const reorderLevel = parseFloat(p.reorderLevel || p.reorder_level || 5); // Default reorder level of 5 if not set
            return quantity > 0 && quantity <= reorderLevel;
        }).length;
        
        // Calculate total inventory value (quantityInStock * costPrice)
        const totalValue = products.reduce((sum, product) => {
            // Try both snake_case and camelCase field names for compatibility
            const quantity = parseFloat(product.quantity_in_stock || product.quantityInStock || 0);
            
            // Try multiple cost field names and calculation methods
            let cost = parseFloat(product.cost_price || product.costPrice || product.purchase_price || 0);
            
            // If cost_price is 0 or not set, try to calculate from total_bulk_cost and quantity_purchased
            if (cost === 0 || isNaN(cost)) {
                const totalBulkCost = parseFloat(product.total_bulk_cost || product.totalBulkCost || 0);
                const quantityPurchased = parseFloat(product.quantity_purchased || product.quantityPurchased || 0);
                if (totalBulkCost > 0 && quantityPurchased > 0) {
                    cost = totalBulkCost / quantityPurchased;
                }
            }
            
            const value = quantity * cost;
            if (isNaN(value) || value < 0) {
                console.warn('Invalid product value calculation:', { 
                    productId: product.id, 
                    productName: product.name,
                    quantity, 
                    cost,
                    quantityField: product.quantity_in_stock || product.quantityInStock,
                    costField: product.cost_price || product.costPrice || product.purchase_price,
                    totalBulkCost: product.total_bulk_cost || product.totalBulkCost,
                    quantityPurchased: product.quantity_purchased || product.quantityPurchased
                });
                return sum;
            }
            return sum + value;
        }, 0);
        
        // Calculate expiring items (within 30 days)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const thirtyDaysFromNow = new Date(today);
        thirtyDaysFromNow.setDate(today.getDate() + 30);
        
        const expiringItems = products.filter(p => {
            const expiryDate = p.expiry_date || p.expiryDate;
            if (!expiryDate) return false;
            
            try {
                const expiry = new Date(expiryDate);
                expiry.setHours(0, 0, 0, 0);
                return expiry >= today && expiry <= thirtyDaysFromNow;
            } catch (e) {
                return false;
            }
        });
        
        const expiringCount = expiringItems.length;
        
        console.log('Dashboard values:', {
            totalProducts,
            lowStockItems,
            expiringCount,
            totalValue: formatCurrency(totalValue),
            sampleProduct: products[0] ? {
                id: products[0].id,
                name: products[0].name,
                quantity: products[0].quantity_in_stock || products[0].quantityInStock,
                cost: products[0].cost_price || products[0].costPrice || products[0].purchase_price,
                price: products[0].sale_price || products[0].salePrice || products[0].price
            } : 'No products'
        });
        
        // Update the UI elements
        const totalProductsEl = document.getElementById('totalProducts');
        const lowStockCountEl = document.getElementById('lowStockCount');
        const expiringSoonCountEl = document.getElementById('expiringSoonCount');
        const totalValueEl = document.getElementById('totalValue');
        
        if (totalProductsEl) totalProductsEl.textContent = totalProducts.toLocaleString();
        if (lowStockCountEl) lowStockCountEl.textContent = lowStockItems.toLocaleString();
        if (expiringSoonCountEl) expiringSoonCountEl.textContent = expiringCount.toLocaleString();
        if (totalValueEl) {
            totalValueEl.textContent = formatCurrency(totalValue);
            console.log('Updated total inventory value:', formatCurrency(totalValue));
        }
        
        // Update low stock list
        updateLowStockList(products);
        
        // Update expiring items list
        updateExpiringList(expiringItems);
        
        // Force a reflow to ensure UI updates
        if (totalProductsEl) void totalProductsEl.offsetHeight;
        if (lowStockCountEl) void lowStockCountEl.offsetHeight;
        if (expiringSoonCountEl) void expiringSoonCountEl.offsetHeight;
        if (totalValueEl) void totalValueEl.offsetHeight;
        
    } catch (error) {
        console.error('Error in updateProductSummary:', error);
        // Update UI with zeros on error
        const totalProductsEl = document.getElementById('totalProducts');
        const lowStockCountEl = document.getElementById('lowStockCount');
        const totalValueEl = document.getElementById('totalValue');
        
        if (totalProductsEl) totalProductsEl.textContent = '0';
        if (lowStockCountEl) lowStockCountEl.textContent = '0';
        const expiringSoonCountEl = document.getElementById('expiringSoonCount');
        if (expiringSoonCountEl) expiringSoonCountEl.textContent = '0';
        if (totalValueEl) totalValueEl.textContent = formatCurrency(0);
    }
}

// Update low stock list
function updateLowStockList(products) {
    const lowStockListEl = document.getElementById('lowStockList');
    if (!lowStockListEl) return;
    
    // Filter low stock items
    const lowStockItems = products.filter(p => {
        const quantity = parseFloat(p.quantity_in_stock || p.quantityInStock || 0);
        const reorderLevel = parseFloat(p.reorder_level || p.low_stock_threshold || 5);
        return quantity > 0 && quantity <= reorderLevel;
    });
    
    if (lowStockItems.length === 0) {
        lowStockListEl.innerHTML = '<div class="alert alert-info mb-0">No low stock items</div>';
        return;
    }
    
    // Sort by quantity (lowest first) and take top 10
    const sortedItems = lowStockItems
        .sort((a, b) => {
            const qtyA = parseFloat(a.quantity_in_stock || a.quantityInStock || 0);
            const qtyB = parseFloat(b.quantity_in_stock || b.quantityInStock || 0);
            return qtyA - qtyB;
        })
        .slice(0, 10);
    
    lowStockListEl.innerHTML = sortedItems.map(item => {
        const quantity = parseFloat(item.quantity_in_stock || item.quantityInStock || 0);
        const reorderLevel = parseFloat(item.reorder_level || item.low_stock_threshold || 5);
        const stockClass = quantity === 0 ? 'danger' : 'warning';
        
        return `
            <div class="alert alert-${stockClass} alert-dismissible fade show mb-2" role="alert">
                <strong>${item.name || 'Unknown Product'}</strong><br>
                <small>Stock: ${quantity} / Reorder Level: ${reorderLevel}</small>
            </div>
        `;
    }).join('');
}

// Update expiring items list
function updateExpiringList(expiringItems) {
    const expiringListEl = document.getElementById('expiringList');
    if (!expiringListEl) return;
    
    if (expiringItems.length === 0) {
        expiringListEl.innerHTML = '<div class="alert alert-info mb-0">No items expiring soon</div>';
        return;
    }
    
    // Sort by expiry date (soonest first) and take top 10
    const sortedItems = expiringItems
        .sort((a, b) => {
            const dateA = new Date(a.expiry_date || a.expiryDate || 0);
            const dateB = new Date(b.expiry_date || b.expiryDate || 0);
            return dateA - dateB;
        })
        .slice(0, 10);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    expiringListEl.innerHTML = sortedItems.map(item => {
        const expiryDate = item.expiry_date || item.expiryDate;
        const expiry = new Date(expiryDate);
        expiry.setHours(0, 0, 0, 0);
        const daysUntilExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
        const alertClass = daysUntilExpiry <= 7 ? 'danger' : 'warning';
        
        return `
            <div class="alert alert-${alertClass} alert-dismissible fade show mb-2" role="alert">
                <strong>${item.name || 'Unknown Product'}</strong><br>
                <small>Expires: ${expiry.toLocaleDateString()} (${daysUntilExpiry} days)</small>
            </div>
        `;
    }).join('');
}

/**
 * Helper to safely update summary elements
 * @param {string} id - The element ID to update
 * @param {string} value - The value to set
 */
function updateSummaryElement(id, value) {
    try {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
            element.setAttribute('title', value); // Add tooltip
        }
    } catch (error) {
        console.error(`Error updating element ${id}:`, error);
    }
}

// Initialize charts
function initializeCharts() {
    try {
        // Sales chart
        const salesCtx = document.getElementById('salesChart')?.getContext('2d');
        if (!salesCtx) {
            console.warn('Sales chart canvas not found');
            return false;
        }

        // Safely destroy existing chart if it exists and is a valid Chart instance
        if (window.salesChart && typeof window.salesChart.destroy === 'function') {
            try {
                window.salesChart.destroy();
            } catch (e) {
                console.warn('Error destroying existing sales chart:', e);
            }
        }

        window.salesChart = new Chart(salesCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Daily Sales',
                    data: [],
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    tension: 0.1,
                    fill: true,
                    borderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 20
                        }
                    },
                    title: {
                        display: true,
                        text: 'Sales Overview',
                        padding: {
                            bottom: 10
                        },
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleFont: {
                            size: 14,
                            weight: 'bold'
                        },
                        bodyFont: {
                            size: 13
                        },
                        padding: 12,
                        usePointStyle: true,
                        callbacks: {
                            label: function(context) {
                                return `$${context.parsed.y.toFixed(2)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            drawBorder: false
                        },
                        ticks: {
                            callback: function(value) {
                                return '$' + value.toLocaleString();
                            }
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeInOutQuart'
                }
            }
        });
    } catch (error) {
        console.error('Error initializing charts:', error);
        showToast('Error initializing charts', 'danger');
        return false;
    }
    
    return true;
}

// Refresh sales chart with current filters
window.refreshSalesChart = async function refreshSalesChart() {
    try {
        showLoading(true, 'refresh-sales-chart');
        
        // Get current date range values
        const startDate = document.getElementById('startDate')?.value;
        const endDate = document.getElementById('endDate')?.value;
        
        // Fetch fresh sales data
        const salesData = await fetchSalesData(startDate, endDate);
        
        // Update the charts with the new data
        updateCharts(salesData, window.products);
        
        // Update the recent sales table
        if (Array.isArray(salesData)) {
            updateRecentSales(salesData);
        }
        
        showToast('Sales chart refreshed', 'success');
    } catch (error) {
        console.error('Error refreshing sales chart:', error);
        showToast('Error refreshing sales chart', 'danger');
    } finally {
        showLoading(false, 'refresh-sales-chart');
    }
}

// Update charts with data
function updateCharts(salesData = [], products = []) {
    console.log('Updating charts with sales data:', salesData);
    
    // Get chart containers
    const chartContainers = {
        salesChart: document.getElementById('salesChart'),
        productsChart: document.getElementById('productsChart')
    };
    
    // Show placeholder if no data
    const showNoDataPlaceholder = () => {
        Object.values(chartContainers).forEach(container => {
            if (container) {
                container.innerHTML = `
                    <div class="chart-placeholder p-4 text-center">
                        <i class="bi bi-graph-up fs-1 text-muted mb-2"></i>
                        <p class="text-muted">No data available for the selected period</p>
                    </div>`;
            }
        });
    };

    // Handle empty or invalid data
    if (!Array.isArray(salesData) || salesData.length === 0) {
        console.warn('No valid sales data available for charts');
        showNoDataPlaceholder();
        return;
    }
    
    // Process sales data for daily aggregation
    const dailySales = {};
    const validSalesData = salesData.filter(sale => sale && typeof sale === 'object');
    
    validSalesData.forEach(sale => {
        try {
            // Get sale date - try multiple field names
            const saleDate = sale.sale_date || sale.saleDate || sale.created_at || sale.date || new Date().toISOString();
            const dateKey = saleDate.split('T')[0]; // Get YYYY-MM-DD format
            
            if (!dailySales[dateKey]) {
                dailySales[dateKey] = 0;
            }
            
            // Add sale total - try multiple field names
            const total = parseFloat(sale.total_amount || sale.total || sale.amount || 0);
            dailySales[dateKey] += total;
        } catch (e) {
            console.error('Error processing sale:', sale, e);
        }
    });
    
    // Sort dates
    const sortedDates = Object.keys(dailySales).sort();
    const salesValues = sortedDates.map(date => dailySales[date]);
    
    // Format dates for display
    const formattedDates = sortedDates.map(date => {
        try {
            const d = new Date(date);
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } catch (e) {
            return date;
        }
    });
    
    // Update sales chart if it exists
    if (window.salesChart) {
        try {
            if (window.salesChart.data && window.salesChart.data.datasets?.[0]) {
                window.salesChart.data.labels = formattedDates;
                window.salesChart.data.datasets[0].data = salesValues;
                window.salesChart.update('none'); // Update without animation for performance
            }
        } catch (error) {
            console.error('Error updating sales chart:', error);
            showToast('Error updating sales chart', 'danger');
        }
    }
    
    // Update products chart if it exists and we have product data
    if (window.productsChart && Array.isArray(products) && products.length > 0) {
        try {
            // Sort products by sales (descending) and take top 5
            const topProducts = [...products]
                .filter(p => p && typeof p === 'object')
                .sort((a, b) => (parseInt(b.quantitySold) || 0) - (parseInt(a.quantitySold) || 0))
                .slice(0, 5);
            
            if (topProducts.length > 0 && window.productsChart.data?.datasets?.[0]) {
                window.productsChart.data.labels = topProducts.map(p => p.name || 'Unknown');
                window.productsChart.data.datasets[0].data = topProducts.map(p => parseInt(p.quantitySold) || 0);
                window.productsChart.update();
            } else if (chartContainers.productsChart) {
                chartContainers.productsChart.innerHTML = `
                    <div class="chart-placeholder p-4 text-center">
                        <i class="bi bi-box-seam fs-1 text-muted mb-2"></i>
                        <p class="text-muted">No product data available</p>
                    </div>`;
            }
        } catch (error) {
            console.error('Error updating products chart:', error);
            showToast('Error updating product data', 'danger');
        }
    }
}




// Make functions available globally
window.refreshDashboard = refreshDashboard;
window.applyDateRange = applyDateRange;

// Initialize the dashboard when the script loads
// Remove duplicate initialization - already handled by initDashboard() IIFE above
// Dashboard will initialize when the module loads

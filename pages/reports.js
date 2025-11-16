// Reports page functionality
const { ipcRenderer } = window.electron || {};
import { reports, products } from '../core/api.js';
import { showToast, formatCurrency, formatDate } from '../core/utils.js';

// Global variables
let chart1 = null;
let chart2 = null;

// Prevent duplicate initialization
let reportsPageInitialized = false;

// Initialize the reports page
async function initializeReportsPage() {
    if (reportsPageInitialized) {
        console.warn('Reports page already initialized, skipping...');
        return;
    }
    
    try {
        reportsPageInitialized = true;
        initializeDatePickers();
        setupEventListeners();
        await loadReportCategories();
        
        // Set default dates
        const today = new Date();
        const lastMonth = new Date();
        lastMonth.setMonth(today.getMonth() - 1);
        
        const startDateEl = document.getElementById('reportStartDate');
        const endDateEl = document.getElementById('reportEndDate');
        if (startDateEl) startDateEl.valueAsDate = lastMonth;
        if (endDateEl) endDateEl.valueAsDate = today;
        
        // Initialize event listeners for report type changes
        const reportTypeEl = document.getElementById('reportType');
        if (reportTypeEl) {
            reportTypeEl.addEventListener('change', updateReportForm);
        }
        
        // Add event listener for generate report button
        const generateBtn = document.getElementById('generateReportBtn');
        if (generateBtn) {
            generateBtn.addEventListener('click', generateReport);
        }
        
        // Initialize the form
        updateReportForm();
        
        console.log('Reports page initialized successfully');
    } catch (error) {
        console.error('Error initializing reports page:', error);
        showToast('Failed to initialize reports page', 'danger');
        reportsPageInitialized = false;
    }
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeReportsPage);
} else {
    initializeReportsPage();
}

// Initialize date pickers
function initializeDatePickers() {
    // Flatpickr initialization can be added here if needed
    console.log('Date pickers initialized');
}

// Set up event listeners
function setupEventListeners() {
    // Export buttons - check for both naming conventions
    document.getElementById('exportPdfBtn')?.addEventListener('click', () => exportReport('pdf'));
    document.getElementById('exportPdfBtn2')?.addEventListener('click', () => exportReport('pdf'));
    document.getElementById('exportExcelBtn')?.addEventListener('click', () => exportReport('excel'));
    document.getElementById('exportCsvBtn')?.addEventListener('click', () => exportReport('csv'));
    
    // Print button
    document.getElementById('printReportBtn')?.addEventListener('click', () => window.print());
    
    // Date range validation
    const dateInputs = document.querySelectorAll('input[type="date"]');
    dateInputs.forEach(input => {
        input.addEventListener('change', validateDateRange);
    });
}

// Load report categories
async function loadReportCategories() {
    try {
        const categorySelect = document.getElementById('reportCategory');
        if (!categorySelect) return;
        
        // Clear existing options
        categorySelect.innerHTML = '<option value="">All Categories</option>';
        
        try {
            // Try to get categories using the products API
            const productsList = await products.getAll();
            
            // Extract unique categories from products
            const categories = [];
            const categorySet = new Set();
            
            if (productsList && productsList.length > 0) {
                productsList.forEach(product => {
                    if (product.category && !categorySet.has(product.category)) {
                        categorySet.add(product.category);
                        categories.push({
                            id: product.category.toLowerCase().replace(/\s+/g, '-'),
                            name: product.category
                        });
                    }
                });
                
                // Add categories to the select element
                categories.forEach(category => {
                    const option = document.createElement('option');
                    option.value = category.id;
                    option.textContent = category.name;
                    categorySelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error fetching categories from products:', error);
            // Fallback to hardcoded categories if API fails
            const fallbackCategories = [
                { id: 'all', name: 'All Categories' },
                { id: 'medicines', name: 'Medicines' },
                { id: 'first-aid', name: 'First Aid' },
                { id: 'personal-care', name: 'Personal Care' },
                { id: 'wellness', name: 'Wellness' },
                { id: 'devices', name: 'Medical Devices' }
            ];
            
            fallbackCategories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.id;
                option.textContent = category.name;
                categorySelect.appendChild(option);
            });
            
            showToast('Using fallback categories', 'warning');
        }
    } catch (error) {
        console.error('Error loading categories:', error);
        showToast('Failed to load categories', 'danger');
    }
}

// Update report form based on selected report type
function updateReportForm() {
    const reportType = document.getElementById('reportType')?.value;
    const dateRangeGroup = document.getElementById('dateRangeGroup');
    const categoryGroup = document.getElementById('categoryGroup');
    const thresholdGroup = document.getElementById('thresholdGroup');
    
    // Reset all groups
    if (dateRangeGroup) dateRangeGroup.style.display = 'none';
    if (categoryGroup) categoryGroup.style.display = 'none';
    if (thresholdGroup) thresholdGroup.style.display = 'none';
    
    // Show relevant fields based on report type
    switch(reportType) {
        case 'sales':
        case 'inventory':
        case 'expiring':
            if (dateRangeGroup) dateRangeGroup.style.display = 'block';
            if (categoryGroup) categoryGroup.style.display = 'block';
            break;
            
        case 'low-stock':
            if (thresholdGroup) thresholdGroup.style.display = 'block';
            if (categoryGroup) categoryGroup.style.display = 'block';
            break;
    }
}

// Validate date range
function validateDateRange() {
    const startDate = document.getElementById('reportStartDate')?.value;
    const endDate = document.getElementById('reportEndDate')?.value;
    
    if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (start > end) {
            showToast('Start date cannot be after end date', 'warning');
            return false;
        }
    }
    
    return true;
}

// Generate report
async function generateReport() {
    try {
        const reportType = document.getElementById('reportType')?.value;
        if (!reportType) {
            showToast('Please select a report type', 'warning');
            return;
        }

        // Show loading state
        const generateBtn = document.getElementById('generateReportBtn');
        const originalBtnText = generateBtn.innerHTML;
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Generating...';
        
        // Hide previous report
        document.getElementById('reportContainer').style.display = 'none';
        
        // Get form values
        const category = document.getElementById('reportCategory')?.value || '';
        const startDate = document.getElementById('reportStartDate')?.value || '';
        const endDate = document.getElementById('reportEndDate')?.value || '';
        const threshold = document.getElementById('lowStockThreshold')?.value || 10;
        
        // Validate dates if they're required
        if (['sales', 'inventory', 'expiring'].includes(reportType)) {
            if (!startDate || !endDate) {
                showToast('Please select a date range', 'warning');
                return;
            }
            if (!validateDateRange()) {
                return;
            }
        }
        
        try {
            let reportData;
            let reportTitle = '';
            
            // Call the appropriate API based on report type
            switch(reportType) {
                case 'sales':
                    reportTitle = 'Sales Report';
                    reportData = await reports.getSalesReport({ startDate, endDate, category });
                    break;
                    
                case 'inventory':
                    reportTitle = 'Inventory Report';
                    reportData = await reports.getInventoryReport({ category });
                    break;
                    
                case 'low-stock':
                    reportTitle = 'Low Stock Report';
                    reportData = await reports.getLowStockReport({ threshold, category });
                    break;
                    
                case 'expiring':
                    reportTitle = 'Expiring Products Report';
                    reportData = await reports.getExpiringProducts({ startDate, endDate, category });
                    break;
                    
                default:
                    throw new Error('Unsupported report type');
            }
            
            // Ensure reportData is an array
            const processedData = Array.isArray(reportData) ? reportData : (reportData?.data || []);
            
            // Render the report
            await renderReport(reportType, processedData);
            
            // Update the report title
            const reportTitleElement = document.getElementById('reportTitle');
            if (reportTitleElement) {
                reportTitleElement.textContent = reportTitle;
            }
            
            // Show the report container and summary
            document.getElementById('reportContainer').style.display = 'block';
            const reportSummary = document.getElementById('reportSummary');
            if (reportSummary) {
                reportSummary.style.display = 'flex';
            }
            const exportButtons = document.getElementById('exportButtons');
            if (exportButtons) {
                exportButtons.style.display = 'flex';
            }
            
        } catch (error) {
            console.error('Error generating report:', error);
            showToast(`Failed to generate report: ${error.message || 'Unknown error'}`, 'danger');
        }
        
    } catch (error) {
        console.error('Error in generateReport:', error);
        showToast('An unexpected error occurred', 'danger');
    } finally {
        // Reset button state
        const generateBtn = document.getElementById('generateReportBtn');
        if (generateBtn) {
            generateBtn.disabled = false;
            generateBtn.innerHTML = 'Generate Report';
        }
    }
}

// Render report based on type
async function renderReport(reportType, data) {
    try {
        const tableHeader = document.getElementById('reportTableHeader');
        const tableBody = document.getElementById('reportTableBody');
        const tableFooter = document.getElementById('reportTableFooter');
        
        // Clear existing content
        if (tableHeader) tableHeader.innerHTML = '';
        if (tableBody) tableBody.innerHTML = '';
        if (tableFooter) tableFooter.innerHTML = '';
        
        // Dispatch to the appropriate renderer
        switch(reportType) {
            case 'sales':
                await renderSalesReport(data);
                break;
                
            case 'inventory':
                await renderInventoryReport(data);
                break;
                
            case 'low-stock':
                await renderLowStockReport(data);
                break;
                
            case 'expiring':
                await renderExpiringProductsReport(data);
                break;
                
            default:
                throw new Error('Unsupported report type');
        }
        
        // Show the report container
        document.getElementById('reportContainer').style.display = 'block';
        
    } catch (error) {
        console.error('Error rendering report:', error);
        throw error;
    }
}

// Render sales report
async function renderSalesReport(data) {
    const tableHeader = document.getElementById('reportTableHeader');
    const tableBody = document.getElementById('reportTableBody');
    const tableFooter = document.getElementById('reportTableFooter');
    
    if (!tableHeader || !tableBody || !tableFooter) return;
    
    try {
        // Set up table headers
        tableHeader.innerHTML = `
            <tr>
                <th>Date</th>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
            </tr>
        `;
        
        // Ensure data is an array
        const salesData = Array.isArray(data) ? data : (data?.data || []);
        
        if (salesData.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center">No sales data found for the selected period</td></tr>';
            return;
        }
        
        // Add table rows
        let totalSales = 0;
        let totalItems = 0;
        
        salesData.forEach(sale => {
            // Handle different data structures
            const saleDate = sale.sale_date || sale.date || sale.created_at || new Date();
            const invoiceNumber = sale.invoice_number || sale.orderId || sale.id || 'N/A';
            const customerName = sale.customer_name || sale.customerName || 'Walk-in';
            const totalAmount = parseFloat(sale.total_amount || sale.total || 0);
            
            // Count items - check if items array exists or if we need to query sale_items
            let itemCount = 0;
            if (sale.items && Array.isArray(sale.items)) {
                itemCount = sale.items.length;
            } else if (sale.item_count) {
                itemCount = sale.item_count;
            } else {
                // Try to get from sale_items if available
                itemCount = sale.sale_items?.length || 1; // Default to 1 if unknown
            }
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${new Date(saleDate).toLocaleDateString()}</td>
                <td>${invoiceNumber}</td>
                <td>${customerName}</td>
                <td>${itemCount}</td>
                <td>${formatCurrency(totalAmount)}</td>
                <td><span class="badge bg-success">${sale.payment_status || sale.status || 'Completed'}</span></td>
            `;
            tableBody.appendChild(row);
            
            // Update totals
            totalSales += totalAmount;
            totalItems += itemCount;
        });
        
        // Add footer with totals
        tableFooter.innerHTML = `
            <tr class="table-active">
                <td colspan="3" class="text-end"><strong>Total:</strong></td>
                <td><strong>${totalItems} items</strong></td>
                <td><strong>${formatCurrency(totalSales)}</strong></td>
                <td></td>
            </tr>
        `;
        
        // Update summary cards
        updateSummaryCards({
            totalProducts: salesData.length,
            totalInStock: totalItems,
            totalSales: totalSales
        });
        
        // Update report generated date
        const reportGeneratedDate = document.getElementById('reportGeneratedDate');
        if (reportGeneratedDate) {
            reportGeneratedDate.textContent = new Date().toLocaleString();
        }
        
    } catch (error) {
        console.error('Error rendering sales report:', error);
        throw error;
    }
}

// Render inventory report
async function renderInventoryReport(data) {
    const tableHeader = document.getElementById('reportTableHeader');
    const tableBody = document.getElementById('reportTableBody');
    const tableFooter = document.getElementById('reportTableFooter');
    
    if (!tableHeader || !tableBody || !tableFooter) return;
    
    try {
        // Set up table headers
        tableHeader.innerHTML = `
            <tr>
                <th>Product</th>
                <th>Category</th>
                <th>SKU</th>
                <th>In Stock</th>
                <th>Price</th>
                <th>Value</th>
                <th>Status</th>
            </tr>
        `;
        
        // Add table rows
        let totalValue = 0;
        let totalItems = 0;
        let outOfStockCount = 0;
        let lowStockCount = 0;
        
        // Ensure data is an array
        const productsData = Array.isArray(data) ? data : (data?.data || []);
        
        if (productsData.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" class="text-center">No inventory data found</td></tr>';
            return;
        }
        
        productsData.forEach(item => {
            // Handle both snake_case and camelCase field names
            const inStock = parseInt(item.quantity_in_stock || item.quantityInStock || 0);
            const sellingPrice = parseFloat(item.selling_price || item.sellingPrice || 0);
            const costPrice = parseFloat(item.cost_price || item.costPrice || item.purchase_price || 0);
            
            // Calculate value using cost price for inventory value
            let value = inStock * costPrice;
            
            // If cost_price is 0, try to calculate from total_bulk_cost
            if (costPrice === 0 || isNaN(costPrice)) {
                const totalBulkCost = parseFloat(item.total_bulk_cost || item.totalBulkCost || 0);
                const quantityPurchased = parseFloat(item.quantity_purchased || item.quantityPurchased || 0);
                if (totalBulkCost > 0 && quantityPurchased > 0) {
                    const unitCost = totalBulkCost / quantityPurchased;
                    value = inStock * unitCost;
                }
            }
            
            // Update counts
            totalValue += value;
            totalItems += inStock;
            
            const reorderLevel = parseInt(item.reorder_level || item.reorderLevel || item.low_stock_threshold || 5);
            
            if (inStock === 0) outOfStockCount++;
            else if (inStock <= reorderLevel) lowStockCount++;
            
            const statusClass = inStock === 0 ? 'bg-danger' : 
                              inStock <= reorderLevel ? 'bg-warning' : 'bg-success';
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.name || 'N/A'}</td>
                <td>${item.category || 'Uncategorized'}</td>
                <td>${item.sku || 'N/A'}</td>
                <td>${inStock}</td>
                <td>${formatCurrency(sellingPrice)}</td>
                <td>${formatCurrency(value)}</td>
                <td><span class="badge ${statusClass}">
                    ${inStock === 0 ? 'Out of Stock' : inStock <= reorderLevel ? 'Low Stock' : 'In Stock'}
                </span></td>
            `;
            tableBody.appendChild(row);
        });
        
        // Add footer with totals
        tableFooter.innerHTML = `
            <tr class="table-active">
                <td colspan="3" class="text-end"><strong>Total:</strong></td>
                <td><strong>${totalItems} items</strong></td>
                <td></td>
                <td><strong>${formatCurrency(totalValue)}</strong></td>
                <td></td>
            </tr>
        `;
        
        // Update summary cards
        updateSummaryCards({
            totalProducts: productsData.length,
            totalInStock: totalItems,
            totalLowStock: lowStockCount,
            totalOutOfStock: outOfStockCount,
            totalValue: totalValue
        });
        
        // Update report generated date
        const reportGeneratedDate = document.getElementById('reportGeneratedDate');
        if (reportGeneratedDate) {
            reportGeneratedDate.textContent = new Date().toLocaleString();
        }
        
    } catch (error) {
        console.error('Error rendering inventory report:', error);
        throw error;
    }
}

// Render low stock report
async function renderLowStockReport(data) {
    const tableHeader = document.getElementById('reportTableHeader');
    const tableBody = document.getElementById('reportTableBody');
    const tableFooter = document.getElementById('reportTableFooter');
    
    if (!tableHeader || !tableBody || !tableFooter) return;
    
    try {
        // Ensure data is an array
        const lowStockData = Array.isArray(data) ? data : (data?.data || []);
        
        if (lowStockData.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" class="text-center">No low stock items found</td></tr>';
            return;
        }
        
        // Sort by quantity ascending
        lowStockData.sort((a, b) => {
            const qtyA = parseInt(a.quantity_in_stock || a.quantityInStock || 0);
            const qtyB = parseInt(b.quantity_in_stock || b.quantityInStock || 0);
            return qtyA - qtyB;
        });
        
        // Set up table headers
        tableHeader.innerHTML = `
            <tr>
                <th>Product</th>
                <th>Category</th>
                <th>SKU</th>
                <th>In Stock</th>
                <th>Reorder Level</th>
                <th>Status</th>
                <th>Action</th>
            </tr>
        `;
        
        // Add table rows
        lowStockData.forEach(item => {
            const inStock = parseInt(item.quantity_in_stock || item.quantityInStock || 0);
            const reorderLevel = parseInt(item.reorder_level || item.reorderLevel || item.low_stock_threshold || 5);
            const statusClass = inStock === 0 ? 'bg-danger' : 'bg-warning';
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.name || 'N/A'}</td>
                <td>${item.category || 'Uncategorized'}</td>
                <td>${item.sku || 'N/A'}</td>
                <td>${inStock}</td>
                <td>${reorderLevel}</td>
                <td><span class="badge ${statusClass}">
                    ${inStock === 0 ? 'Out of Stock' : 'Low Stock'}
                </span></td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" 
                            onclick="editProduct('${item.id}')">
                        Reorder
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });
        
        // Add footer with counts
        const lowStockCount = lowStockData.filter(item => (parseInt(item.quantity_in_stock || item.quantityInStock || 0) > 0)).length;
        const outOfStockCount = lowStockData.filter(item => (parseInt(item.quantity_in_stock || item.quantityInStock || 0) === 0)).length;
        
        tableFooter.innerHTML = `
            <tr class="table-active">
                <td colspan="7" class="text-end">
                    <strong>Total Low/Out of Stock Items: ${lowStockData.length} (${lowStockCount} low stock, ${outOfStockCount} out of stock)</strong>
                </td>
            </tr>
        `;
        
        // Update summary cards
        updateSummaryCards({
            totalProducts: lowStockData.length,
            totalLowStock: lowStockCount,
            totalOutOfStock: outOfStockCount
        });
        
        // Update report generated date
        const reportGeneratedDate = document.getElementById('reportGeneratedDate');
        if (reportGeneratedDate) {
            reportGeneratedDate.textContent = new Date().toLocaleString();
        }
        
    } catch (error) {
        console.error('Error rendering low stock report:', error);
        throw error;
    }
}

// Render expiring products report
async function renderExpiringProductsReport(data) {
    const tableHeader = document.getElementById('reportTableHeader');
    const tableBody = document.getElementById('reportTableBody');
    const tableFooter = document.getElementById('reportTableFooter');
    
    if (!tableHeader || !tableBody || !tableFooter) return;
    
    try {
        // Ensure data is an array
        const expiringData = Array.isArray(data) ? data : (data?.data || []);
        
        if (expiringData.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center">No expiring products found for the selected period</td></tr>';
            return;
        }
        
        // Sort by expiry date ascending
        expiringData.sort((a, b) => {
            const dateA = new Date(a.expiry_date || a.expiryDate || 0);
            const dateB = new Date(b.expiry_date || b.expiryDate || 0);
            return dateA - dateB;
        });
        
        // Set up table headers
        tableHeader.innerHTML = `
            <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Expiry Date</th>
                <th>Days Until Expiry</th>
                <th>In Stock</th>
                <th>Status</th>
            </tr>
        `;
        
        // Add table rows
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        expiringData.forEach(item => {
            const expiryDateStr = item.expiry_date || item.expiryDate;
            if (!expiryDateStr) return; // Skip items without expiry date
            
            const expiryDate = new Date(expiryDateStr);
            expiryDate.setHours(0, 0, 0, 0);
            const timeDiff = expiryDate - today;
            const daysUntilExpiry = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
            
            let statusClass = 'bg-success';
            let statusText = 'Good';
            
            if (daysUntilExpiry <= 0) {
                statusClass = 'bg-danger';
                statusText = 'Expired';
            } else if (daysUntilExpiry <= 7) {
                statusClass = 'bg-danger';
                statusText = 'Expiring Soon';
            } else if (daysUntilExpiry <= 30) {
                statusClass = 'bg-warning';
                statusText = 'Expiring Soon';
            }
            
            const inStock = parseInt(item.quantity_in_stock || item.quantityInStock || 0);
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.name || 'N/A'}</td>
                <td>${item.category || 'Uncategorized'}</td>
                <td>${expiryDate.toLocaleDateString()}</td>
                <td>${daysUntilExpiry} days</td>
                <td>${inStock}</td>
                <td><span class="badge ${statusClass}">${statusText}</span></td>
            `;
            tableBody.appendChild(row);
        });
        
        // Add footer with counts
        const expiredCount = expiringData.filter(item => {
            const expiryDateStr = item.expiry_date || item.expiryDate;
            if (!expiryDateStr) return false;
            const expiryDate = new Date(expiryDateStr);
            expiryDate.setHours(0, 0, 0, 0);
            return expiryDate < today;
        }).length;
        
        const expiringSoonCount = expiringData.filter(item => {
            const expiryDateStr = item.expiry_date || item.expiryDate;
            if (!expiryDateStr) return false;
            const expiryDate = new Date(expiryDateStr);
            expiryDate.setHours(0, 0, 0, 0);
            const timeDiff = expiryDate - today;
            const daysUntilExpiry = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
            return daysUntilExpiry > 0 && daysUntilExpiry <= 30;
        }).length;
        
        tableFooter.innerHTML = `
            <tr class="table-active">
                <td colspan="6" class="text-end">
                    <strong>Total: ${expiringData.length} items (${expiredCount} expired, ${expiringSoonCount} expiring soon)</strong>
                </td>
            </tr>
        `;
        
        // Update summary cards
        updateSummaryCards({
            totalProducts: expiringData.length,
            totalExpired: expiredCount,
            totalExpiringSoon: expiringSoonCount
        });
        
        // Update report generated date
        const reportGeneratedDate = document.getElementById('reportGeneratedDate');
        if (reportGeneratedDate) {
            reportGeneratedDate.textContent = new Date().toLocaleString();
        }
        
    } catch (error) {
        console.error('Error rendering expiring products report:', error);
        throw error;
    }
}

// Update summary cards with report data
function updateSummaryCards(stats = {}) {
    try {
        const {
            totalProducts = 0,
            totalInStock = 0,
            totalLowStock = 0,
            totalOutOfStock = 0,
            totalSales = 0,
            totalValue = 0,
            totalExpired = 0,
            totalExpiringSoon = 0
        } = stats;
        
        // Update summary cards if they exist
        const updateIfExists = (id, value, isCurrency = false) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = isCurrency ? `GH₵ ${parseFloat(value || 0).toFixed(2)}` : (value || 0);
            }
        };
        
        updateIfExists('totalProducts', totalProducts);
        updateIfExists('totalInStock', totalInStock);
        updateIfExists('totalLowStock', totalLowStock);
        updateIfExists('totalOutOfStock', totalOutOfStock);
        updateIfExists('totalSales', totalSales, true);
        updateIfExists('totalInventoryValue', totalValue, true);
        
        // Show/hide summary section based on available data
        const summarySection = document.getElementById('reportSummary');
        if (summarySection) {
            summarySection.style.display = 'flex';
        }
        
        // Show/hide charts section
        const chartsSection = document.getElementById('reportCharts');
        if (chartsSection) {
            chartsSection.style.display = 'flex';
            
            // Initialize or update charts if Chart.js is available
            if (window.Chart) {
                updateCharts(stats);
            }
        }
        
    } catch (error) {
        console.error('Error updating summary cards:', error);
    }
}

// Update charts with report data
function updateCharts(stats = {}) {
    try {
        // Destroy existing charts if they exist
        if (chart1) chart1.destroy();
        if (chart2) chart2.destroy();
        
        // Get chart canvases
        const ctx1 = document.getElementById('inventoryByCategoryChart')?.getContext('2d');
        const ctx2 = document.getElementById('stockStatusChart')?.getContext('2d');
        
        if (!ctx1 || !ctx2) return;
        
        // Chart 1: Stock Status (Doughnut chart) - use actual stats
        chart1 = new Chart(ctx1, {
            type: 'doughnut',
            data: {
                labels: ['In Stock', 'Low Stock', 'Out of Stock'],
                datasets: [{
                    data: [
                        stats.totalInStock || 0,
                        stats.totalLowStock || 0,
                        stats.totalOutOfStock || 0
                    ],
                    backgroundColor: ['#1cc88a', '#f6c23e', '#e74a3b'],
                    hoverBackgroundColor: ['#17a673', '#dda20a', '#be2617'],
                    hoverBorderColor: 'rgba(234, 236, 244, 1)',
                }]
            },
            options: {
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                    },
                    title: {
                        display: true,
                        text: 'Stock Status'
                    }
                },
                cutout: '70%',
            }
        });
        
        // Chart 2: Sales or Inventory Value (Bar chart) - show relevant data
        const chart2Data = stats.totalSales ? {
            labels: ['Total Sales'],
            datasets: [{
                label: 'Sales Amount',
                data: [stats.totalSales],
                backgroundColor: '#4e73df',
                hoverBackgroundColor: '#2e59d9',
            }]
        } : stats.totalValue ? {
            labels: ['Total Inventory Value'],
            datasets: [{
                label: 'Inventory Value',
                data: [stats.totalValue],
                backgroundColor: '#1cc88a',
                hoverBackgroundColor: '#17a673',
            }]
        } : {
            labels: ['No Data'],
            datasets: [{
                label: 'Value',
                data: [0],
                backgroundColor: '#e74a3b',
            }]
        };
        
        chart2 = new Chart(ctx2, {
            type: 'bar',
            data: chart2Data,
            options: {
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false,
                    },
                    title: {
                        display: true,
                        text: stats.totalSales ? 'Total Sales' : stats.totalValue ? 'Inventory Value' : 'No Data'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return formatCurrency(value);
                            }
                        }
                    }
                }
            }
        });
        
    } catch (error) {
        console.error('Error updating charts:', error);
    }
}

// Export report to different formats
async function exportReport(format = 'pdf') {
    try {
        const reportType = document.getElementById('reportType')?.value;
        if (!reportType) {
            showToast('Please generate a report first', 'warning');
            return;
        }
        
        // Get the report data from the table
        const tableBody = document.getElementById('reportTableBody');
        if (!tableBody || tableBody.children.length === 0) {
            showToast('No report data to export', 'warning');
            return;
        }
        
        // Show loading state
        const exportBtn = document.querySelector(`#export${format.charAt(0).toUpperCase() + format.slice(1)}Btn`) || 
                         document.querySelector(`#export${format.charAt(0).toUpperCase() + format.slice(1)}Btn2`);
        
        if (exportBtn) {
            const originalText = exportBtn.innerHTML;
            exportBtn.disabled = true;
            exportBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Exporting...';
            
            try {
                if (format === 'excel' && reportType === 'sales') {
                    // Use the existing Excel export for sales
                    const startDate = document.getElementById('reportStartDate')?.value || '';
                    const endDate = document.getElementById('reportEndDate')?.value || '';
                    const category = document.getElementById('reportCategory')?.value || '';
                    
                    await reports.exportSalesToExcel({ startDate, endDate, category });
                    showToast('Report exported to Excel successfully', 'success');
                } else {
                    // For other formats or report types, show a message
                    showToast(`${format.toUpperCase()} export is not yet implemented for ${reportType} reports`, 'info');
                }
            } catch (error) {
                console.error('Error exporting report:', error);
                showToast(`Failed to export report: ${error.message || 'Unknown error'}`, 'danger');
            } finally {
                // Reset button
                exportBtn.disabled = false;
                exportBtn.innerHTML = originalText;
            }
        }
    } catch (error) {
        console.error('Error exporting report:', error);
        showToast(`Failed to export report: ${error.message || 'Unknown error'}`, 'danger');
    }
}

// Export sales data to Excel
async function exportSalesToExcel() {
    try {
        const startDate = document.getElementById('reportStartDate')?.value || '';
        const endDate = document.getElementById('reportEndDate')?.value || '';
        const category = document.getElementById('reportCategory')?.value || '';
        
        console.log('Exporting sales to Excel with params:', { startDate, endDate, category });
        
        // Call the reports API to export sales data
        const result = await reports.exportSalesToExcel({
            startDate,
            endDate,
            category: category || null
        });
        
        console.log('Export result:', result);
        showToast('Sales data exported to Excel successfully', 'success');
        
        return result;
    } catch (error) {
        console.error('Error exporting sales to Excel:', error);
        showToast(`Failed to export sales data: ${error.message || 'Unknown error'}`, 'danger');
        throw error;
    }
}

// Export functions that need to be available to other modules
export {
    updateReportForm,
    validateDateRange,
    generateReport,
    exportSalesToExcel,
    exportReport
};

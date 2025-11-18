// Reports page functionality
const { ipcRenderer } = window.electron || {};
import { reports, products } from '../core/api.js';
import { showToast, formatCurrency, formatDate } from '../core/utils.js';

// Global variables
let chart1 = null;
let chart2 = null;

// Helper function to get shop name
async function getShopName() {
    try {
        const { settings } = await import('../core/api.js');
        const shopName = (await settings.get('shop_name'))?.value || (await settings.get('company_name'))?.value || 'Wolo Pharmacy';
        return shopName;
    } catch (error) {
        console.error('Error getting shop name:', error);
        return 'Wolo Pharmacy';
    }
}

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
        if (['sales', 'inventory', 'expiring', 'income-statement', 'cash-flow', 'profit-loss'].includes(reportType)) {
            if (!startDate || !endDate) {
                showToast('Please select a date range', 'warning');
                return;
            }
            if (!validateDateRange()) {
                return;
            }
        }
        
        // Balance sheet only needs end date
        if (reportType === 'balance-sheet') {
            if (!endDate) {
                showToast('Please select an end date', 'warning');
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
                    
                case 'income-statement':
                    reportTitle = 'Income Statement (Profit & Loss)';
                    reportData = await generateIncomeStatement(startDate, endDate);
                    break;
                    
                case 'balance-sheet':
                    reportTitle = 'Balance Sheet';
                    reportData = await generateBalanceSheet(endDate);
                    break;
                    
                case 'cash-flow':
                    reportTitle = 'Cash Flow Statement';
                    reportData = await generateCashFlowStatement(startDate, endDate);
                    break;
                    
                case 'profit-loss':
                    reportTitle = 'Profit & Loss Summary';
                    reportData = await generateProfitLossSummary(startDate, endDate);
                    break;
                    
                default:
                    throw new Error('Unsupported report type');
            }
            
            // For accounting reports, data is an object, not an array
            const processedData = ['income-statement', 'balance-sheet', 'cash-flow', 'profit-loss'].includes(reportType) 
                ? reportData 
                : (Array.isArray(reportData) ? reportData : (reportData?.data || []));
            
            // Render the report
            await renderReport(reportType, processedData);
            
            // Update the report title with shop name
            const reportTitleElement = document.getElementById('reportTitle');
            if (reportTitleElement) {
                const shopName = await getShopName();
                reportTitleElement.innerHTML = `<strong>${shopName}</strong> - ${reportTitle}`;
            }
            
            // Update report footer with shop name
            const reportFooter = document.getElementById('reportFooter');
            if (reportFooter) {
                const shopName = await getShopName();
                const generatedDate = new Date().toLocaleString();
                reportFooter.innerHTML = `<strong>${shopName}</strong> | Generated on ${generatedDate}`;
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
                
            case 'income-statement':
                await renderIncomeStatement(data);
                break;
                
            case 'balance-sheet':
                await renderBalanceSheet(data);
                break;
                
            case 'cash-flow':
                await renderCashFlowStatement(data);
                break;
                
            case 'profit-loss':
                await renderProfitLossSummary(data);
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
        
        // Add footer with totals and shop name
        const shopName = await getShopName();
        tableFooter.innerHTML = `
            <tr class="table-active">
                <td colspan="3" class="text-end"><strong>Total:</strong></td>
                <td><strong>${totalItems} items</strong></td>
                <td><strong>${formatCurrency(totalSales)}</strong></td>
                <td></td>
            </tr>
            <tr class="table-secondary">
                <td colspan="6" class="text-center"><strong>${shopName}</strong></td>
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
        
        // Add footer with totals and shop name
        const shopName = await getShopName();
        tableFooter.innerHTML = `
            <tr class="table-active">
                <td colspan="3" class="text-end"><strong>Total:</strong></td>
                <td><strong>${totalItems} items</strong></td>
                <td></td>
                <td><strong>${formatCurrency(totalValue)}</strong></td>
                <td></td>
            </tr>
            <tr class="table-secondary">
                <td colspan="7" class="text-center"><strong>${shopName}</strong></td>
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
        
        const shopName = await getShopName();
        
        // Set up table headers with shop name
        tableHeader.innerHTML = `
            <tr>
                <th colspan="7" class="text-center bg-primary text-white py-2">
                    <strong>${shopName}</strong><br>
                    <small>LOW STOCK REPORT</small>
                </th>
            </tr>
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
        
        // Add footer with counts and shop name
        const lowStockCount = lowStockData.filter(item => (parseInt(item.quantity_in_stock || item.quantityInStock || 0) > 0)).length;
        const outOfStockCount = lowStockData.filter(item => (parseInt(item.quantity_in_stock || item.quantityInStock || 0) === 0)).length;
        
        tableFooter.innerHTML = `
            <tr class="table-active">
                <td colspan="7" class="text-end">
                    <strong>Total Low/Out of Stock Items: ${lowStockData.length} (${lowStockCount} low stock, ${outOfStockCount} out of stock)</strong>
                </td>
            </tr>
            <tr class="table-secondary">
                <td colspan="7" class="text-center"><strong>${shopName}</strong></td>
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
        
        const shopName = await getShopName();
        tableFooter.innerHTML = `
            <tr class="table-active">
                <td colspan="6" class="text-end">
                    <strong>Total: ${expiringData.length} items (${expiredCount} expired, ${expiringSoonCount} expiring soon)</strong>
                </td>
            </tr>
            <tr class="table-secondary">
                <td colspan="6" class="text-center"><strong>${shopName}</strong></td>
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
        
        // Scope to reports page only - don't update dashboard elements
        const reportsPage = document.getElementById('reports-page');
        if (!reportsPage) {
            console.warn('Reports page not found, cannot update summary cards');
            return;
        }
        
        // Update summary cards if they exist within the reports page only
        const updateIfExists = (id, value, isCurrency = false) => {
            // First try to find within reports page
            const element = reportsPage.querySelector(`#${id}`);
            // If not found in reports page, try document-wide (for backward compatibility)
            // but only if it's a report-specific element (not dashboard elements)
            const elementToUpdate = element || (id.startsWith('report') ? document.getElementById(id) : null);
            if (elementToUpdate) {
                elementToUpdate.textContent = isCurrency ? `GH₵ ${parseFloat(value || 0).toFixed(2)}` : (value || 0);
            }
        };
        
        // Only update report-specific summary cards, not dashboard elements
        // Use report-specific IDs to avoid conflicts
        updateIfExists('reportTotalProducts', totalProducts);
        updateIfExists('reportTotalInStock', totalInStock);
        updateIfExists('reportTotalLowStock', totalLowStock);
        updateIfExists('reportTotalOutOfStock', totalOutOfStock);
        updateIfExists('reportTotalSales', totalSales, true);
        updateIfExists('reportTotalInventoryValue', totalValue, true);
        
        // Also update generic IDs if they exist within reports page only (for backward compatibility)
        const updateInReportsPage = (id, value, isCurrency = false) => {
            const element = reportsPage.querySelector(`#${id}`);
            if (element) {
                element.textContent = isCurrency ? `GH₵ ${parseFloat(value || 0).toFixed(2)}` : (value || 0);
            }
        };
        
        // Update generic IDs only within reports page scope
        updateInReportsPage('totalProducts', totalProducts);
        updateInReportsPage('totalInStock', totalInStock);
        updateInReportsPage('totalLowStock', totalLowStock);
        updateInReportsPage('totalOutOfStock', totalOutOfStock);
        updateInReportsPage('totalSales', totalSales, true);
        updateInReportsPage('totalInventoryValue', totalValue, true);
        
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

// ============================================
// Accounting Report Generation Functions
// ============================================

// Generate Income Statement (Profit & Loss)
async function generateIncomeStatement(startDate, endDate) {
    try {
        // Get sales data
        const salesData = await reports.getSalesReport({ startDate, endDate });
        const sales = Array.isArray(salesData) ? salesData : (salesData?.data || []);
        
        // Get all products to calculate COGS
        const productsData = await products.getAll();
        const allProducts = Array.isArray(productsData) ? productsData : (productsData?.data || []);
        
        // Calculate Revenue (Total Sales)
        const totalRevenue = sales.reduce((sum, sale) => {
            return sum + parseFloat(sale.total_amount || sale.total || 0);
        }, 0);
        
        // Calculate Cost of Goods Sold (COGS)
        // COGS = Sum of (quantity sold * unit cost) for all items sold
        let totalCOGS = 0;
        
        // Get sale items for all sales
        const { ipcCall } = await import('../core/api.js');
        for (const sale of sales) {
            try {
                // Get sale items from database
                const saleItems = await ipcCall('get-sale-items', { saleId: sale.id });
                const items = Array.isArray(saleItems) ? saleItems : (saleItems?.data || []);
                
                for (const item of items) {
                    // Use product cost data from sale_items query if available
                    let unitCost = 0;
                    
                    // Try multiple ways to get the cost
                    // 1. From sale_items if it has cost data
                    if (item.total_bulk_cost && item.quantity_purchased) {
                        const quantityPurchased = parseFloat(item.quantity_purchased || 1);
                        const totalBulkCost = parseFloat(item.total_bulk_cost || 0);
                        unitCost = quantityPurchased > 0 ? totalBulkCost / quantityPurchased : 0;
                    } 
                    // 2. Try cost_price directly from item
                    else if (item.cost_price || item.costPrice) {
                        unitCost = parseFloat(item.cost_price || item.costPrice || 0);
                    }
                    // 3. Fallback to finding product in allProducts
                    else {
                        const product = allProducts.find(p => 
                            p.id === item.product_id || 
                            p.id === item.productId ||
                            (item.product_id && p.id && p.id.toString() === item.product_id.toString())
                        );
                        if (product) {
                            // Try cost_price first
                            if (product.cost_price || product.costPrice) {
                                unitCost = parseFloat(product.cost_price || product.costPrice || 0);
                            }
                            // Then try calculating from total_bulk_cost
                            else if (product.total_bulk_cost && product.quantity_purchased) {
                                const quantityPurchased = parseFloat(product.quantity_purchased || product.quantityPurchased || 1);
                                const totalBulkCost = parseFloat(product.total_bulk_cost || product.totalBulkCost || 0);
                                unitCost = quantityPurchased > 0 ? totalBulkCost / quantityPurchased : 0;
                            }
                            // Last resort: estimate from selling price (assume 30% margin)
                            else if (product.selling_price || product.sellingPrice) {
                                const sellingPrice = parseFloat(product.selling_price || product.sellingPrice || 0);
                                unitCost = sellingPrice / 1.3; // Estimate cost as 70% of selling price
                            }
                        }
                    }
                    
                    const quantitySold = parseFloat(item.quantity || item.quantity_sold || 0);
                    if (quantitySold > 0 && unitCost > 0) {
                        totalCOGS += (quantitySold * unitCost);
                    }
                }
            } catch (error) {
                console.warn(`Could not get sale items for sale ${sale.id}:`, error);
                // Fallback: estimate COGS as 60% of revenue if we can't get item details
                const saleAmount = parseFloat(sale.total_amount || sale.total || 0);
                totalCOGS += (saleAmount * 0.6);
            }
        }
        
        // Calculate Gross Profit
        const grossProfit = totalRevenue - totalCOGS;
        const grossProfitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
        
        // Operating Expenses (placeholder - can be expanded with actual expense tracking)
        const operatingExpenses = 0; // TODO: Add expense tracking
        
        // Calculate Net Income
        const netIncome = grossProfit - operatingExpenses;
        const netProfitMargin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;
        
        return {
            period: { startDate, endDate },
            revenue: {
                total: totalRevenue,
                sales: totalRevenue
            },
            cogs: {
                total: totalCOGS,
                percentage: totalRevenue > 0 ? (totalCOGS / totalRevenue) * 100 : 0
            },
            grossProfit: {
                total: grossProfit,
                margin: grossProfitMargin
            },
            operatingExpenses: {
                total: operatingExpenses,
                breakdown: {}
            },
            netIncome: {
                total: netIncome,
                margin: netProfitMargin
            },
            salesCount: sales.length
        };
    } catch (error) {
        console.error('Error generating income statement:', error);
        throw error;
    }
}

// Generate Balance Sheet
async function generateBalanceSheet(asOfDate) {
    try {
        // Get all products to calculate inventory value
        const productsData = await products.getAll();
        const allProducts = Array.isArray(productsData) ? productsData : (productsData?.data || []);
        
        // Calculate Inventory Value (Current Assets)
        let inventoryValue = 0;
        allProducts.forEach(product => {
            const quantity = parseFloat(product.quantity_in_stock || 0);
            const unitCost = parseFloat(product.total_bulk_cost || 0) / parseFloat(product.quantity_purchased || 1);
            inventoryValue += (quantity * unitCost);
        });
        
        // Get all sales to calculate accounts receivable and cash
        const salesData = await reports.getSalesReport({ 
            startDate: '2000-01-01', 
            endDate: asOfDate || new Date().toISOString().split('T')[0] 
        });
        const allSales = Array.isArray(salesData) ? salesData : (salesData?.data || []);
        
        // Calculate Cash (from sales - assuming all sales are cash for now)
        const cash = allSales.reduce((sum, sale) => {
            return sum + parseFloat(sale.total_amount || sale.total || 0);
        }, 0);
        
        // Accounts Receivable (placeholder - can be expanded)
        const accountsReceivable = 0;
        
        // Total Current Assets
        const currentAssets = cash + inventoryValue + accountsReceivable;
        
        // Fixed Assets (placeholder)
        const fixedAssets = 0;
        
        // Total Assets
        const totalAssets = currentAssets + fixedAssets;
        
        // Liabilities (placeholder - can be expanded)
        const currentLiabilities = 0;
        const longTermLiabilities = 0;
        const totalLiabilities = currentLiabilities + longTermLiabilities;
        
        // Equity
        const equity = totalAssets - totalLiabilities;
        
        return {
            asOfDate: asOfDate || new Date().toISOString().split('T')[0],
            assets: {
                current: {
                    cash: cash,
                    inventory: inventoryValue,
                    accountsReceivable: accountsReceivable,
                    total: currentAssets
                },
                fixed: fixedAssets,
                total: totalAssets
            },
            liabilities: {
                current: currentLiabilities,
                longTerm: longTermLiabilities,
                total: totalLiabilities
            },
            equity: equity
        };
    } catch (error) {
        console.error('Error generating balance sheet:', error);
        throw error;
    }
}

// Generate Cash Flow Statement
async function generateCashFlowStatement(startDate, endDate) {
    try {
        // Get sales data
        const salesData = await reports.getSalesReport({ startDate, endDate });
        const sales = Array.isArray(salesData) ? salesData : (salesData?.data || []);
        
        // Operating Activities - Cash from Sales
        const cashFromSales = sales.reduce((sum, sale) => {
            return sum + parseFloat(sale.total_amount || sale.total || 0);
        }, 0);
        
        // Operating Activities - Cash paid for inventory (placeholder)
        const cashPaidForInventory = 0;
        
        // Net Cash from Operating Activities
        const netCashOperating = cashFromSales - cashPaidForInventory;
        
        // Investing Activities (placeholder)
        const investingActivities = 0;
        
        // Financing Activities (placeholder)
        const financingActivities = 0;
        
        // Net Change in Cash
        const netChangeInCash = netCashOperating + investingActivities + financingActivities;
        
        return {
            period: { startDate, endDate },
            operating: {
                cashFromSales: cashFromSales,
                cashPaidForInventory: cashPaidForInventory,
                net: netCashOperating
            },
            investing: investingActivities,
            financing: financingActivities,
            netChangeInCash: netChangeInCash
        };
    } catch (error) {
        console.error('Error generating cash flow statement:', error);
        throw error;
    }
}

// Generate Profit & Loss Summary
async function generateProfitLossSummary(startDate, endDate) {
    try {
        const incomeStatement = await generateIncomeStatement(startDate, endDate);
        
        return {
            period: { startDate, endDate },
            summary: {
                revenue: incomeStatement.revenue.total,
                cogs: incomeStatement.cogs.total,
                grossProfit: incomeStatement.grossProfit.total,
                operatingExpenses: incomeStatement.operatingExpenses.total,
                netIncome: incomeStatement.netIncome.total
            },
            margins: {
                grossProfitMargin: incomeStatement.grossProfit.margin,
                netProfitMargin: incomeStatement.netIncome.margin
            },
            salesCount: incomeStatement.salesCount
        };
    } catch (error) {
        console.error('Error generating profit & loss summary:', error);
        throw error;
    }
}

// ============================================
// Accounting Report Rendering Functions
// ============================================

// Render Income Statement
async function renderIncomeStatement(data) {
    const tableHeader = document.getElementById('reportTableHeader');
    const tableBody = document.getElementById('reportTableBody');
    const tableFooter = document.getElementById('reportTableFooter');
    
    if (!tableHeader || !tableBody || !tableFooter) return;
    
    const shopName = await getShopName();
    
    tableHeader.innerHTML = `
        <tr>
            <th colspan="2" class="text-center bg-primary text-white py-2">
                <strong>${shopName}</strong><br>
                <small>INCOME STATEMENT</small>
            </th>
        </tr>
        <tr>
            <th>Description</th>
            <th class="text-end">Amount (GH₵)</th>
        </tr>
    `;
    
    tableBody.innerHTML = `
        <tr class="table-primary">
            <td><strong>REVENUE</strong></td>
            <td class="text-end"></td>
        </tr>
        <tr>
            <td style="padding-left: 30px;">Sales Revenue</td>
            <td class="text-end">${formatCurrency(data.revenue?.total || 0)}</td>
        </tr>
        <tr class="table-info">
            <td><strong>Total Revenue</strong></td>
            <td class="text-end"><strong>${formatCurrency(data.revenue?.total || 0)}</strong></td>
        </tr>
        <tr class="table-primary">
            <td><strong>COST OF GOODS SOLD</strong></td>
            <td class="text-end"></td>
        </tr>
        <tr>
            <td style="padding-left: 30px;">Cost of Goods Sold</td>
            <td class="text-end">${formatCurrency(data.cogs?.total || 0)}</td>
        </tr>
        <tr class="table-info">
            <td><strong>Total COGS</strong></td>
            <td class="text-end"><strong>${formatCurrency(data.cogs?.total || 0)}</strong></td>
        </tr>
        <tr class="table-success">
            <td><strong>GROSS PROFIT</strong></td>
            <td class="text-end"><strong>${formatCurrency(data.grossProfit?.total || 0)}</strong></td>
        </tr>
        <tr>
            <td style="padding-left: 30px;">Gross Profit Margin</td>
            <td class="text-end">${(data.grossProfit?.margin || 0).toFixed(2)}%</td>
        </tr>
        <tr class="table-primary">
            <td><strong>OPERATING EXPENSES</strong></td>
            <td class="text-end"></td>
        </tr>
        <tr>
            <td style="padding-left: 30px;">Operating Expenses</td>
            <td class="text-end">${formatCurrency(data.operatingExpenses?.total || 0)}</td>
        </tr>
        <tr class="table-info">
            <td><strong>Total Operating Expenses</strong></td>
            <td class="text-end"><strong>${formatCurrency(data.operatingExpenses?.total || 0)}</strong></td>
        </tr>
        <tr class="table-warning">
            <td><strong>NET INCOME</strong></td>
            <td class="text-end"><strong>${formatCurrency(data.netIncome?.total || 0)}</strong></td>
        </tr>
        <tr>
            <td style="padding-left: 30px;">Net Profit Margin</td>
            <td class="text-end">${(data.netIncome?.margin || 0).toFixed(2)}%</td>
        </tr>
    `;
    
    // Reuse shopName from earlier in the function
    tableFooter.innerHTML = `
        <tr class="table-secondary">
            <td><strong>${shopName}</strong> | Period: ${formatDate(data.period.startDate)} to ${formatDate(data.period.endDate)}</td>
            <td class="text-end"><strong>Total Sales Transactions:</strong> ${data.salesCount}</td>
        </tr>
    `;
}

// Render Balance Sheet
async function renderBalanceSheet(data) {
    const tableHeader = document.getElementById('reportTableHeader');
    const tableBody = document.getElementById('reportTableBody');
    const tableFooter = document.getElementById('reportTableFooter');
    
    if (!tableHeader || !tableBody || !tableFooter) return;
    
    const shopName = await getShopName();
    
    tableHeader.innerHTML = `
        <tr>
            <th colspan="2" class="text-center bg-primary text-white py-2">
                <strong>${shopName}</strong><br>
                <small>BALANCE SHEET</small>
            </th>
        </tr>
        <tr>
            <th>Account</th>
            <th class="text-end">Amount (GH₵)</th>
        </tr>
    `;
    
    tableBody.innerHTML = `
        <tr class="table-primary">
            <td><strong>ASSETS</strong></td>
            <td class="text-end"></td>
        </tr>
        <tr>
            <td style="padding-left: 30px;"><strong>Current Assets</strong></td>
            <td class="text-end"></td>
        </tr>
        <tr>
            <td style="padding-left: 60px;">Cash</td>
            <td class="text-end">${formatCurrency(data.assets?.current?.cash || 0)}</td>
        </tr>
        <tr>
            <td style="padding-left: 60px;">Inventory</td>
            <td class="text-end">${formatCurrency(data.assets?.current?.inventory || 0)}</td>
        </tr>
        <tr>
            <td style="padding-left: 60px;">Accounts Receivable</td>
            <td class="text-end">${formatCurrency(data.assets?.current?.accountsReceivable || 0)}</td>
        </tr>
        <tr class="table-info">
            <td style="padding-left: 30px;"><strong>Total Current Assets</strong></td>
            <td class="text-end"><strong>${formatCurrency(data.assets?.current?.total || 0)}</strong></td>
        </tr>
        <tr>
            <td style="padding-left: 30px;"><strong>Fixed Assets</strong></td>
            <td class="text-end">${formatCurrency(data.assets?.fixed || 0)}</td>
        </tr>
        <tr class="table-success">
            <td><strong>TOTAL ASSETS</strong></td>
            <td class="text-end"><strong>${formatCurrency(data.assets?.total || 0)}</strong></td>
        </tr>
        <tr class="table-primary">
            <td><strong>LIABILITIES</strong></td>
            <td class="text-end"></td>
        </tr>
        <tr>
            <td style="padding-left: 30px;">Current Liabilities</td>
            <td class="text-end">${formatCurrency(data.liabilities?.current || 0)}</td>
        </tr>
        <tr>
            <td style="padding-left: 30px;">Long-term Liabilities</td>
            <td class="text-end">${formatCurrency(data.liabilities?.longTerm || 0)}</td>
        </tr>
        <tr class="table-info">
            <td><strong>TOTAL LIABILITIES</strong></td>
            <td class="text-end"><strong>${formatCurrency(data.liabilities?.total || 0)}</strong></td>
        </tr>
        <tr class="table-warning">
            <td><strong>EQUITY</strong></td>
            <td class="text-end"><strong>${formatCurrency(data.equity || 0)}</strong></td>
        </tr>
        <tr class="table-success">
            <td><strong>TOTAL LIABILITIES & EQUITY</strong></td>
            <td class="text-end"><strong>${formatCurrency((data.liabilities?.total || 0) + (data.equity || 0))}</strong></td>
        </tr>
    `;
    
    // Reuse shopName from earlier in the function
    tableFooter.innerHTML = `
        <tr class="table-secondary">
            <td><strong>${shopName}</strong> | As of: ${formatDate(data.asOfDate)}</td>
            <td class="text-end"></td>
        </tr>
    `;
}

// Render Cash Flow Statement
async function renderCashFlowStatement(data) {
    const tableHeader = document.getElementById('reportTableHeader');
    const tableBody = document.getElementById('reportTableBody');
    const tableFooter = document.getElementById('reportTableFooter');
    
    if (!tableHeader || !tableBody || !tableFooter) return;
    
    const shopName = await getShopName();
    
    tableHeader.innerHTML = `
        <tr>
            <th colspan="2" class="text-center bg-primary text-white py-2">
                <strong>${shopName}</strong><br>
                <small>CASH FLOW STATEMENT</small>
            </th>
        </tr>
        <tr>
            <th>Activity</th>
            <th class="text-end">Amount (GH₵)</th>
        </tr>
    `;
    
    tableBody.innerHTML = `
        <tr class="table-primary">
            <td><strong>CASH FLOW FROM OPERATING ACTIVITIES</strong></td>
            <td class="text-end"></td>
        </tr>
        <tr>
            <td style="padding-left: 30px;">Cash from Sales</td>
            <td class="text-end">${formatCurrency(data.operating?.cashFromSales || 0)}</td>
        </tr>
        <tr>
            <td style="padding-left: 30px;">Cash Paid for Inventory</td>
            <td class="text-end">(${formatCurrency(data.operating?.cashPaidForInventory || 0)})</td>
        </tr>
        <tr class="table-info">
            <td><strong>Net Cash from Operating Activities</strong></td>
            <td class="text-end"><strong>${formatCurrency(data.operating?.net || 0)}</strong></td>
        </tr>
        <tr class="table-primary">
            <td><strong>CASH FLOW FROM INVESTING ACTIVITIES</strong></td>
            <td class="text-end"></td>
        </tr>
        <tr>
            <td style="padding-left: 30px;">Investing Activities</td>
            <td class="text-end">${formatCurrency(data.investing || 0)}</td>
        </tr>
        <tr class="table-primary">
            <td><strong>CASH FLOW FROM FINANCING ACTIVITIES</strong></td>
            <td class="text-end"></td>
        </tr>
        <tr>
            <td style="padding-left: 30px;">Financing Activities</td>
            <td class="text-end">${formatCurrency(data.financing || 0)}</td>
        </tr>
        <tr class="table-success">
            <td><strong>NET CHANGE IN CASH</strong></td>
            <td class="text-end"><strong>${formatCurrency(data.netChangeInCash || 0)}</strong></td>
        </tr>
    `;
    
    // Reuse shopName from earlier in the function
    tableFooter.innerHTML = `
        <tr class="table-secondary">
            <td><strong>${shopName}</strong> | Period: ${formatDate(data.period.startDate)} to ${formatDate(data.period.endDate)}</td>
            <td class="text-end"></td>
        </tr>
    `;
}

// Render Profit & Loss Summary
async function renderProfitLossSummary(data) {
    const tableHeader = document.getElementById('reportTableHeader');
    const tableBody = document.getElementById('reportTableBody');
    const tableFooter = document.getElementById('reportTableFooter');
    
    if (!tableHeader || !tableBody || !tableFooter) return;
    
    const shopName = await getShopName();
    
    tableHeader.innerHTML = `
        <tr>
            <th colspan="3" class="text-center bg-primary text-white py-2">
                <strong>${shopName}</strong><br>
                <small>PROFIT & LOSS SUMMARY</small>
            </th>
        </tr>
        <tr>
            <th>Item</th>
            <th class="text-end">Amount (GH₵)</th>
            <th class="text-end">Margin (%)</th>
        </tr>
    `;
    
    const revenue = data.summary?.revenue || 0;
    const cogs = data.summary?.cogs || 0;
    const grossProfit = data.summary?.grossProfit || 0;
    const operatingExpenses = data.summary?.operatingExpenses || 0;
    const netIncome = data.summary?.netIncome || 0;
    const grossProfitMargin = data.margins?.grossProfitMargin || 0;
    const netProfitMargin = data.margins?.netProfitMargin || 0;
    
    tableBody.innerHTML = `
        <tr class="table-primary">
            <td><strong>Total Revenue</strong></td>
            <td class="text-end"><strong>${formatCurrency(revenue)}</strong></td>
            <td class="text-end">100.00%</td>
        </tr>
        <tr>
            <td>Cost of Goods Sold</td>
            <td class="text-end">${formatCurrency(cogs)}</td>
            <td class="text-end">${revenue > 0 ? ((cogs / revenue) * 100).toFixed(2) : '0.00'}%</td>
        </tr>
        <tr class="table-success">
            <td><strong>Gross Profit</strong></td>
            <td class="text-end"><strong>${formatCurrency(grossProfit)}</strong></td>
            <td class="text-end"><strong>${grossProfitMargin.toFixed(2)}%</strong></td>
        </tr>
        <tr>
            <td>Operating Expenses</td>
            <td class="text-end">${formatCurrency(operatingExpenses)}</td>
            <td class="text-end">${revenue > 0 ? ((operatingExpenses / revenue) * 100).toFixed(2) : '0.00'}%</td>
        </tr>
        <tr class="table-warning">
            <td><strong>Net Income</strong></td>
            <td class="text-end"><strong>${formatCurrency(netIncome)}</strong></td>
            <td class="text-end"><strong>${netProfitMargin.toFixed(2)}%</strong></td>
        </tr>
    `;
    
    // Reuse shopName from earlier in the function
    tableFooter.innerHTML = `
        <tr class="table-secondary">
            <td><strong>${shopName}</strong> | Period: ${formatDate(data.period.startDate)} to ${formatDate(data.period.endDate)}</td>
            <td class="text-end"><strong>Total Sales:</strong> ${data.salesCount}</td>
            <td class="text-end"></td>
        </tr>
    `;
}

// Export functions that need to be available to other modules
export {
    updateReportForm,
    validateDateRange,
    generateReport,
    exportSalesToExcel,
    exportReport
};

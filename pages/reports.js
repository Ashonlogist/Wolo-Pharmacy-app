// Reports page functionality
const { ipcRenderer } = window.electron || {};
import { reports, products } from '../core/api.js';
import { showToast } from '../core/utils.js';

// Global variables
let chart1 = null;
let chart2 = null;

// Initialize the reports page
document.addEventListener('DOMContentLoaded', async () => {
    try {
        initializeDatePickers();
        setupEventListeners();
        await loadReportCategories();
        
        // Set default dates
        const today = new Date();
        const lastMonth = new Date();
        lastMonth.setMonth(today.getMonth() - 1);
        
        document.getElementById('reportStartDate').valueAsDate = lastMonth;
        document.getElementById('reportEndDate').valueAsDate = today;
        
        // Initialize event listeners for report type changes
        document.getElementById('reportType').addEventListener('change', updateReportForm);
        
        // Add event listener for generate report button
        document.getElementById('generateReportBtn').addEventListener('click', generateReport);
        
        // Initialize the form
        updateReportForm();
        
    } catch (error) {
        console.error('Error initializing reports page:', error);
        showToast('Failed to initialize reports page', 'danger');
    }
});

// Initialize date pickers
function initializeDatePickers() {
    // Flatpickr initialization can be added here if needed
    console.log('Date pickers initialized');
}

// Set up event listeners
function setupEventListeners() {
    // Export buttons
    document.getElementById('exportPDFBtn')?.addEventListener('click', () => exportReport('pdf'));
    document.getElementById('exportExcelBtn')?.addEventListener('click', () => exportReport('excel'));
    document.getElementById('exportCSVBtn')?.addEventListener('click', () => exportReport('csv'));
    
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
            
            // Render the report
            await renderReport(reportType, reportData);
            
            // Update the report title
            const reportTitleElement = document.getElementById('reportTitle');
            if (reportTitleElement) {
                reportTitleElement.textContent = reportTitle;
            }
            
            // Show the report container
            document.getElementById('reportContainer').style.display = 'block';
            
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
        
        // Add table rows
        let totalSales = 0;
        let totalItems = 0;
        
        data.forEach(sale => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${new Date(sale.date).toLocaleDateString()}</td>
                <td>${sale.orderId || 'N/A'}</td>
                <td>${sale.customerName || 'Walk-in'}</td>
                <td>${sale.items?.length || 0}</td>
                <td>GH₵ ${(sale.total || 0).toFixed(2)}</td>
                <td><span class="badge bg-success">${sale.status || 'Completed'}</span></td>
            `;
            tableBody.appendChild(row);
            
            // Update totals
            totalSales += parseFloat(sale.total || 0);
            totalItems += parseInt(sale.items?.length || 0);
        });
        
        // Add footer with totals
        tableFooter.innerHTML = `
            <tr class="table-active">
                <td colspan="3" class="text-end"><strong>Total:</strong></td>
                <td><strong>${totalItems} items</strong></td>
                <td><strong>GH₵ ${totalSales.toFixed(2)}</strong></td>
                <td></td>
            </tr>
        `;
        
        // Update summary cards
        updateSummaryCards({
            totalProducts: data.length,
            totalInStock: data.reduce((sum, item) => sum + (item.items?.length || 0), 0),
            totalSales: totalSales
        });
        
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
        
        data.forEach(item => {
            const inStock = parseInt(item.quantityInStock) || 0;
            const price = parseFloat(item.sellingPrice) || 0;
            const value = inStock * price;
            
            // Update counts
            totalValue += value;
            totalItems += inStock;
            
            if (inStock === 0) outOfStockCount++;
            else if (inStock <= (parseInt(item.reorderLevel) || 5)) lowStockCount++;
            
            const statusClass = inStock === 0 ? 'bg-danger' : 
                              inStock <= (parseInt(item.reorderLevel) || 5) ? 'bg-warning' : 'bg-success';
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.name || 'N/A'}</td>
                <td>${item.category || 'Uncategorized'}</td>
                <td>${item.sku || 'N/A'}</td>
                <td>${inStock}</td>
                <td>GH₵ ${price.toFixed(2)}</td>
                <td>GH₵ ${value.toFixed(2)}</td>
                <td><span class="badge ${statusClass}">
                    ${inStock === 0 ? 'Out of Stock' : inStock <= (parseInt(item.reorderLevel) || 5) ? 'Low Stock' : 'In Stock'}
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
                <td><strong>GH₵ ${totalValue.toFixed(2)}</strong></td>
                <td></td>
            </tr>
        `;
        
        // Update summary cards
        updateSummaryCards({
            totalProducts: data.length,
            totalInStock: totalItems,
            totalLowStock: lowStockCount,
            totalOutOfStock: outOfStockCount,
            totalValue: totalValue
        });
        
    } catch (error) {
        console.error('Error rendering inventory report:', error);
        throw error;
    }
}

// Render low stock report
async function renderLowStockReport(data) {
    // Sort by quantity ascending
    data.sort((a, b) => (parseInt(a.quantityInStock) || 0) - (parseInt(b.quantityInStock) || 0));
    
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
                <th>Reorder Level</th>
                <th>Status</th>
                <th>Action</th>
            </tr>
        `;
        
        // Add table rows
        data.forEach(item => {
            const inStock = parseInt(item.quantityInStock) || 0;
            const reorderLevel = parseInt(item.reorderLevel) || 5;
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
                            onclick="navigateTo('product-form', { id: '${item.id}' })">
                        Reorder
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });
        
        // Add footer with counts
        tableFooter.innerHTML = `
            <tr class="table-active">
                <td colspan="7" class="text-end">
                    <strong>Total Low/Out of Stock Items: ${data.length}</strong>
                </td>
            </tr>
        `;
        
        // Update summary cards
        updateSummaryCards({
            totalProducts: data.length,
            totalLowStock: data.filter(item => (parseInt(item.quantityInStock) || 0) > 0).length,
            totalOutOfStock: data.filter(item => (parseInt(item.quantityInStock) || 0) === 0).length
        });
        
    } catch (error) {
        console.error('Error rendering low stock report:', error);
        throw error;
    }
}

// Render expiring products report
async function renderExpiringProductsReport(data) {
    // Sort by expiry date ascending
    data.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
    
    const tableHeader = document.getElementById('reportTableHeader');
    const tableBody = document.getElementById('reportTableBody');
    const tableFooter = document.getElementById('reportTableFooter');
    
    if (!tableHeader || !tableBody || !tableFooter) return;
    
    try {
        // Set up table headers
        tableHeader.innerHTML = `
            <tr>
                <th>Product</th>
                <th>Batch/Lot</th>
                <th>Expiry Date</th>
                <th>Days Until Expiry</th>
                <th>In Stock</th>
                <th>Status</th>
            </tr>
        `;
        
        // Add table rows
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        data.forEach(item => {
            const expiryDate = new Date(item.expiryDate);
            const timeDiff = expiryDate - today;
            const daysUntilExpiry = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
            
            let statusClass = 'bg-success';
            let statusText = 'Good';
            
            if (daysUntilExpiry <= 0) {
                statusClass = 'bg-danger';
                statusText = 'Expired';
            } else if (daysUntilExpiry <= 30) {
                statusClass = 'bg-warning';
                statusText = 'Expiring Soon';
            }
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.productName || 'N/A'}</td>
                <td>${item.batchNumber || 'N/A'}</td>
                <td>${expiryDate.toLocaleDateString()}</td>
                <td>${daysUntilExpiry} days</td>
                <td>${item.quantityInStock || 0}</td>
                <td><span class="badge ${statusClass}">${statusText}</span></td>
            `;
            tableBody.appendChild(row);
        });
        
        // Add footer with counts
        const expiredCount = data.filter(item => {
            const expiryDate = new Date(item.expiryDate);
            return expiryDate < today;
        }).length;
        
        const expiringSoonCount = data.filter(item => {
            const expiryDate = new Date(item.expiryDate);
            const timeDiff = expiryDate - today;
            const daysUntilExpiry = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
            return daysUntilExpiry > 0 && daysUntilExpiry <= 30;
        }).length;
        
        tableFooter.innerHTML = `
            <tr class="table-active">
                <td colspan="6" class="text-end">
                    <strong>Total: ${data.length} items (${expiredCount} expired, ${expiringSoonCount} expiring soon)</strong>
                </td>
            </tr>
        `;
        
        // Update summary cards
        updateSummaryCards({
            totalProducts: data.length,
            totalExpired: expiredCount,
            totalExpiringSoon: expiringSoonCount
        });
        
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
        
        // Example chart 1: Inventory by Category (Pie chart)
        chart1 = new Chart(ctx1, {
            type: 'pie',
            data: {
                labels: ['Medicines', 'Supplements', 'Personal Care', 'First Aid', 'Other'],
                datasets: [{
                    data: [25, 20, 15, 10, 5], // Example data - replace with actual data
                    backgroundColor: [
                        '#4e73df',
                        '#1cc88a',
                        '#36b9cc',
                        '#f6c23e',
                        '#e74a3b'
                    ],
                    hoverBackgroundColor: [
                        '#2e59d9',
                        '#17a673',
                        '#2c9faf',
                        '#dda20a',
                        '#be2617'
                    ],
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
                        text: 'Inventory by Category'
                    }
                }
            }
        });
        
        // Example chart 2: Stock Status (Doughnut chart)
        chart2 = new Chart(ctx2, {
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
        
        // Show loading state
        const exportBtn = document.querySelector(`#export${format.toUpperCase()}Btn`);
        if (exportBtn) {
            const originalText = exportBtn.innerHTML;
            exportBtn.disabled = true;
            exportBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Exporting...';
            
            // Simulate export (replace with actual export logic)
            setTimeout(() => {
                // Reset button
                exportBtn.disabled = false;
                exportBtn.innerHTML = originalText;
                
                // Show success message
                showToast(`Report exported as ${format.toUpperCase()} successfully`, 'success');
            }, 1500);
            
            // TODO: Implement actual export logic based on format
            // This is a placeholder that would be replaced with actual export functionality
            console.log(`Exporting ${reportType} report as ${format}`);
            
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

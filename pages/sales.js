// Sales page functionality
import { products, sales } from '../core/api.js';
import { showToast } from '../core/utils.js';

let currentSaleItems = [];
let currentCustomer = null;

// Initialize the sales page
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initializeSalesPage();
        setupEventListeners();
    } catch (error) {
        console.error('Error initializing sales page:', error);
        showToast('Failed to initialize sales page', 'danger');
    }
});

// Initialize the sales page
async function initializeSalesPage() {
    try {
        await populateProductDropdown();
        await loadTodaysSales();
        resetSaleForm();
    } catch (error) {
        console.error('Error initializing sales page:', error);
        showToast('Failed to initialize sales page', 'danger');
    }
}

// Set up event listeners for the sales page
function setupEventListeners() {
    // Product selection
    const productSelect = document.getElementById('saleProduct');
    if (productSelect) {
        productSelect.addEventListener('change', (e) => updateSaleForm(e.target.value));
    }
    
    // Quantity input
    const quantityInput = document.getElementById('saleQuantity');
    if (quantityInput) {
        quantityInput.addEventListener('input', calculateSaleTotal);
    }
    
    // Sale form submission
    const saleForm = document.getElementById('saleForm');
    if (saleForm) {
        saleForm.addEventListener('submit', handleSaleSubmit);
    }
    
    // Date range filter
    const dateRangeInputs = ['startDate', 'endDate'];
    dateRangeInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('change', loadSalesByDateRange);
        }
    });
    
    // Print receipt button
    const printBtn = document.getElementById('printReceiptBtn');
    if (printBtn) {
        printBtn.addEventListener('click', printReceipt);
    }
}

// Populate product dropdown for sales
async function populateProductDropdown() {
    const productSelect = document.getElementById('saleProduct');
    if (!productSelect) return;
    
    try {
        const productList = await products.getAll();
        productSelect.innerHTML = '<option value="">Select a product</option>';
        
        productList.forEach(product => {
            if (product.quantity_in_stock > 0) {
                const option = document.createElement('option');
                option.value = product.id;
                option.textContent = `${product.name} (${product.quantity_in_stock} in stock)`;
                option.dataset.price = product.selling_price;
                productSelect.appendChild(option);
            }
        });
        
        showToast('Products loaded successfully', 'success');
    } catch (error) {
        console.error('Error loading products for sale:', error);
        showToast('Failed to load products', 'danger');
    }
}

// Update sale form when product is selected
function updateSaleForm(productId) {
    const selectedOption = document.querySelector(`#saleProduct option[value="${productId}"]`);
    if (!selectedOption) return;
    
    const price = parseFloat(selectedOption.dataset.price) || 0;
    document.getElementById('saleUnitPrice').value = price.toFixed(2);
    
    // Auto-focus quantity and select all text
    const quantityInput = document.getElementById('saleQuantity');
    if (quantityInput) {
        quantityInput.value = '1';
        quantityInput.focus();
        quantityInput.select();
    }
    
    calculateSaleTotal();
}

// Calculate sale total
function calculateSaleTotal() {
    const quantity = parseInt(document.getElementById('saleQuantity').value) || 0;
    const unitPrice = parseFloat(document.getElementById('saleUnitPrice').value) || 0;
    const total = (quantity * unitPrice).toFixed(2);
    document.getElementById('saleTotal').value = total;
}

// Handle sale form submission
async function handleSaleSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const productId = form.saleProduct.value;
    const quantity = parseInt(form.saleQuantity.value) || 0;
    const unitPrice = parseFloat(form.saleUnitPrice.value) || 0;
    const total = quantity * unitPrice;
    
    if (!productId || quantity <= 0) {
        showToast('Please select a product and enter a valid quantity', 'warning');
        return;
    }
    
    try {
        // Get product details
        const product = await products.getById(productId);
        
        if (!product) {
            showToast('Product not found', 'danger');
            return;
        }
        
        if (product.quantity_in_stock < quantity) {
            showToast(`Not enough stock. Only ${product.quantity_in_stock} available`, 'warning');
            return;
        }
        
        // Add to current sale items
        currentSaleItems.push({
            productId: product.id,
            name: product.name,
            quantity,
            unitPrice,
            total,
            product // Store full product details for receipt
        });
        
        updateSaleItemsList();
        resetSaleForm();
        
        // Focus back on product selection
        document.getElementById('saleProduct')?.focus();
        
        showToast('Item added to sale', 'success');
        
    } catch (error) {
        console.error('Error adding item to sale:', error);
        showToast('Failed to add item to sale', 'danger');
    }
}

// Update the sale items list in the UI
function updateSaleItemsList() {
    const itemsList = document.getElementById('saleItemsList');
    if (!itemsList) return;
    
    itemsList.innerHTML = '';
    let grandTotal = 0;
    
    currentSaleItems.forEach((item, index) => {
        grandTotal += item.total;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.productName}</td>
            <td class="text-end">${item.quantity}</td>
            <td class="text-end">$${item.unitPrice.toFixed(2)}</td>
            <td class="text-end">$${item.total.toFixed(2)}</td>
            <td class="text-center">
                <button class="btn btn-sm btn-danger" onclick="removeSaleItem(${index})">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;
        itemsList.appendChild(row);
    });
    
    // Update grand total
    document.getElementById('saleGrandTotal').textContent = grandTotal.toFixed(2);
}

// Remove item from current sale
function removeSaleItem(index) {
    if (index >= 0 && index < currentSaleItems.length) {
        currentSaleItems.splice(index, 1);
        updateSaleItemsList();
        showToast('Item removed from sale', 'info');
    }
}

// Reset sale form
function resetSaleForm() {
    const form = document.getElementById('saleForm');
    if (form) {
        form.reset();
        document.getElementById('saleQuantity').value = '1';
        document.getElementById('saleTotal').value = '0.00';
    }
}

// Load today's sales
async function loadTodaysSales() {
    try {
        const todaySales = await sales.getTodaySales();
        renderSalesTable(todaySales);
        showToast("Today's sales loaded", 'success');
    } catch (error) {
        console.error('Error loading today\'s sales:', error);
        showToast('Failed to load today\'s sales', 'danger');
    }
}

// Load sales by date range
async function loadSalesByDateRange() {
    try {
        const startDate = document.getElementById('startDate')?.value || new Date().toISOString().split('T')[0];
        const endDate = document.getElementById('endDate')?.value || new Date().toISOString().split('T')[0];
        
        // Ensure end date is not before start date
        if (new Date(endDate) < new Date(startDate)) {
            showToast('End date cannot be before start date', 'warning');
            return;
        }
        
        const salesData = await sales.getByDateRange(startDate, endDate);
        renderSalesTable(salesData);
        showToast(`Loaded sales from ${startDate} to ${endDate}`, 'success');
    } catch (error) {
        console.error('Error loading sales by date range:', error);
        showToast('Failed to load sales', 'danger');
    }
}

// Render sales table
function renderSalesTable(sales) {
    const tbody = document.querySelector('#salesTable tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    let totalSales = 0;
    
    sales.forEach(sale => {
        totalSales += sale.total || 0;
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${sale.invoiceNumber || ''}</td>
            <td>${sale.customerName || 'Walk-in Customer'}</td>
            <td>${new Date(sale.date).toLocaleDateString()}</td>
            <td>${sale.items?.length || 0}</td>
            <td class="text-end">$${(sale.total || 0).toFixed(2)}</td>
            <td class="text-center">
                <button class="btn btn-sm btn-info" onclick="viewSaleDetails('${sale.id}')">
                    <i class="bi bi-eye"></i> View
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    // Update summary
    document.getElementById('totalSalesCount').textContent = sales.length;
    document.getElementById('totalSalesAmount').textContent = totalSales.toFixed(2);
}

// View sale details
function viewSaleDetails(saleId) {
    // Navigate to sale details page or show a modal
    console.log('Viewing sale:', saleId);
    // You can implement this function based on your requirements
}

// Print receipt
function printReceipt() {
    if (currentSaleItems.length === 0) {
        showToast('No items in the current sale', 'warning');
        return;
    }
    
    // You can implement receipt printing logic here
    // This is a placeholder for the actual implementation
    const printWindow = window.open('', '_blank');
    
    // Generate receipt HTML
    let receiptHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Receipt</title>
            <style>
                body { font-family: Arial, sans-serif; font-size: 12px; }
                .receipt { width: 300px; margin: 0 auto; padding: 10px; }
                .header { text-align: center; margin-bottom: 10px; }
                .items { width: 100%; border-collapse: collapse; margin: 10px 0; }
                .items th { text-align: left; border-bottom: 1px dashed #000; padding: 5px 0; }
                .items td { padding: 3px 0; }
                .total { text-align: right; font-weight: bold; margin-top: 10px; }
                .footer { text-align: center; margin-top: 20px; font-size: 10px; }
            </style>
        </head>
        <body>
            <div class="receipt">
                <div class="header">
                    <h2>Wolo Pharmacy</h2>
                    <p>${new Date().toLocaleString()}</p>
                    <p>Thank you for your purchase!</p>
                </div>
                <table class="items">
                    <tr>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>Price</th>
                        <th>Total</th>
                    </tr>
    `;
    
    // Add items
    currentSaleItems.forEach(item => {
        receiptHtml += `
            <tr>
                <td>${item.productName}</td>
                <td>${item.quantity}</td>
                <td>$${item.unitPrice.toFixed(2)}</td>
                <td>$${item.total.toFixed(2)}</td>
            </tr>
        `;
    });
    
    // Calculate total
    const grandTotal = currentSaleItems.reduce((sum, item) => sum + item.total, 0);
    
    // Add total and footer
    receiptHtml += `
                </table>
                <div class="total">
                    Total: $${grandTotal.toFixed(2)}
                </div>
                <div class="footer">
                    <p>Thank you for shopping with us!</p>
                    <p>www.wolopharmacy.com</p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    // Write the receipt to the new window and print
    printWindow.document.write(receiptHtml);
    printWindow.document.close();
    printWindow.focus();
    
    // Wait for content to load before printing
    printWindow.onload = function() {
        setTimeout(() => {
            printWindow.print();
            // printWindow.close(); // Uncomment to close after printing
        }, 250);
    };
}

// Export functions that need to be available globally
window.updateSaleForm = updateSaleForm;
window.calculateSaleTotal = calculateSaleTotal;
window.removeSaleItem = removeSaleItem;
window.loadTodaysSales = loadTodaysSales;
window.loadSalesByDateRange = loadSalesByDateRange;
window.viewSaleDetails = viewSaleDetails;
window.printReceipt = printReceipt;

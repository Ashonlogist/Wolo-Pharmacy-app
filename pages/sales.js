// Sales page functionality
import { products, sales } from '../core/api.js';
import { showToast } from '../core/utils.js';

let currentSaleItems = [];
let currentCustomer = null;

// Prevent duplicate initialization
let salesPageInitialized = false;

// Initialize the sales page
async function initializeSalesPage() {
    if (salesPageInitialized) {
        console.warn('Sales page already initialized, skipping...');
        return;
    }
    
    try {
        salesPageInitialized = true;
        await populateProductDropdown();
        await loadTodaysSales();
        resetSaleForm();
        setupEventListeners();
        console.log('Sales page initialized successfully');
    } catch (error) {
        console.error('Error initializing sales page:', error);
        showToast('Failed to initialize sales page', 'danger');
        salesPageInitialized = false;
    }
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSalesPage);
} else {
    initializeSalesPage();
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
        saleForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleSaleSubmit(e);
        });
    }
    
    // Date range filter
    const dateRangeInputs = ['startDate', 'endDate'];
    dateRangeInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('change', loadSalesByDateRange);
        }
    });
    
    // Load sales by date range button
    const loadSalesBtn = document.getElementById('loadSalesByDateRangeBtn');
    if (loadSalesBtn) {
        loadSalesBtn.addEventListener('click', loadSalesByDateRange);
    }
    
    // Print receipt button
    const printBtn = document.getElementById('printReceiptBtn');
    if (printBtn) {
        printBtn.addEventListener('click', printReceipt);
    }
    
    // Complete sale button
    const completeBtn = document.getElementById('completeSaleBtn');
    if (completeBtn) {
        completeBtn.addEventListener('click', completeSale);
    }
}

// Populate product dropdown for sales
async function populateProductDropdown() {
    const productSelect = document.getElementById('saleProduct');
    if (!productSelect) return;
    
    try {
        const productList = await products.getAll();
        
        // Handle different response formats
        const productsArray = Array.isArray(productList) ? productList : (productList?.data || []);
        
        productSelect.innerHTML = '<option value="">Select a product</option>';
        
        // Filter out inactive products and duplicates
        const seenIds = new Set();
        const activeProducts = productsArray.filter(product => {
            if (!product.id || seenIds.has(product.id)) return false;
            if (product.is_active === 0 || product.is_active === false) return false;
            seenIds.add(product.id);
            return true;
        });
        
        activeProducts.forEach(product => {
            // Handle both snake_case and camelCase
            const stock = parseFloat(product.quantity_in_stock || product.quantityInStock || 0);
            const sellingPrice = parseFloat(product.selling_price || product.sellingPrice || 0);
            
            if (stock > 0) {
                const option = document.createElement('option');
                option.value = product.id;
                option.textContent = `${product.name || 'Unknown'} (${stock} in stock)`;
                option.dataset.price = sellingPrice;
                productSelect.appendChild(option);
            }
        });
        
        if (activeProducts.length > 0) {
            console.log(`Loaded ${activeProducts.length} products for sale`);
        }
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
        const productResponse = await products.getById(productId);
        
        // Handle different response formats
        const product = productResponse?.data || productResponse;
        
        if (!product || !product.id) {
            showToast('Product not found', 'danger');
            return;
        }
        
        // Ensure we have the product ID
        if (!product.id) {
            console.error('Product missing ID:', product);
            showToast('Product data is invalid', 'danger');
            return;
        }
        
        const stockQuantity = parseFloat(product.quantity_in_stock || product.quantityInStock || 0);
        if (stockQuantity < quantity) {
            showToast(`Not enough stock. Only ${stockQuantity} available`, 'warning');
            return;
        }
        
        // Add to current sale items
        const saleItem = {
            productId: product.id,
            name: product.name || 'Unknown Product',
            quantity,
            unitPrice,
            total,
            product // Store full product details for receipt
        };
        
        // Ensure productId is set correctly
        if (!saleItem.productId) {
            console.error('Sale item missing productId:', saleItem);
            throw new Error('Product ID is missing');
        }
        
        console.log('Adding sale item:', saleItem);
        currentSaleItems.push(saleItem);
        
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
    if (!itemsList) {
        // Try to create the items list if it doesn't exist
        const saleFormCard = document.querySelector('#sales-page .card');
        if (saleFormCard) {
            const itemsCard = document.createElement('div');
            itemsCard.className = 'card mb-4';
            itemsCard.innerHTML = `
                <div class="card-body">
                    <h5 class="card-title">Current Sale Items</h5>
                    <div class="table-responsive">
                        <table class="table table-sm">
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th class="text-end">Qty</th>
                                    <th class="text-end">Unit Price</th>
                                    <th class="text-end">Total</th>
                                    <th class="text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody id="saleItemsList"></tbody>
                            <tfoot>
                                <tr class="table-active">
                                    <th colspan="3" class="text-end">Grand Total:</th>
                                    <th class="text-end" id="saleGrandTotal">0.00</th>
                                    <th></th>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                    <div class="mt-3">
                        <label for="salePaymentMethod" class="form-label">Payment Method</label>
                        <select class="form-select mb-3" id="salePaymentMethod" required>
                            <option value="cash">Cash</option>
                            <option value="card">Card</option>
                            <option value="mobile_money">Mobile Money</option>
                            <option value="other">Other</option>
                        </select>
                        <label for="saleCustomerName" class="form-label">Customer Name (Optional)</label>
                        <input type="text" class="form-control mb-3" id="saleCustomerName" placeholder="Enter customer name">
                        <button type="button" class="btn btn-success w-100" id="completeSaleBtn">
                            <i class="bi bi-check-circle me-2"></i>Complete Sale
                        </button>
                    </div>
                </div>
            `;
            saleFormCard.after(itemsCard);
        }
    }
    
    const itemsListEl = document.getElementById('saleItemsList');
    if (!itemsListEl) return;
    
    itemsListEl.innerHTML = '';
    let grandTotal = 0;
    
    currentSaleItems.forEach((item, index) => {
        grandTotal += item.total;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.name}</td>
            <td class="text-end">${item.quantity}</td>
            <td class="text-end">GH₵${item.unitPrice.toFixed(2)}</td>
            <td class="text-end">GH₵${item.total.toFixed(2)}</td>
            <td class="text-center">
                <button class="btn btn-sm btn-danger remove-sale-item-btn" data-index="${index}">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;
        itemsListEl.appendChild(row);
    });
    
    // Update grand total
    const grandTotalEl = document.getElementById('saleGrandTotal');
    if (grandTotalEl) {
        grandTotalEl.textContent = `GH₵${grandTotal.toFixed(2)}`;
    }
    
    // Show/hide complete sale button based on items
    const completeBtn = document.getElementById('completeSaleBtn');
    if (completeBtn) {
        completeBtn.style.display = currentSaleItems.length > 0 ? 'block' : 'none';
        // Re-attach event listener if button was just created
        if (!completeBtn.hasAttribute('data-listener-attached')) {
            completeBtn.setAttribute('data-listener-attached', 'true');
            completeBtn.addEventListener('click', completeSale);
        }
    }
    
    // Add event listeners for remove buttons (remove old listeners first to prevent duplicates)
    document.querySelectorAll('.remove-sale-item-btn').forEach(btn => {
        // Clone and replace to remove old event listeners
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', (e) => {
            const index = parseInt(e.target.closest('.remove-sale-item-btn').dataset.index);
            removeSaleItem(index);
        });
    });
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

// Complete the sale
async function completeSale() {
    if (currentSaleItems.length === 0) {
        showToast('Please add items to the sale', 'warning');
        return;
    }
    
    const paymentMethod = document.getElementById('salePaymentMethod')?.value || 'cash';
    const customerName = document.getElementById('saleCustomerName')?.value || '';
    const notes = document.getElementById('saleNotes')?.value || '';
    
    try {
        const customerInfo = customerName ? { name: customerName } : null;
        
        // Map sale items and validate productIds
        const saleItems = currentSaleItems.map(item => {
            if (!item.productId) {
                console.error('Sale item missing productId:', item);
                throw new Error(`Product ID is missing for item: ${item.name}`);
            }
            return {
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice
            };
        });
        
        console.log('Completing sale with items:', saleItems);
        
        // Play notification sound before completing sale
        if (window.soundManager) {
            try {
                window.soundManager.playNotification();
            } catch (error) {
                // Ignore sound errors
            }
        }
        
        const result = await sales.create({
            items: saleItems,
            paymentMethod,
            customerInfo,
            notes
        });
        
        if (result && result.success) {
            showToast('Sale recorded successfully!', 'success');
            
            // Clear current sale
            currentSaleItems = [];
            updateSaleItemsList();
            resetSaleForm();
            
            // Reload today's sales
            await loadTodaysSales();
            
            // Refresh product dropdown (stock may have changed)
            await populateProductDropdown();
            
            // Refresh products page if it's loaded
            if (typeof window.loadProducts === 'function') {
                try {
                    await window.loadProducts();
                } catch (e) {
                    console.warn('Could not refresh products:', e);
                }
            }
            
            // Refresh dashboard if it's loaded (force refresh to bypass cache)
            if (typeof window.refreshDashboard === 'function') {
                try {
                    await window.refreshDashboard(true); // Force refresh to get updated sales data
                } catch (e) {
                    console.warn('Could not refresh dashboard:', e);
                }
            }
        } else {
            throw new Error(result?.error || 'Failed to record sale');
        }
    } catch (error) {
        console.error('Error completing sale:', error);
        showToast(error.message || 'Failed to record sale', 'danger');
    }
}

// Render sales table
function renderSalesTable(sales) {
    const tbody = document.getElementById('salesTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    let totalSales = 0;
    
    // Ensure sales is an array
    const salesArray = Array.isArray(sales) ? sales : (sales?.data || []);
    
    if (salesArray.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No sales found</td></tr>';
        const totalEl = document.getElementById('salesTotal');
        if (totalEl) totalEl.textContent = 'GH₵ 0.00';
        return;
    }
    
    salesArray.forEach(sale => {
        // Handle different sale data structures
        const saleDate = sale.sale_date || sale.saleDate || sale.date || sale.created_at || new Date().toISOString();
        const totalAmount = parseFloat(sale.total_amount || sale.total || 0);
        totalSales += totalAmount;
        
        // Get sale items if available - check for sale_items array
        let itemsCount = 0;
        let productNames = [];
        let unitPrice = 0;
        
        if (sale.items && Array.isArray(sale.items)) {
            itemsCount = sale.items.length;
            productNames = sale.items.map(item => item.product_name || item.name || 'Unknown').join(', ');
            if (sale.items.length > 0) {
                unitPrice = parseFloat(sale.items[0].unit_price || sale.items[0].unitPrice || 0);
            }
        } else if (sale.sale_items && Array.isArray(sale.sale_items)) {
            itemsCount = sale.sale_items.length;
            productNames = sale.sale_items.map(item => item.product_name || item.name || 'Unknown').join(', ');
            if (sale.sale_items.length > 0) {
                unitPrice = parseFloat(sale.sale_items[0].unit_price || sale.sale_items[0].unitPrice || 0);
            }
        } else if (sale.product_name) {
            itemsCount = 1;
            productNames = sale.product_name;
            unitPrice = parseFloat(sale.unit_price || sale.unitPrice || 0);
        }
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${new Date(saleDate).toLocaleString()}</td>
            <td>${productNames || 'N/A'}</td>
            <td class="text-end">${itemsCount}</td>
            <td class="text-end">GH₵${unitPrice.toFixed(2)}</td>
            <td class="text-end">GH₵${totalAmount.toFixed(2)}</td>
        `;
        tbody.appendChild(row);
    });
    
    // Update total
    const totalEl = document.getElementById('salesTotal');
    if (totalEl) {
        totalEl.textContent = `GH₵ ${totalSales.toFixed(2)}`;
    }
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
                <td>${item.name}</td>
                <td>${item.quantity}</td>
                <td>GH₵${item.unitPrice.toFixed(2)}</td>
                <td>GH₵${item.total.toFixed(2)}</td>
            </tr>
        `;
    });
    
    // Calculate total
    const grandTotal = currentSaleItems.reduce((sum, item) => sum + item.total, 0);
    
    // Add total and footer
    receiptHtml += `
                </table>
                <div class="total">
                    Total: GH₵${grandTotal.toFixed(2)}
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
window.completeSale = completeSale;
window.loadTodaysSales = loadTodaysSales;
window.loadSalesByDateRange = loadSalesByDateRange;
window.viewSaleDetails = viewSaleDetails;
window.printReceipt = printReceipt;

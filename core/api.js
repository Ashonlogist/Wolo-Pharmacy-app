// API module for handling IPC communications with the main process
// This file contains no development fallbacks or browser shims. IPC calls require
// the preload to expose `window.electron.ipcRenderer` (Electron environment).

/**
 * Check if the Electron API is available
 * @returns {boolean}
 */
function isElectronAvailable() {
    return !!(window.electron && window.electron.ipcRenderer);
}

/**
 * Make an IPC call to the main process
 * - Channels starting with 'get-' will use invoke and return a value.
 * - Other channels will use send and return a simple success object.
 * @param {string} channel
 * @param {any} [data]
 * @returns {Promise<any>} Response from main process or rejection if unavailable
 */
export async function ipcCall(channel, data = {}) {
    if (!isElectronAvailable()) {
        const msg = `Electron API not available. Cannot perform IPC call: ${channel}`;
        console.error(msg);
        return Promise.reject(new Error(msg));
    }

    try {
        console.log(`[ipcCall] Sending request to channel: ${channel}`, data);
        
        // Always use invoke for all operations that need a response
        if (typeof window.electron.ipcRenderer.invoke === 'function') {
            const result = await window.electron.ipcRenderer.invoke(channel, data);
            console.log(`[ipcCall] Received response from ${channel}:`, result);
            return result;
        }

        // Fallback to send if invoke is not available (shouldn't happen in modern Electron)
        return new Promise((resolve) => {
            window.electron.ipcRenderer.send(channel, data);
            resolve({ success: true });
        });
    } catch (err) {
        console.error(`IPC Error (${channel}):`, err);
        return { 
            success: false, 
            error: err.message || 'An unknown error occurred',
            details: process.env.NODE_ENV === 'development' ? err.stack : undefined
        };
    }
}

// Exported API objects (all delegate to ipcCall)
const products = {
    getAll: async () => await ipcCall('get-products'),
    getById: async (id) => {
        const response = await ipcCall('get-product', id);
        // Handle response format - return data directly if wrapped
        return response?.data || response;
    },
    create: async (product) => {
        try {
            console.log('Creating product with data:', product);
            const response = await ipcCall('add-product', product);
            console.log('Create product response:', response);
            
            if (!response) {
                throw new Error('No response from server');
            }
            
            if (!response.success) {
                const errorMessage = response.error || 'Failed to create product';
                console.error('Product creation failed:', errorMessage);
                throw new Error(errorMessage);
            }
            
            return {
                success: true,
                id: response.id || response.productId,
                ...response
            };
        } catch (error) {
            console.error('Error in products.create:', error);
            return {
                success: false,
                error: error.message || 'Failed to create product',
                details: error.details
            };
        }
    },
    update: async (id, updates) => {
        const response = await ipcCall('update-product', { id, updates });
        return response?.success ? response : { success: false, error: response?.error || 'Update failed' };
    },
    delete: async (id) => {
        const response = await ipcCall('delete-product', id);
        // Handle both response formats
        if (response?.success !== undefined) {
            return response;
        }
        // If response is just success/error, wrap it
        return { success: !!response, error: response?.error };
    },
    // search implemented client-side by filtering getAll results
    search: async (query) => {
        const all = await ipcCall('get-products');
        return all.filter(p => (p.name || '').toLowerCase().includes((query||'').toLowerCase()));
    },
    exportToExcel: async (params) => await ipcCall('export-sales-excel', params)
};

const sales = {
    // Use get-sales-history/get-sales-by-date-range handlers from main
    getAll: async () => await ipcCall('get-sales-history', {}),
    getById: async (id) => {
        const results = await ipcCall('get-sales-history', { productId: id });
        return results.find(r => r.id === id) || null;
    },
    create: async (sale) => await ipcCall('record-sale', sale),
    getByDateRange: async (startDate, endDate) => await ipcCall('get-sales-by-date-range', { startDate, endDate }),
    getTodaySales: async () => {
        const today = new Date().toISOString().split('T')[0];
        return await ipcCall('get-sales-by-date-range', { startDate: today, endDate: today });
    }
};

const reports = {
    generateSalesReport: async (params) => await ipcCall('get-sales-by-date-range', params),
    getSalesReport: async (params) => {
        const response = await ipcCall('get-sales-by-date-range', params);
        return Array.isArray(response) ? response : (response?.data || []);
    },
    getInventoryReport: async ({ category } = {}) => {
        const response = await ipcCall('get-products');
        let products = Array.isArray(response) ? response : (response?.data || []);
        
        // Filter by category if provided
        if (category) {
            products = products.filter(p => {
                const prodCategory = p.category || '';
                return prodCategory.toLowerCase().replace(/\s+/g, '-') === category.toLowerCase();
            });
        }
        
        return products;
    },
    getLowStockReport: async ({ threshold = 10, category } = {}) => {
        const response = await ipcCall('get-low-stock-items', { threshold });
        let items = Array.isArray(response) ? response : (response?.data || []);
        
        // Filter by category if provided
        if (category) {
            items = items.filter(p => {
                const prodCategory = p.category || '';
                return prodCategory.toLowerCase().replace(/\s+/g, '-') === category.toLowerCase();
            });
        }
        
        return items;
    },
    getExpiringProducts: async ({ startDate, endDate, category } = {}) => {
        const response = await ipcCall('get-products');
        let products = Array.isArray(response) ? response : (response?.data || []);
        
        // Filter by category if provided
        if (category) {
            products = products.filter(p => {
                const prodCategory = p.category || '';
                return prodCategory.toLowerCase().replace(/\s+/g, '-') === category.toLowerCase();
            });
        }
        
        // Filter by expiry date range
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const end = endDate ? new Date(endDate) : new Date();
        end.setHours(23, 59, 59, 999);
        
        return products.filter(p => {
            const expiryDate = p.expiry_date || p.expiryDate;
            if (!expiryDate) return false;
            
            try {
                const expiry = new Date(expiryDate);
                expiry.setHours(0, 0, 0, 0);
                return expiry >= today && expiry <= end;
            } catch (e) {
                return false;
            }
        });
    },
    getLowStockItems: async (threshold = 10) => await ipcCall('get-low-stock-items', { threshold }),
    exportSalesToExcel: async (params) => await ipcCall('export-sales-excel', params)
};

const settings = {
    // Get a single setting by key
    get: async (key) => {
        try {
            if (!key) {
                console.warn('No key provided to settings.get');
                return { success: false, error: 'Key is required' };
            }
            return await ipcCall('get-setting', { key });
        } catch (error) {
            console.error('Error in settings.get:', error);
            return { success: false, error: error.message };
        }
    },

    // Save a setting
    save: async (key, value) => {
        try {
            if (!key) {
                console.warn('No key provided to settings.save');
                return { success: false, error: 'Key is required' };
            }
            return await ipcCall('set-setting', { key, value: String(value) });
        } catch (error) {
            console.error('Error in settings.save:', error);
            return { success: false, error: error.message };
        }
    },

    backup: async () => await ipcCall('create-backup'),
    restore: async (backupPath) => await ipcCall('restore-backup', { backupPath }),
    testEmail: async () => {
        // Placeholder for test email functionality
        return { success: false, error: 'Test email functionality not yet implemented' };
    },
    
    // Developer mode helpers
    isDeveloperMode: async () => {
        try {
            const result = await ipcCall('get-setting', { key: 'developer_mode' });
            return result.success && result.value === 'true';
        } catch (error) {
            console.error('Error checking developer mode:', error);
            return false;
        }
    }
};

const system = {
    checkForUpdates: async () => await ipcCall('check-for-updates'),
    installUpdate: async () => await ipcCall('install-update'),
    getAppVersion: async () => await ipcCall('get-app-version')
};

const categories = {
    /**
     * Get all categories
     * @returns {Promise<Array>} List of categories
     */
    getAll: async () => {
        try {
            const result = await ipcCall('get-categories');
            return result.success ? result.data : [];
        } catch (error) {
            console.error('Error fetching categories:', error);
            return [];
        }
    },
    
    /**
     * Create a new category
     * @param {Object} category - Category data
     * @returns {Promise<Object>} Created category or error
     */
    create: async (category) => {
        try {
            return await ipcCall('create-category', category);
        } catch (error) {
            console.error('Error creating category:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Update a category
     * @param {string} id - Category ID
     * @param {Object} updates - Category updates
     * @returns {Promise<Object>} Update result
     */
    update: async (id, updates) => {
        try {
            return await ipcCall('update-category', { id, ...updates });
        } catch (error) {
            console.error('Error updating category:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Delete a category
     * @param {string} id - Category ID
     * @returns {Promise<Object>} Delete result
     */
    delete: async (id) => {
        try {
            return await ipcCall('delete-category', { id });
        } catch (error) {
            console.error('Error deleting category:', error);
            return { success: false, error: error.message };
        }
    }
};

const suppliers = {
    /**
     * Get all suppliers
     * @returns {Promise<Array>} List of suppliers
     */
    getAll: async () => {
        try {
            const result = await ipcCall('get-suppliers');
            return result.success ? result.data : [];
        } catch (error) {
            console.error('Error fetching suppliers:', error);
            return [];
        }
    },
    
    /**
     * Create a new supplier
     * @param {Object} supplier - Supplier data
     * @returns {Promise<Object>} Created supplier or error
     */
    create: async (supplier) => {
        try {
            return await ipcCall('create-supplier', supplier);
        } catch (error) {
            console.error('Error creating supplier:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Update a supplier
     * @param {string} id - Supplier ID
     * @param {Object} updates - Supplier updates
     * @returns {Promise<Object>} Update result
     */
    update: async (id, updates) => {
        try {
            return await ipcCall('update-supplier', { id, ...updates });
        } catch (error) {
            console.error('Error updating supplier:', error);
            return { success: false, error: error.message };
        }
    },
    
    /**
     * Delete a supplier
     * @param {string} id - Supplier ID
     * @returns {Promise<Object>} Delete result
     */
    delete: async (id) => {
        try {
            return await ipcCall('delete-supplier', { id });
        } catch (error) {
            console.error('Error deleting supplier:', error);
            return { success: false, error: error.message };
        }
    }
};

export {
    products,
    sales,
    reports,
    settings,
    system,
    categories,
    suppliers,
    isElectronAvailable
};

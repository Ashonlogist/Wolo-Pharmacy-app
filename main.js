// Set production environment
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = process.defaultApp ? 'development' : 'production';
}

// Import Electron and other modules
const electron = require('electron');
const { app, BrowserWindow, ipcMain, dialog, session } = electron;
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const ExcelJS = require('exceljs');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');

// Global variables
let mainWindow = null;
let db = null;
let cachePath = null;

// Production optimizations
const isDev = process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

// Helper function to get correct paths in both dev and production
function getResourcePath(relativePath) {
  // In production, app is packaged in an ASAR archive
  if (app.isPackaged) {
    // For resources, check if they're in extraResources first
    const resourcePath = path.join(process.resourcesPath, relativePath);
    if (fs.existsSync(resourcePath)) {
      return resourcePath;
    }
    // Otherwise, use app path (for files in ASAR)
    return path.join(app.getAppPath(), relativePath);
  }
  // In development, use __dirname
  return path.join(__dirname, relativePath);
}

// IPC handlers will be registered after database initialization
let ipcHandlersInitialized = false;

// Ensure app is available
if (!app) {
  console.error('Electron app module is not available');
  process.exit(1);
}

function registerIpcHandlers() {
  // Prevent duplicate registrations
  if (ipcHandlersInitialized) {
    console.log('IPC handlers already registered, skipping...');
    return;
  }
  
  console.log('Starting IPC handler registration...');
  
  // Handle splash screen completion
  ipcMain.on('splash-complete', (event) => {
    console.log('Splash screen completed, showing main window');
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.focus();
    }
    // Close the splash window
    const splashWindow = BrowserWindow.fromWebContents(event.sender);
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
    }
  });
  
  // Add save dialog handler
  ipcMain.handle('show-save-dialog', async (event, options) => {
    try {
      const result = await dialog.showSaveDialog(mainWindow, options);
      return result;
    } catch (error) {
      console.error('Error in show-save-dialog:', error);
      throw error;
    }
  });
  
  console.log('Registering IPC handlers...');
  
  // Supplier Related Handlers
  ipcMain.handle('get-suppliers', async () => {
    const dbPath = path.join(app.getPath('userData'), 'wolo-inventory.db');
    const db = new Database(dbPath);
    try {
      // First check if suppliers table exists
      const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='suppliers'").get();
      
      if (!tableExists) {
        // Create suppliers table if it doesn't exist
        db.prepare(`
          CREATE TABLE IF NOT EXISTS suppliers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            contact_person TEXT,
            email TEXT,
            phone TEXT,
            address TEXT,
            tax_id TEXT,
            payment_terms TEXT,
            notes TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            is_active INTEGER DEFAULT 1
          )
        `).run();
        
        return { success: true, data: [] }; // Return empty array for new table
      }
      
      const suppliers = db.prepare(`
        SELECT id, name, contact_person, email, phone, address, 
               tax_id, payment_terms, notes, 
               strftime('%Y-%m-%dT%H:%M:%S.%fZ', created_at) as created_at,
               strftime('%Y-%m-%dT%H:%M:%S.%fZ', updated_at) as updated_at,
               is_active
        FROM suppliers
        WHERE is_active = 1
        ORDER BY name ASC
      `).all();
      
      return { success: true, data: suppliers };
    } catch (error) {
      console.error('Error in get-suppliers:', error);
      return { 
        success: false, 
        error: 'Failed to fetch suppliers',
        details: error.message 
      };
    } finally {
      if (db) db.close();
    }
  });

  // Create supplier handler
  ipcMain.handle('create-supplier', async (event, supplierData) => {
    try {
      const supplierId = supplierData.id || uuidv4();
      const now = new Date().toISOString();
      
      db.prepare(`
        INSERT INTO suppliers (id, name, contact_person, email, phone, address, 
                              tax_id, payment_terms, notes, created_at, updated_at, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        supplierId,
        supplierData.name,
        supplierData.contact_person || null,
        supplierData.email || null,
        supplierData.phone || null,
        supplierData.address || null,
        supplierData.tax_id || null,
        supplierData.payment_terms || null,
        supplierData.notes || null,
        now,
        now,
        supplierData.is_active !== undefined ? supplierData.is_active : 1
      );
      
      return { success: true, id: supplierId };
    } catch (error) {
      console.error('Error creating supplier:', error);
      return { success: false, error: error.message || 'Failed to create supplier' };
    }
  });

  // Update supplier handler
  ipcMain.handle('update-supplier', async (event, { id, ...updates }) => {
    try {
      const now = new Date().toISOString();
      const fields = [];
      const values = [];
      
      Object.keys(updates).forEach(key => {
        if (updates[key] !== undefined) {
          fields.push(`${key} = ?`);
          values.push(updates[key]);
        }
      });
      
      if (fields.length === 0) {
        return { success: false, error: 'No fields to update' };
      }
      
      fields.push('updated_at = ?');
      values.push(now);
      values.push(id);
      
      db.prepare(`
        UPDATE suppliers 
        SET ${fields.join(', ')}
        WHERE id = ?
      `).run(...values);
      
      return { success: true };
    } catch (error) {
      console.error('Error updating supplier:', error);
      return { success: false, error: error.message || 'Failed to update supplier' };
    }
  });

  // Delete supplier handler (soft delete by setting is_active = 0)
  ipcMain.handle('delete-supplier', async (event, { id }) => {
    try {
      const now = new Date().toISOString();
      db.prepare(`
        UPDATE suppliers 
        SET is_active = 0, updated_at = ?
        WHERE id = ?
      `).run(now, id);
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting supplier:', error);
      return { success: false, error: error.message || 'Failed to delete supplier' };
    }
  });

  // Product Related Handlers
  ipcMain.handle('get-products', async () => {
    const db = new Database(path.join(app.getPath('userData'), 'wolo-inventory.db'));
    try {
      // Check if products table exists
      const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='products'").get();
      
      if (!tableExists) {
        // Create products table if it doesn't exist
        db.exec(`
          CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            barcode TEXT UNIQUE,
            sku TEXT UNIQUE,
            category TEXT,
            category_id TEXT,
            quantity_in_stock INTEGER NOT NULL DEFAULT 0,
            quantity_on_shelf INTEGER NOT NULL DEFAULT 0,
            quantity_purchased INTEGER NOT NULL DEFAULT 0,
            cost_price REAL NOT NULL DEFAULT 0,
            total_bulk_cost REAL NOT NULL DEFAULT 0,
            selling_price REAL NOT NULL DEFAULT 0,
            wholesale_price REAL,
            profit_margin REAL DEFAULT 0,
            reorder_level INTEGER DEFAULT 10,
            low_stock_threshold INTEGER DEFAULT 5,
            tax_rate REAL DEFAULT 0,
            supplier_id TEXT,
            supplier_name TEXT,
            supplier_contact TEXT,
            manufacturer TEXT,
            brand TEXT,
            unit_of_measure TEXT,
            weight REAL,
            dimensions TEXT,
            location TEXT,
            notes TEXT,
            images TEXT,
            variants TEXT,
            manufactured_date TEXT,
            expiry_date TEXT,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          )
        `);
        return [];
      }
      
      const products = db.prepare(`
        SELECT * FROM products 
        WHERE is_active = 1 
        ORDER BY name ASC
      `).all();
      
      return products.map(p => ({
        ...p,
        images: p.images ? JSON.parse(p.images) : [],
        variants: p.variants ? JSON.parse(p.variants) : []
      }));
    } catch (error) {
      console.error('Error fetching products:', error);
      throw error;
    } finally {
      if (db) db.close();
    }
  });
  
  // Add new product
  ipcMain.handle('add-product', async (event, productData) => {
    const db = new Database(path.join(app.getPath('userData'), 'wolo-inventory.db'));
    const now = new Date().toISOString();
    
    try {
      // Generate a new ID if not provided
      if (!productData.id) {
        productData.id = uuidv4();
      }
      
      // Set timestamps
      productData.created_at = now;
      productData.updated_at = now;
      
      // Ensure required fields have default values
      productData.is_active = productData.is_active !== undefined ? productData.is_active : 1;
      productData.quantity_in_stock = productData.quantity_in_stock || 0;
      productData.quantity_on_shelf = productData.quantity_on_shelf || 0;
      productData.cost_price = productData.cost_price || 0;
      productData.selling_price = productData.selling_price || 0;
      
      // Handle JSON fields
      if (productData.images && Array.isArray(productData.images)) {
        productData.images = JSON.stringify(productData.images);
      }
      
      if (productData.variants && Array.isArray(productData.variants)) {
        productData.variants = JSON.stringify(productData.variants);
      }
      
      // Prepare SQL and parameters
      const columns = Object.keys(productData).join(', ');
      const placeholders = Object.keys(productData).map(() => '?').join(', ');
      const values = Object.values(productData);
      
      const sql = `INSERT INTO products (${columns}) VALUES (${placeholders})`;
      
      // Execute the query
      const result = db.prepare(sql).run(...values);
      
      return {
        success: true,
        id: productData.id,
        message: 'Product created successfully'
      };
    } catch (error) {
      console.error('Error adding product:', error);
      return {
        success: false,
        error: error.message || 'Failed to add product',
        details: error
      };
    } finally {
      if (db) db.close();
    }
  });
  
  // Import products (bulk)
  ipcMain.handle('import-products', async (event, productsArray) => {
    const db = new Database(path.join(app.getPath('userData'), 'wolo-inventory.db'));
    const now = new Date().toISOString();
    
    try {
      if (!Array.isArray(productsArray) || productsArray.length === 0) {
        return {
          success: false,
          error: 'No products provided for import',
          insertedCount: 0
        };
      }
      
      let insertedCount = 0;
      let skippedCount = 0;
      const errors = [];
      
      // Start transaction for bulk insert
      db.exec('BEGIN TRANSACTION');
      
      try {
        for (let i = 0; i < productsArray.length; i++) {
          const productData = productsArray[i];
          
          try {
            // Generate ID if not provided
            if (!productData.id) {
              productData.id = uuidv4();
            }
            
            // Set timestamps
            productData.created_at = now;
            productData.updated_at = now;
            
            // Ensure required fields
            productData.is_active = productData.is_active !== undefined ? productData.is_active : 1;
            productData.quantity_in_stock = productData.quantity_in_stock || productData.quantityInStock || 0;
            productData.quantity_on_shelf = productData.quantity_on_shelf || productData.quantityOnShelf || 0;
            productData.cost_price = productData.cost_price || productData.costPrice || productData.purchasePrice || 0;
            productData.selling_price = productData.selling_price || productData.sellingPrice || 0;
            productData.total_bulk_cost = productData.total_bulk_cost || productData.totalBulkCost || (productData.cost_price * productData.quantity_in_stock);
            productData.quantity_purchased = productData.quantity_purchased || productData.quantityPurchased || productData.quantity_in_stock;
            
            // Map field names (handle both snake_case and camelCase)
            const mappedData = {
              id: productData.id,
              name: productData.name || '',
              description: productData.description || '',
              barcode: productData.barcode || null,
              category: productData.category || productData.productCategory || '',
              sku: productData.sku || null,
              quantity_in_stock: parseInt(productData.quantity_in_stock || 0),
              quantity_on_shelf: parseInt(productData.quantity_on_shelf || 0),
              quantity_purchased: parseInt(productData.quantity_purchased || 0),
              cost_price: parseFloat(productData.cost_price || 0),
              total_bulk_cost: parseFloat(productData.total_bulk_cost || 0),
              selling_price: parseFloat(productData.selling_price || 0),
              profit_margin: parseFloat(productData.profit_margin || productData.profitMargin || 0),
              reorder_level: parseInt(productData.reorder_level || productData.reorderLevel || 10),
              expiry_date: productData.expiry_date || productData.expiryDate || null,
              manufactured_date: productData.manufactured_date || productData.manufacturedDate || null,
              supplier_name: productData.supplier_name || productData.supplier || '',
              supplier_contact: productData.supplier_contact || '',
              notes: productData.notes || '',
              is_active: 1,
              created_at: now,
              updated_at: now
            };
            
            // Validate required fields
            if (!mappedData.name || mappedData.name.trim() === '') {
              errors.push(`Row ${i + 1}: Product name is required`);
              skippedCount++;
              continue;
            }
            
            // Check for duplicate barcode if provided
            if (mappedData.barcode) {
              const existing = db.prepare('SELECT id FROM products WHERE barcode = ? AND is_active = 1').get(mappedData.barcode);
              if (existing) {
                errors.push(`Row ${i + 1}: Product with barcode ${mappedData.barcode} already exists`);
                skippedCount++;
                continue;
              }
            }
            
            // Prepare SQL
            const columns = Object.keys(mappedData).join(', ');
            const placeholders = Object.keys(mappedData).map(() => '?').join(', ');
            const values = Object.values(mappedData);
            
            const sql = `INSERT INTO products (${columns}) VALUES (${placeholders})`;
            db.prepare(sql).run(...values);
            insertedCount++;
            
          } catch (error) {
            errors.push(`Row ${i + 1}: ${error.message}`);
            skippedCount++;
            console.error(`Error importing product at row ${i + 1}:`, error);
          }
        }
        
        // Commit transaction
        db.exec('COMMIT');
        
        return {
          success: true,
          insertedCount,
          skippedCount,
          errors: errors.length > 0 ? errors : undefined,
          message: `Successfully imported ${insertedCount} product(s)${skippedCount > 0 ? `, skipped ${skippedCount}` : ''}`
        };
        
      } catch (error) {
        // Rollback on error
        db.exec('ROLLBACK');
        throw error;
      }
      
    } catch (error) {
      console.error('Error importing products:', error);
      return {
        success: false,
        error: error.message || 'Failed to import products',
        insertedCount: 0
      };
    } finally {
      if (db) db.close();
    }
  });
  
  // Update product
  ipcMain.handle('update-product', async (event, { id, updates }) => {
    const db = new Database(path.join(app.getPath('userData'), 'wolo-inventory.db'));
    
    try {
      if (!id) {
        throw new Error('Product ID is required for update');
      }
      
      // Add updated_at timestamp
      updates.updated_at = new Date().toISOString();
      
      // Handle JSON fields
      if (updates.images && Array.isArray(updates.images)) {
        updates.images = JSON.stringify(updates.images);
      }
      
      if (updates.variants && Array.isArray(updates.variants)) {
        updates.variants = JSON.stringify(updates.variants);
      }
      
      // Prepare SET clause
      const setClause = Object.keys(updates)
        .map(key => `${key} = ?`)
        .join(', ');
      
      const values = [...Object.values(updates), id];
      
      const sql = `UPDATE products SET ${setClause} WHERE id = ?`;
      
      // Execute the query
      const result = db.prepare(sql).run(...values);
      
      if (result.changes === 0) {
        throw new Error('Product not found or no changes made');
      }
      
      return {
        success: true,
        message: 'Product updated successfully'
      };
    } catch (error) {
      console.error('Error updating product:', error);
      return {
        success: false,
        error: error.message || 'Failed to update product',
        details: error
      };
    } finally {
      if (db) db.close();
    }
  });
  
  // Delete product (soft delete)
  ipcMain.handle('delete-product', async (event, id) => {
    const db = new Database(path.join(app.getPath('userData'), 'wolo-inventory.db'));
    
    try {
      if (!id) {
        throw new Error('Product ID is required for deletion');
      }
      
      // Soft delete by setting is_active = 0
      const sql = 'UPDATE products SET is_active = 0, updated_at = ? WHERE id = ?';
      const result = db.prepare(sql).run(new Date().toISOString(), id);
      
      if (result.changes === 0) {
        throw new Error('Product not found');
      }
      
      return {
        success: true,
        message: 'Product deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting product:', error);
      return {
        success: false,
        error: error.message || 'Failed to delete product',
        details: error
      };
    } finally {
      if (db) db.close();
    }
  });
  
  // Get single product by ID
  ipcMain.handle('get-product', async (event, id) => {
    const db = new Database(path.join(app.getPath('userData'), 'wolo-inventory.db'));
    
    try {
      const product = db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(id);
      
      if (!product) {
        return { success: false, error: 'Product not found' };
      }
      
      // Parse JSON fields
      if (product.images) product.images = JSON.parse(product.images);
      if (product.variants) product.variants = JSON.parse(product.variants);
      
      return { 
        success: true, 
        data: product 
      };
    } catch (error) {
      console.error('Error fetching product:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch product',
        details: error
      };
    } finally {
      if (db) db.close();
    }
  });

  // Settings Handlers (get-setting and set-setting handlers are defined later in registerIpcHandlers)
  // Sales Handlers (get-sales-by-date-range handler is defined later in registerIpcHandlers)
  ipcMain.handle('get-low-stock-items', async (event, { threshold = 10 } = {}) => {
    try {
      const items = db.prepare('SELECT * FROM products WHERE quantity_in_stock <= ? AND is_active = 1 ORDER BY quantity_in_stock ASC').all(threshold);
      return items;
    } catch (error) {
      console.error('Error fetching low stock items:', error);
      throw error;
    }
  });

  ipcMain.handle('get-categories', async () => {
    try {
      if (!db) {
        return { success: false, data: [], error: 'Database not initialized' };
      }
      // Extract unique categories from products
      const products = db.prepare('SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != ? AND category != ?').all('', null);
      const categories = products.map(p => ({ id: p.category.toLowerCase().replace(/\s+/g, '-'), name: p.category }));
      return { success: true, data: categories };
    } catch (error) {
      console.error('Error fetching categories:', error);
      return { success: false, data: [], error: error.message };
    }
  });

  // Create category handler (categories are stored in products, so this is a helper)
  ipcMain.handle('create-category', async (event, categoryData) => {
    try {
      // Categories are stored in products table, so we just return success
      // The category will be created when a product uses it
      return { success: true, id: categoryData.name?.toLowerCase().replace(/\s+/g, '-'), name: categoryData.name };
    } catch (error) {
      console.error('Error creating category:', error);
      return { success: false, error: error.message || 'Failed to create category' };
    }
  });

  // Update category handler (updates all products with old category name)
  ipcMain.handle('update-category', async (event, { id, name }) => {
    try {
      // Find old category name from products
      const oldCategory = db.prepare('SELECT DISTINCT category FROM products WHERE category IS NOT NULL LIMIT 1').get();
      if (oldCategory && name) {
        db.prepare('UPDATE products SET category = ? WHERE category = ?').run(name, oldCategory.category);
      }
      return { success: true };
    } catch (error) {
      console.error('Error updating category:', error);
      return { success: false, error: error.message || 'Failed to update category' };
    }
  });

  // Delete category handler (removes category from all products)
  ipcMain.handle('delete-category', async (event, { id }) => {
    try {
      // Find category name and remove it from products
      const category = db.prepare('SELECT DISTINCT category FROM products WHERE category IS NOT NULL LIMIT 1').get();
      if (category) {
        db.prepare('UPDATE products SET category = NULL WHERE category = ?').run(category.category);
      }
      return { success: true };
    } catch (error) {
      console.error('Error deleting category:', error);
      return { success: false, error: error.message || 'Failed to delete category' };
    }
  });

  // Reset all data handler - clears all tables
  ipcMain.handle('reset-all-data', async (event) => {
    try {
      console.log('Resetting all data...');
      
      // Start a transaction
      db.exec('BEGIN TRANSACTION');
      
      try {
        // Delete all data from all tables (in order to respect foreign keys)
        // Use try-catch for each delete in case table doesn't exist
        try {
          db.prepare('DELETE FROM sale_items').run();
        } catch (e) {
          console.warn('sale_items table may not exist:', e.message);
        }
        
        try {
          db.prepare('DELETE FROM sales').run();
        } catch (e) {
          console.warn('sales table may not exist:', e.message);
        }
        
        try {
          db.prepare('DELETE FROM products').run();
        } catch (e) {
          console.warn('products table may not exist:', e.message);
        }
        
        try {
          db.prepare('DELETE FROM suppliers').run();
        } catch (e) {
          console.warn('suppliers table may not exist:', e.message);
        }
        
        // Only delete settings that are not user_name (preserve user name)
        try {
          db.prepare('DELETE FROM settings WHERE key != ?').run('user_name');
        } catch (e) {
          console.warn('settings table may not exist:', e.message);
        }
        
        // Reset auto-increment sequences (SQLite uses sqlite_sequence table)
        // Check if sqlite_sequence table exists first
        try {
          const sequenceCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sqlite_sequence'").get();
          if (sequenceCheck) {
            db.prepare('DELETE FROM sqlite_sequence WHERE name IN ("products", "sales", "sale_items", "suppliers")').run();
          }
        } catch (e) {
          // sqlite_sequence table doesn't exist or error - this is fine, just log it
          console.log('sqlite_sequence table does not exist or error accessing it:', e.message);
        }
        
        // Commit the transaction
        db.exec('COMMIT');
        
        console.log('All data reset successfully');
        return { success: true, message: 'All data has been reset successfully' };
      } catch (error) {
        // Rollback on error
        try {
          db.exec('ROLLBACK');
        } catch (rollbackError) {
          console.error('Error during rollback:', rollbackError);
        }
        throw error;
      }
    } catch (error) {
      console.error('Error resetting all data:', error);
      return { success: false, error: error.message || 'Failed to reset all data' };
    }
  });

  ipcMain.handle('check-duplicate-product', async (event, { id, name, barcode }) => {
    try {
      if (name) {
        const nameCheck = db.prepare(`
          SELECT id, name, 'name' as field 
          FROM products 
          WHERE LOWER(name) = LOWER(?) AND id != ?
          LIMIT 1
        `).get(name, id || '0');
        if (nameCheck) return nameCheck;
      }
      if (barcode) {
        const barcodeCheck = db.prepare(`
          SELECT id, barcode, 'barcode' as field 
          FROM products 
          WHERE barcode = ? AND id != ?
          LIMIT 1
        `).get(barcode, id || '0');
        if (barcodeCheck) return barcodeCheck;
      }
      return null;
    } catch (error) {
      console.error('Error checking for duplicate product:', error);
      throw error;
    }
  });

  // Export sales to Excel - using the correct channel name that matches the renderer
  console.log('Registering export-sales-excel IPC handler');
  ipcMain.handle('export-sales-excel', async (event, { startDate, endDate, category }) => {
    console.log('Export sales to Excel called with:', { startDate, endDate, category });
    
    // Verify database is connected
    if (!db) {
      const error = 'Database not initialized';
      console.error(error);
      throw new Error(error);
    }
    
    // Verify required tables exist
    try {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('sales', 'sale_items')").all();
      console.log('Found tables:', tables);
      
      if (!tables.some(t => t.name === 'sale_items')) {
        throw new Error('sale_items table does not exist in the database');
      }
    } catch (error) {
      console.error('Error checking database tables:', error);
      throw new Error('Database verification failed: ' + error.message);
    }
    
    try {
      // First, let's log the database file path and verify it exists
      const dbPath = path.join(app.getPath('userData'), 'wolo-inventory.db');
      console.log('Database path:', dbPath);
      console.log('Database file exists:', require('fs').existsSync(dbPath));
      
      // Log the SQLite version and database schema for debugging
      const dbVersion = db.prepare('SELECT sqlite_version() as version').get();
      console.log('SQLite version in export function:', dbVersion.version);
      
      // List all tables in the database
      const allTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      console.log('All tables in database:', allTables);
      
      // Check if invoice_number column exists using PRAGMA
      let hasInvoiceNumber = false;
      try {
        const columns = db.pragma('table_info(sales)');
        hasInvoiceNumber = columns.some(col => col.name === 'invoice_number');
        console.log('Sales table columns:', columns.map(c => c.name));
      } catch (e) {
        console.error('Error checking sales table schema:', e);
      }
      
      console.log('Has invoice_number column:', hasInvoiceNumber);
      
      // Build the query based on provided filters
      // First, create a subquery that handles the invoice_number safely
      let query = `
        WITH safe_sales AS (
          SELECT 
            id,
            sale_date,
            ${hasInvoiceNumber ? 'invoice_number' : "NULL as invoice_number"},
            COALESCE(customer_name, '') as customer_name,
            total_amount,
            COALESCE(payment_method, '') as payment_method,
            COALESCE(payment_status, '') as payment_status
          FROM sales
        )
        SELECT 
          s.id as sale_id,
          s.sale_date,
          COALESCE(s.invoice_number, '') as invoice_number,
          s.customer_name,
          s.total_amount,
          s.payment_method,
          s.payment_status,
          p.name as product_name,
          COALESCE(p.barcode, '') as barcode,
          si.quantity,
          si.unit_price,
          (si.quantity * si.unit_price) as subtotal
        FROM safe_sales s
        JOIN sale_items si ON s.id = si.sale_id
        JOIN products p ON si.product_id = p.id
        WHERE 1=1
      `;

      const params = [];
      
      if (startDate) {
        query += ' AND s.sale_date >= ?';
        params.push(startDate);
      }
      
      if (endDate) {
        query += ' AND s.sale_date <= ?';
        params.push(endDate);
      }
      
      if (category) {
        query += ' AND p.category = ?';
        params.push(category);
      }
      
      query += ' ORDER BY s.sale_date DESC, s.id';
      
      // Log the final query for debugging
      console.log('Export query:', query);
      console.log('Query parameters:', params);
      
      // Execute the query
      let salesData = [];
      try {
        salesData = db.prepare(query).all(...params);
        console.log(`Found ${salesData.length} sales records for export`);
      } catch (error) {
        console.warn('Error fetching sales data, will create empty report:', error.message);
        // Continue with empty data
      }
      
      // Create a new workbook and worksheet
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Sales Report');
      
      // Add headers
      worksheet.columns = [
        { header: 'Sale ID', key: 'sale_id', width: 10 },
        { header: 'Date', key: 'sale_date', width: 15 },
        { header: 'Invoice #', key: 'invoice_number', width: 15 },
        { header: 'Customer', key: 'customer_name', width: 20 },
        { header: 'Product', key: 'product_name', width: 30 },
        { header: 'Barcode', key: 'barcode', width: 15 },
        { header: 'Qty', key: 'quantity', width: 8 },
        { header: 'Unit Price', key: 'unit_price', width: 12, style: { numFmt: '0.00' } },
        { header: 'Subtotal', key: 'subtotal', width: 12, style: { numFmt: '0.00' } },
        { header: 'Payment Method', key: 'payment_method', width: 15 },
        { header: 'Status', key: 'payment_status', width: 12 }
      ];
      
      if (salesData.length === 0) {
        // Add a message when no data is found
        const messageRow = worksheet.addRow({});
        const messageCell = worksheet.addRow({ 
          sale_id: 'No sales data found matching the criteria' 
        }).getCell(1);
        
        // Merge cells for the message
        worksheet.mergeCells(`A${messageRow.number + 1}:K${messageRow.number + 1}`);
        
        // Style the message
        messageCell.alignment = { 
          horizontal: 'center',
          vertical: 'middle'
        };
        messageCell.font = { 
          bold: true,
          color: { argb: 'FFFF0000' },
          size: 14
        };
        
        // Add some spacing
        worksheet.addRow({});
        
        // Add instructions
        const instructions = [
          'To generate sales data:',
          '1. Make sure you have products in your inventory',
          '2. Process some sales through the POS system',
          '3. Try exporting again'
        ];
        
        instructions.forEach((text, index) => {
          const row = worksheet.addRow({ sale_id: text });
          if (index === 0) {
            row.font = { bold: true };
          }
        });
      } else {
        // Add data rows
        worksheet.addRows(salesData);
        
        // Format currency columns
        const currencyColumns = ['unit_price', 'subtotal'];
        currencyColumns.forEach(col => {
          const colIndex = worksheet.getColumn(col).number;
          worksheet.getColumn(colIndex).eachCell(cell => {
            if (cell.value) {
              cell.numFmt = '#,##0.00';
            }
          });
        });
        
        // Add a total row
        const totalRow = worksheet.addRow({
          sale_id: 'TOTAL',
          subtotal: { formula: `SUM(I2:I${worksheet.rowCount})` }
        });
        
        // Style the total row
        totalRow.font = { bold: true };
        totalRow.getCell('I').numFmt = '#,##0.00';
      }

      // Auto-fit columns
      worksheet.columns.forEach(column => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, cell => {
          const columnLength = cell.value ? cell.value.toString().length : 0;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = Math.min(Math.max(maxLength + 2, 10), 50);
      });
      
      // Generate a temporary file path for the Excel file
      const tempDir = app.getPath('temp');
      const exportPath = path.join(tempDir, `sales_export_${Date.now()}.xlsx`);
      
      try {
        // Save the workbook to a file
        await workbook.xlsx.writeFile(exportPath);
        console.log(`Export completed successfully. File saved to: ${exportPath}`);
        return { success: true, filePath: exportPath };
      } catch (error) {
        console.error('Error saving Excel file:', error);
        throw new Error(`Failed to save export file: ${error.message}`);
      }
      worksheet.columns.forEach(column => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, cell => {
          const columnLength = cell.value ? cell.value.toString().length : 0;
          maxLength = Math.max(maxLength, columnLength);
        });
        column.width = Math.min(Math.max(maxLength + 2, column.header.length) + 2, 30);
      });
      
      // Add a total row
      const totalRow = worksheet.rowCount + 1;
      worksheet.getCell(`A${totalRow}`).value = 'Total';
      worksheet.getCell(`I${totalRow}`).formula = `SUM(I2:I${totalRow - 1})`;
      worksheet.getCell(`I${totalRow}`).numFmt = '#,##0.00';
      
      // Style the total row
      worksheet.getRow(totalRow).font = { bold: true };
      
      // Get the user's documents folder
      const documentsPath = app.getPath('documents');
      const fileName = `Sales_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
      const filePath = path.join(documentsPath, 'Wolo_Exports', fileName);
      
      // Ensure the directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Save the workbook
      await workbook.xlsx.writeFile(filePath);
      
      // Open the file in the default application
      require('child_process').exec(`start "" "${filePath}"`);
      
      return { success: true, filePath };
      
    } catch (error) {
      console.error('Error exporting sales to Excel:', error);
      throw error;
    }
  });

  // Handle recording a new sale
  ipcMain.handle('record-sale', async (event, { items, paymentMethod, customerInfo, notes }) => {
    if (!db) {
      throw new Error('Database not initialized');
    }
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error('Sale must have at least one item');
    }
    
    const now = new Date().toISOString();
    const saleDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const saleId = `sale_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Start a transaction
      const transaction = db.transaction(() => {
        const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
        
        // Insert the sale record
        db.prepare(`
          INSERT INTO sales (id, invoice_number, sale_date, total_amount, payment_method, payment_status, customer_name, notes, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          saleId,
          `INV-${Date.now()}`,
          saleDate,
          totalAmount,
          paymentMethod || 'cash',
          'completed',
          customerInfo?.name || null,
          notes || null,
          now
        );

        // Insert sale items and update inventory
        items.forEach(item => {
          // Check if product exists and has enough stock
          const product = db.prepare('SELECT id, name, quantity_in_stock FROM products WHERE id = ?').get(item.productId);
          if (!product) {
            throw new Error(`Product with ID ${item.productId} not found`);
          }
          if (product.quantity_in_stock < item.quantity) {
            throw new Error(`Insufficient stock for product ${item.productId}. Available: ${product.quantity_in_stock}, Requested: ${item.quantity}`);
          }
          
          // Calculate subtotal
          const subtotal = item.quantity * item.unitPrice;
          const itemId = `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          // Insert sale item - use subtotal instead of total_price, and include all required fields
          db.prepare(`
            INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price, subtotal)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            itemId,
            saleId,
            item.productId,
            product.name || 'Unknown Product',
            item.quantity,
            item.unitPrice,
            subtotal
          );

          // Update product inventory
          db.prepare(`
            UPDATE products 
            SET quantity_in_stock = quantity_in_stock - ?,
                updated_at = ?
            WHERE id = ?
          `).run(item.quantity, now, item.productId);
        });
      });

      // Execute the transaction
      transaction();
      return { success: true, saleId };
    } catch (error) {
      console.error('Error recording sale:', error);
      throw error;
    }
  });

  ipcMain.handle('get-sales-history', async (event, { startDate, endDate, productId } = {}) => {
    try {
      let query = 'SELECT DISTINCT s.* FROM sales s';
      const params = [];
      const conditions = [];
      
      // If filtering by product, join through sale_items
      if (productId) {
        query += ' INNER JOIN sale_items si ON s.id = si.sale_id';
        conditions.push('si.product_id = ?');
        params.push(productId);
      }
      
      if (startDate) {
        conditions.push('s.sale_date >= ?');
        params.push(startDate);
      }
      if (endDate) {
        conditions.push('s.sale_date <= ?');
        params.push(endDate);
      }
      
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      query += ' ORDER BY s.sale_date DESC, s.created_at DESC';
      
      const sales = db.prepare(query).all(...params);
      
      // For each sale, get its items
      const salesWithItems = sales.map(sale => {
        const items = db.prepare(`
          SELECT si.*, p.name as product_name, p.barcode
          FROM sale_items si
          LEFT JOIN products p ON si.product_id = p.id
          WHERE si.sale_id = ?
        `).all(sale.id);
        
        return {
          ...sale,
          items: items,
          total_amount: parseFloat(sale.total_amount || 0)
        };
      });
      
      return salesWithItems;
    } catch (error) {
      console.error('Error fetching sales history:', error);
      throw error;
    }
  });

  // Add get-sales-by-date-range handler (alias of get-sales-history with product details)
  ipcMain.handle('get-sales-by-date-range', async (event, { startDate, endDate, productId } = {}) => {
    try {
      let query = `
        SELECT DISTINCT s.*
        FROM sales s
      `;
      
      const params = [];
      const conditions = [];
      
      // If filtering by product, join through sale_items
      if (productId) {
        query += ` INNER JOIN sale_items si ON s.id = si.sale_id `;
        conditions.push('si.product_id = ?');
        params.push(productId);
      }
      
      if (startDate) {
        conditions.push('s.sale_date >= ?');
        params.push(startDate);
      }
      
      if (endDate) {
        conditions.push('s.sale_date <= ?');
        params.push(endDate);
      }
      
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      
      query += ' ORDER BY s.sale_date DESC';
      
      const sales = db.prepare(query).all(...params);
      
      // If productId is specified, also get product details for each sale
      if (productId) {
        const salesWithItems = sales.map(sale => {
          const items = db.prepare(`
            SELECT si.*, p.name as product_name, p.barcode
            FROM sale_items si
            LEFT JOIN products p ON si.product_id = p.id
            WHERE si.sale_id = ? AND si.product_id = ?
          `).all(sale.id, productId);
          
          return {
            ...sale,
            total_amount: parseFloat(sale.total_amount || 0),
            items: items
          };
        });
        return salesWithItems;
      }
      
      return sales.map(sale => ({
        ...sale,
        total_amount: parseFloat(sale.total_amount || 0)
      }));
    } catch (error) {
      console.error('Error fetching sales by date range:', error);
      throw error;
    }
  });

  // Settings Handlers
  ipcMain.handle('get-setting', async (event, { key }) => {
    try {
      console.log('get-setting called with key:', key);
      
      // Handle missing or invalid key
      if (!key || typeof key !== 'string' || !key.trim()) {
        console.warn('Invalid or missing setting key');
        return {
          success: false,
          error: 'Valid setting key is required'
        };
      }

      // Use a parameterized query
      const stmt = db.prepare('SELECT value FROM settings WHERE key = @key');
      const setting = stmt.get({ key: key.trim() });
      
      console.log('Setting query result:', setting);
      
      // Always return success with a value property, even if null
      // This helps the renderer differentiate between errors and missing settings
      return {
        success: true,
        exists: Boolean(setting),
        value: setting ? setting.value : undefined
      };
    } catch (error) {
      console.error('Error in get-setting:', error);
      return {
        success: false,
        error: error.message || 'Unknown error occurred'
      };
    }
  });

  // Add set-setting handler
  ipcMain.handle('set-setting', async (event, { key, value }) => {
    try {
      // Handle missing or invalid key/value
      if (!key || typeof key !== 'string' || !key.trim()) {
        return {
          success: false,
          error: 'Valid setting key is required'
        };
      }

      // Convert value to string for storage
      const stringValue = String(value);

      // Use UPSERT to either insert or update the setting
      const stmt = db.prepare(`
        INSERT INTO settings (key, value) 
        VALUES (@key, @value)
        ON CONFLICT(key) DO UPDATE SET value = @value
      `);
      
      stmt.run({ key: key.trim(), value: stringValue });

      // For developer mode changes, emit an event to update UI
      if (key === 'developer_mode') {
        mainWindow.webContents.send('developer-mode-changed', value === 'true');
      }

      return {
        success: true,
        value: stringValue
      };
    } catch (error) {
      console.error('Error in set-setting:', error);
      return {
        success: false,
        error: error.message || 'Unknown error occurred'
      };
    }
  });

  // File Dialog Handler
  ipcMain.handle('show-open-dialog', async (event, options) => {
    try {
      const result = await dialog.showOpenDialog(options);
      return result;
    } catch (error) {
      console.error('Error showing open dialog:', error);
      throw error;
    }
  });

  // Auto-complete Handler
  ipcMain.handle('get-all-product-names', async () => {
    try {
      const products = db.prepare(`
        SELECT id, name, barcode 
        FROM products 
        GROUP BY name, barcode 
        ORDER BY name ASC
      `).all();
      return products;
    } catch (error) {
      console.error('Error fetching product names:', error);
      throw error;
    }
  });

  // Backup and Restore Handlers
  ipcMain.handle('create-backup', async () => {
    try {
      const dbPath = path.join(app.getPath('userData'), 'wolo-inventory.db');
      const backupDir = path.join(app.getPath('userData'), 'backups');
      
      // Create backups directory if it doesn't exist
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupDir, `wolo-inventory-backup-${timestamp}.db`);
      
      // Copy database file
      fs.copyFileSync(dbPath, backupPath);
      
      return { success: true, path: backupPath };
    } catch (error) {
      console.error('Error creating backup:', error);
      return { success: false, error: error.message || 'Failed to create backup' };
    }
  });

  ipcMain.handle('restore-backup', async (event, { backupPath }) => {
    try {
      if (!backupPath || !fs.existsSync(backupPath)) {
        return { success: false, error: 'Backup file not found' };
      }
      
      const dbPath = path.join(app.getPath('userData'), 'wolo-inventory.db');
      
      // Close current database connection
      if (db) {
        db.close();
        db = null;
      }
      
      // Copy backup to database location
      fs.copyFileSync(backupPath, dbPath);
      
      // Reopen database connection
      db = new Database(dbPath);
      db.pragma('foreign_keys = ON');
      db.pragma('journal_mode = WAL');
      
      return { success: true };
    } catch (error) {
      console.error('Error restoring backup:', error);
      return { success: false, error: error.message || 'Failed to restore backup' };
    }
  });

  // System Handlers
  ipcMain.handle('get-app-version', async () => {
    try {
      const packageJson = require('./package.json');
      return { success: true, version: packageJson.version || '1.0.0' };
    } catch (error) {
      console.error('Error getting app version:', error);
      return { success: false, version: '1.0.0', error: error.message };
    }
  });

  ipcMain.handle('check-for-updates', async () => {
    try {
      // Placeholder for update checking - can be implemented with auto-updater
      return { success: true, updateAvailable: false, message: 'No updates available' };
    } catch (error) {
      console.error('Error checking for updates:', error);
      return { success: false, error: error.message || 'Failed to check for updates' };
    }
  });

  ipcMain.handle('install-update', async () => {
    try {
      // Placeholder for update installation
      return { success: false, error: 'Auto-update not implemented yet' };
    } catch (error) {
      console.error('Error installing update:', error);
      return { success: false, error: error.message || 'Failed to install update' };
    }
  });
  
  console.log('IPC handler registration completed successfully');
}

// Renderer-only UI helpers for reports (moved to renderer.js). main.js should
// not contain DOM/window references.

// Helper function to safely execute SQL with error handling
function executeSql(sql, params = []) {
  try {
    return db.prepare(sql).run(...params);
  } catch (error) {
    console.error('SQL Error:', { sql, error });
    throw error;
  }
}

// Function to ensure database schema is up to date
function ensureDatabaseSchema() {
  try {
    console.log('Ensuring database schema is up to date...');
    
    // Check if sales table exists
    const salesTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sales'").get();
    if (!salesTable) {
      console.log('Sales table does not exist, creating it...');
      db.exec(`
        CREATE TABLE IF NOT EXISTS sales (
          id TEXT PRIMARY KEY,
          invoice_number TEXT,
          customer_name TEXT,
          total_amount REAL NOT NULL,
          payment_method TEXT,
          payment_status TEXT,
          sale_date TEXT NOT NULL,
          sale_timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
          notes TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('Sales table created successfully');
      return;
    }
    
    // Check if invoice_number column exists in sales table using PRAGMA
    try {
      const columns = db.prepare("PRAGMA table_info(sales)").all();
      console.log('Current sales table columns:', columns.map(c => c.name));
      
      const hasInvoiceNumber = columns.some(col => col.name === 'invoice_number');
      
      if (!hasInvoiceNumber) {
        console.log('Adding invoice_number column to sales table...');
        db.exec(`ALTER TABLE sales ADD COLUMN invoice_number TEXT`);
        console.log('Successfully added invoice_number column to sales table');
      } else {
        console.log('invoice_number column already exists in sales table');
      }
      
      // Also ensure other required columns exist
      const requiredColumns = ['customer_name', 'total_amount', 'payment_method', 'payment_status', 'sale_date'];
      for (const col of requiredColumns) {
        if (!columns.some(c => c.name === col)) {
          console.log(`Adding missing column ${col} to sales table...`);
          const type = col === 'total_amount' ? 'REAL' : 'TEXT';
          db.exec(`ALTER TABLE sales ADD COLUMN ${col} ${type}${col === 'total_amount' ? ' NOT NULL' : ''}`);
          console.log(`Added column ${col} to sales table`);
        }
      }
      
    } catch (error) {
      console.error('Error checking/updating sales table schema:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error ensuring database schema:', error);
    throw error;
  }
}

// Function to check and update sale_items table schema if needed
function updateSaleItemsSchema() {
  try {
    console.log('Checking sale_items table schema...');
    
    // Check if invoice_number column exists
    const columnCheck = db.prepare("PRAGMA table_info(sale_items)").all();
    const hasInvoiceNumber = columnCheck.some(col => col.name === 'invoice_number');
    
    if (!hasInvoiceNumber) {
      console.log('Adding invoice_number column to sale_items table...');
      db.exec('ALTER TABLE sale_items ADD COLUMN invoice_number TEXT');
      console.log('Successfully added invoice_number column to sale_items table');
    } else {
      console.log('invoice_number column already exists in sale_items table');
    }
  } catch (error) {
    console.error('Error updating sale_items schema:', error);
    throw error;
  }
}

// Function to ensure sale_items table exists
function ensureSaleItemsTable() {
  try {
    console.log('Ensuring sale_items table exists...');
    
    // Check if sale_items table exists
    const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sale_items'").get();
    
    if (!tableCheck) {
      console.log('sale_items table does not exist, creating it now...');
      
      // First ensure sales and products tables exist
      const salesTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sales'").get();
      const productsTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='products'").get();
      
      if (!salesTable) {
        console.log('Creating sales table...');
        db.exec(`
          CREATE TABLE IF NOT EXISTS sales (
            id TEXT PRIMARY KEY,
            invoice_number TEXT,
            customer_name TEXT,
            total_amount REAL NOT NULL,
            payment_method TEXT,
            payment_status TEXT,
            sale_date TEXT NOT NULL,
            sale_timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP`);
      }
      
      if (!productsTable) {
        console.log('Creating products table...');
        db.exec(`
          CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            barcode TEXT UNIQUE,
            category TEXT,
            quantity_in_stock INTEGER NOT NULL DEFAULT 0,
            quantity_on_shelf INTEGER NOT NULL DEFAULT 0,
            reorder_level INTEGER DEFAULT 10,
            cost_price REAL NOT NULL,
            selling_price REAL NOT NULL,
            supplier_id TEXT,
            supplier_name TEXT,
            supplier_contact TEXT,
            notes TEXT,
            expiry_date TEXT,
            photo_path TEXT,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
          )
        `);
      }
      
      // Now create the sale_items table
      console.log('Creating sale_items table...');
      db.exec(`
        CREATE TABLE IF NOT EXISTS sale_items (
          id TEXT PRIMARY KEY,
          sale_id TEXT NOT NULL,
          invoice_number TEXT,
          product_id TEXT NOT NULL,
          product_name TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          unit_price REAL NOT NULL,
          subtotal REAL NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
          FOREIGN KEY (product_id) REFERENCES products(id)
        )
      `);
      
      // Verify creation
      const verify = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sale_items'").get();
      if (verify) {
        console.log('Successfully created sale_items table');
      } else {
        console.error('Failed to create sale_items table');
      }
    } else {
      console.log('sale_items table already exists');
    }
  } catch (error) {
    console.error('Error in ensureSaleItemsTable:', error);
    throw error;
  }
}


// IPC handlers initialization flag is already defined above

// Initialize database
function initDatabase() {
  return new Promise((resolve, reject) => {
    let dbConnection;
    
    try {
      const dbPath = path.join(app.getPath('userData'), 'wolo-inventory.db');
      console.log('Initializing database at:', dbPath);
      
      // Check if database file exists
      const dbExists = require('fs').existsSync(dbPath);
      console.log('Database file exists:', dbExists);
      
      // Create database connection with verbose logging
      dbConnection = new Database(dbPath, { verbose: (sql) => console.log('Executing SQL:', sql) });
      
      // Verify database connection
      const dbVersion = dbConnection.prepare('SELECT sqlite_version() as version').get();
      console.log('SQLite version:', dbVersion.version);
      
      // Enable foreign key constraints
      dbConnection.pragma('foreign_keys = ON');
      console.log('Database connection established with foreign keys enabled');
      
      // Enable WAL mode for better concurrency
      dbConnection.pragma('journal_mode = WAL');
      
      // Set the global db variable
      db = dbConnection;
      
      // Start a transaction for schema creation
      dbConnection.exec('BEGIN TRANSACTION');
      
      try {
        // Create settings table first as it doesn't have any dependencies
        console.log('Creating settings table...');
        executeSql(`
          CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `);
        
        // Add updated_at column if it doesn't exist
        try {
          const settingsColumns = db.prepare("PRAGMA table_info(settings)").all();
          const hasUpdatedAt = settingsColumns.some(col => col.name === 'updated_at');
          if (!hasUpdatedAt) {
            console.log('Adding updated_at column to settings table...');
            db.exec('ALTER TABLE settings ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP');
            db.exec('ALTER TABLE settings ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP');
          }
      } catch (e) {
        console.error('Error updating settings table schema:', e);
      }

      // Create suppliers table before products since products references it
      console.log('Creating suppliers table...');
      executeSql(`
        CREATE TABLE IF NOT EXISTS suppliers (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          contact_person TEXT,
          email TEXT,
          phone TEXT,
          address TEXT,
          tax_id TEXT,
          payment_terms TEXT,
          notes TEXT,
          is_active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Add is_active column if it doesn't exist
      try {
        const supplierColumns = db.prepare("PRAGMA table_info(suppliers)").all();
        const hasIsActive = supplierColumns.some(col => col.name === 'is_active');
        if (!hasIsActive) {
          console.log('Adding is_active column to suppliers table...');
          db.exec('ALTER TABLE suppliers ADD COLUMN is_active INTEGER DEFAULT 1');
        }
      } catch (e) {
        console.error('Error updating suppliers table schema:', e);
      }

      // Create products table
      console.log('Creating products table...');
      executeSql(`
        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          barcode TEXT UNIQUE,
          category TEXT,
          category_id TEXT,
          sku TEXT,
          total_bulk_cost REAL NOT NULL DEFAULT 0,
          quantity_purchased INTEGER NOT NULL DEFAULT 0,
          profit_margin REAL NOT NULL DEFAULT 0,
          quantity_in_stock INTEGER NOT NULL DEFAULT 0,
          quantity_on_shelf INTEGER NOT NULL DEFAULT 0,
          cost_price REAL NOT NULL DEFAULT 0,
          selling_price REAL NOT NULL DEFAULT 0,
          manufactured_date TEXT,
          expiry_date TEXT,
          photo_path TEXT,
          reorder_level INTEGER NOT NULL DEFAULT 10,
          is_active INTEGER NOT NULL DEFAULT 1,
          supplier_id TEXT,
          supplier_name TEXT,
          supplier_contact TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          images TEXT,
          variants TEXT,
          notes TEXT,
          FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
        )
  `);
  
  // Add any missing columns
  const columnsToAdd = [
    { name: 'supplier_id', type: 'TEXT REFERENCES suppliers(id)' },
    { name: 'category_id', type: 'TEXT' },
    { name: 'sku', type: 'TEXT' },
    { name: 'images', type: 'TEXT' },
    { name: 'variants', type: 'TEXT' },
    { name: 'notes', type: 'TEXT' },
    { name: 'total_bulk_cost', type: 'REAL DEFAULT 0' },
    { name: 'quantity_purchased', type: 'INTEGER DEFAULT 0' },
    { name: 'profit_margin', type: 'REAL DEFAULT 0' },
    { name: 'quantity_on_shelf', type: 'INTEGER DEFAULT 0' },
    { name: 'manufactured_date', type: 'TEXT' },
    { name: 'expiry_date', type: 'TEXT' },
    { name: 'photo_path', type: 'TEXT' },
    { name: 'supplier_name', type: 'TEXT' },
    { name: 'supplier_contact', type: 'TEXT' }
  ];

  // Get existing columns
  const existingColumns = db.prepare("PRAGMA table_info(products)").all().map(col => col.name);
  
  // Add any missing columns
  for (const column of columnsToAdd) {
    if (!existingColumns.includes(column.name)) {
      try {
        console.log(`Adding missing column: ${column.name}`);
        db.exec(`ALTER TABLE products ADD COLUMN ${column.name} ${column.type}`);
      } catch (e) {
        if (!e.message.includes('duplicate column name')) {
          console.error(`Error adding ${column.name} column:`, e);
        }
      }
    }
  }
  
  // Initialize developer mode setting if not exists (settings table already created above)
  try {
    const devMode = db.prepare('SELECT value FROM settings WHERE key = ?').get('developer_mode');
    if (!devMode) {
      db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('developer_mode', 'false');
    }
  } catch (e) {
    console.error('Error initializing developer mode setting:', e);
  }
  
  // Suppliers table already created above, no need to recreate
  
      // Create sales table
      console.log('Creating sales table...');
      executeSql(`
        CREATE TABLE IF NOT EXISTS sales (
          id TEXT PRIMARY KEY,
          invoice_number TEXT,
          customer_name TEXT,
          total_amount REAL NOT NULL,
          payment_method TEXT,
          payment_status TEXT,
          sale_date TEXT NOT NULL,
          sale_timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
          notes TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Create sale_items table with detailed logging
      console.log('Creating sale_items table...');
      try {
        // First, check if sales and products tables exist
        const salesTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sales'").get();
        const productsTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='products'").get();
        
        console.log('Sales table exists:', !!salesTableExists);
        console.log('Products table exists:', !!productsTableExists);
        
        if (!salesTableExists || !productsTableExists) {
          throw new Error('Required tables (sales or products) do not exist');
        }
        
        // Create the sale_items table
        executeSql(`
          CREATE TABLE IF NOT EXISTS sale_items (
            id TEXT PRIMARY KEY,
            sale_id TEXT NOT NULL,
            product_id TEXT NOT NULL,
            product_name TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            unit_price REAL NOT NULL,
            subtotal REAL NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
          )
        `);
        
        // Verify the table was created
        const saleItemsTableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sale_items'").get();
        console.log('sale_items table created successfully:', !!saleItemsTableCheck);
        
        if (!saleItemsTableCheck) {
          throw new Error('Failed to create sale_items table');
        }
      } catch (error) {
        console.error('Error during sale_items table creation:', error);
        // Only rollback if transaction is still active
        if (db) {
          try {
            db.exec('ROLLBACK');
          } catch (rollbackError) {
            // Ignore rollback errors (transaction might already be committed/rolled back)
            if (!rollbackError.message.includes('no transaction is active')) {
              console.error('Error during rollback:', rollbackError);
            }
          }
        }
        throw error;
      }
      
      // Commit the transaction if everything succeeded
      db.exec('COMMIT');
      console.log('Database schema updated successfully');
      
      // Check if sale_timestamp column exists in sales table (outside transaction)
      try {
        const salesColumns = db.prepare("PRAGMA table_info(sales)").all();
        const hasSaleTimestamp = salesColumns.some(col => col.name === 'sale_timestamp');
        
        if (!hasSaleTimestamp) {
          executeSql('ALTER TABLE sales ADD COLUMN sale_timestamp TEXT DEFAULT CURRENT_TIMESTAMP');
          console.log('Added sale_timestamp column to sales table');
        }
      } catch (error) {
        console.warn('Could not add sale_timestamp column (it might already exist):', error.message);
      }
      
      // Register IPC handlers after database is ready (outside transaction, with separate error handling)
      // This MUST happen before window creation to prevent race conditions
      try {
        if (!ipcHandlersInitialized) {
          console.log('Registering IPC handlers before window creation...');
          registerIpcHandlers();
          ipcHandlersInitialized = true;
          console.log('IPC handlers registered successfully');
        } else {
          console.log('IPC handlers already registered');
        }
      } catch (ipcError) {
        // Log IPC handler registration errors but don't fail database initialization
        console.error('Error registering IPC handlers:', ipcError);
        console.error('IPC handler registration stack:', ipcError.stack);
        // Re-throw to ensure we know about the error - this is critical
        throw ipcError;
      }
      
      resolve(db);
      
      } catch (error) {
        // Rollback the transaction on error (only if transaction is active)
        console.error('Error during database initialization:', error);
        if (db) {
          try {
            db.exec('ROLLBACK');
          } catch (rollbackError) {
            // Ignore rollback errors (transaction might already be committed/rolled back)
            if (!rollbackError.message.includes('no transaction is active')) {
              console.error('Error during rollback:', rollbackError);
            }
          }
        }
        reject(error);
      }
    } catch (error) {
      // Catch any errors from the outer try block (database connection, etc.)
      console.error('Error initializing database connection:', error);
      reject(error);
    }
  });
}



// Create the main window
function createWindow() {
  try {
    if (mainWindow) return mainWindow;
    
    console.log('Creating main browser window...');
    
    // Get correct paths for production
    const iconPath = getResourcePath('WOLO-PHARMACY.ico');
    const preloadPath = getResourcePath('preload.js');
    
    console.log('Resource paths:', { iconPath, preloadPath, isPackaged: app.isPackaged, appPath: app.getAppPath() });
    
    mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 500,
      minHeight: 700,
      icon: iconPath,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: preloadPath,
        // Ensure correct path resolution in production
        sandbox: false,
        webSecurity: true,
        enableRemoteModule: false,
        partition: 'persist:main',
        // Enable additional debugging for renderer process
        devTools: process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true'
      },
      title: 'Wolo Inventory Management',
      backgroundColor: '#f8f9fa',
      show: false // Don't show until ready-to-show
    });
    
    // Show window when ready to prevent flickering
    mainWindow.once('ready-to-show', () => {
      console.log('Main window ready to show');
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
        
        // Open DevTools in development mode
        if (isDev) {
          mainWindow.webContents.openDevTools({ mode: 'detach' });
        }
      }
    });
    
    // Handle window errors
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('Failed to load window:', { errorCode, errorDescription });
    });
    
    mainWindow.webContents.on('unresponsive', () => {
      console.warn('Window became unresponsive');
    });
    
    mainWindow.on('unresponsive', () => {
      console.warn('Window is unresponsive');
    });
    
    mainWindow.on('error', (error) => {
      console.error('Window error:', error);
    });
    
    // Set window icon and load the main page
    mainWindow.setIcon(iconPath);
    
    // Load the main page with error handling
    // loadFile automatically resolves relative to app directory (works with ASAR in production)
    const htmlPath = 'index.html';
    console.log('Loading HTML from:', htmlPath, 'App path:', app.getAppPath());
    mainWindow.loadFile(htmlPath).catch(error => {
      console.error('Failed to load index.html:', error);
      console.error('App path:', app.getAppPath());
      console.error('Is packaged:', app.isPackaged);
      // Try with full path as fallback
      const fullPath = path.join(app.getAppPath(), 'index.html');
      console.log('Trying full path:', fullPath);
      mainWindow.loadFile(fullPath).catch(err => {
        console.error('Failed with full path:', err);
        dialog.showErrorBox('Load Error', `Failed to load the application.\n\nError: ${error.message}\n\nApp Path: ${app.getAppPath()}\nIs Packaged: ${app.isPackaged}`);
      });
    });
    
    // Show developer credits on startup
    mainWindow.webContents.on('did-finish-load', () => {
      try {
        mainWindow.webContents.executeJavaScript(`
          try {
            if (window.bootstrap && window.bootstrap.Modal && document.getElementById('developerCreditsModal')) {
              new bootstrap.Modal(document.getElementById('developerCreditsModal')).show();
            }
          } catch (e) {
            console.error('Failed to show developer credits:', e);
          }
        `).catch(e => console.error('Error executing developer credits script:', e));
      } catch (e) {
        console.error('Error setting up developer credits:', e);
      }
    });

    mainWindow.on('closed', () => {
      console.log('Main window closed');
      mainWindow = null;
    });
    
    return mainWindow;
  } catch (error) {
    console.error('Failed to create main window:', error);
    return null;
  }
}

// Function to handle uncaught exceptions
function handleUncaughtException(error) {
  console.error('Uncaught Exception:', error);
  if (dialog) {
    dialog.showErrorBox('Application Error', 'An unexpected error occurred: ' + error.message);
  } else {
    console.error('Could not show error dialog - dialog not available');
  }
  if (db) db.close();
  if (app) {
    app.quit(1);
  } else {
    process.exit(1);
  }
}

// Function to handle unhandled rejections
function handleUnhandledRejection(reason, promise) {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Log to a file or remote logging service in production
}

// Set up error handlers after app is available
function setupErrorHandlers() {
  process.on('uncaughtException', handleUncaughtException);
  process.on('unhandledRejection', handleUnhandledRejection);
}

// Main application startup
function initializeApp() {
  console.log('App is ready, initializing database...');
  
  try {
    // Set up cache path
    cachePath = path.join(app.getPath('userData'), 'cache');
    console.log('Cache path:', cachePath);
    
    // Initialize the database
    initDatabase().then(() => {
    
    // Verify the sale_items table exists after initialization
    try {
      const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sale_items'").get();
      console.log('After init - sale_items table exists:', !!tableCheck);
      
      if (!tableCheck) {
        console.error('CRITICAL: sale_items table was not created during initialization!');
      }
    } catch (e) {
      console.error('Error checking sale_items table after init:', e);
    }
    
    console.log('Database initialized, creating window...');
    
    // Ensure cache directory exists
    if (!fs.existsSync(cachePath)) {
      console.log('Creating cache directory...');
      fs.mkdirSync(cachePath, { recursive: true });
    }

    // Set custom cache path in app data
    app.setPath('sessionData', cachePath);
    
      // Create main window
      console.log('Creating main window...');
      createWindow();
      
      // Log success
      console.log('Application started successfully');
      
    }).catch(error => {
      console.error('Database initialization failed:', error);
      if (dialog) {
        dialog.showErrorBox('Database Error', 'Failed to initialize database: ' + error.message);
      }
      app.quit(1);
    });
    
  } catch (error) {
    console.error('Failed to initialize application:', error);
    if (dialog) {
      dialog.showErrorBox('Initialization Error', 'Failed to initialize application: ' + error.message);
    }
    app.quit(1);
  }
}

// Set up error handlers
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  if (dialog) {
    dialog.showErrorBox('Application Error', 'An unexpected error occurred: ' + error.message);
  }
  if (db) db.close();
  if (app) app.quit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// When Electron has finished initialization
app.whenReady().then(() => {
  try {
    initializeApp();
  } catch (error) {
    console.error('Error in app.whenReady():', error);
    if (dialog) {
      dialog.showErrorBox('Startup Error', `Failed to start application: ${error.message}`);
    }
    app.quit(1);
  }
}).catch(error => {
  console.error('Error in app.whenReady() handler:', error);
  if (dialog) {
    dialog.showErrorBox('Startup Error', `Failed to start application: ${error.message}`);
  }
  process.exit(1);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (db) db.close();
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
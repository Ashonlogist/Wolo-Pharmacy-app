const path = require('path');
const Database = require('better-sqlite3');
const { app } = require('electron');

// Get the database path
const dbPath = path.join(app.getPath('userData'), 'wolo-inventory.db');
console.log('Database path:', dbPath);

// Open the database
const db = new Database(dbPath, { verbose: console.log });

try {
  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Create sale_items table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS sale_items (
      id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL,
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

  // Verify the table was created
  const tableInfo = db.prepare("PRAGMA table_info(sale_items)").all();
  console.log('sale_items table columns:', tableInfo);
  
  // Add sale_timestamp to sales table if it doesn't exist
  try {
    db.exec('ALTER TABLE sales ADD COLUMN sale_timestamp TEXT DEFAULT CURRENT_TIMESTAMP');
    console.log('Added sale_timestamp column to sales table');
  } catch (e) {
    if (!e.message.includes('duplicate column name')) {
      console.error('Error adding sale_timestamp column:', e);
      throw e;
    }
    console.log('sale_timestamp column already exists');
  }
  
  console.log('Database repair completed successfully!');
} catch (error) {
  console.error('Error repairing database:', error);
} finally {
  db.close();
}

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    send: (channel, data) => {
      // Whitelist channels for one-way sends
      const validChannels = [
        'save-product', 'add-product', 'get-products', 'get-product', 'delete-product',
        'record-sale', 'export-data', 'save-settings', 'set-setting', 'send-email',
        'show-save-dialog', 'show-open-dialog', 'print-receipt', 'export-to-excel',
        'get-sales-by-date-range', 'get-sales-history', 'data-updated'
      ];
      if (validChannels.includes(channel)) ipcRenderer.send(channel, data);
    },
    on: (channel, func) => {
      const validChannels = ['data-updated', 'printers-updated', 'print-complete', 'ipc-handlers-ready', 'developer-mode-changed'];
      if (validChannels.includes(channel)) {
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      }
    },
    invoke: async (channel, data) => {
      try {
        // Whitelist channels for request/response
        const validChannels = [
          'get-products', 'get-product', 'add-product', 'update-product', 'delete-product',
          'get-sales-by-date-range', 'get-sales-history', 'record-sale', 'export-to-excel',
          'export-sales-excel', 'get-setting', 'set-setting', 'get-all-product-names', 'check-duplicate-product',
          'get-suppliers', 'create-supplier', 'update-supplier', 'delete-supplier',
          'get-low-stock-items', 'get-expiring-items', 'get-categories',
          'create-category', 'update-category', 'delete-category',
          'create-backup', 'restore-backup', 'check-for-updates', 'install-update', 'get-app-version',
          'developer-mode-changed', 'fs-read-file', 'fs-write-file', 'fs-exists-sync',
          'path-join', 'path-basename', 'path-dirname', 'path-extname',
          'os-homedir', 'os-tmpdir', 'show-save-dialog', 'show-open-dialog',
          'show-message-box', 'get-printers', 'print-receipt'
        ];
        
        if (!validChannels.includes(channel)) {
          console.error(`Attempted to use invalid IPC channel: ${channel}`);
          return Promise.reject(`Invalid channel: ${channel}`);
        }
        
        return await ipcRenderer.invoke(channel, data).catch(error => {
          console.error(`Error in IPC invoke '${channel}':`, error);
          throw error; // Re-throw to allow proper error handling in the renderer
        });
      } catch (error) {
        console.error('Unexpected error in IPC invoke:', error);
        throw error; // Ensure the error propagates to the renderer
      }
    },
    removeAllListeners: (channel) => {
      ipcRenderer.removeAllListeners(channel);
    }
  },
  
  // Expose other necessary Node.js APIs
  node: {
    process: {
      platform: process.platform
    },
    fs: {
      readFile: (path, encoding) => ipcRenderer.invoke('fs-read-file', { path, encoding }),
      writeFile: (path, data) => ipcRenderer.invoke('fs-write-file', { path, data }),
      existsSync: (path) => ipcRenderer.invoke('fs-exists-sync', { path })
    },
    path: {
      join: (...args) => ipcRenderer.invoke('path-join', args),
      basename: (path) => ipcRenderer.invoke('path-basename', { path }),
      dirname: (path) => ipcRenderer.invoke('path-dirname', { path }),
      extname: (path) => ipcRenderer.invoke('path-extname', { path })
    },
    os: {
      homedir: () => ipcRenderer.invoke('os-homedir'),
      tmpdir: () => ipcRenderer.invoke('os-tmpdir')
    }
  },
  
  // Expose utility functions
  utils: {
    showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
    showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
    showErrorBox: (title, content) => ipcRenderer.send('show-error-box', { title, content }),
    showMessageBox: (options) => ipcRenderer.invoke('show-message-box', options),
    getPrinters: () => ipcRenderer.invoke('get-printers'),
    printReceipt: (options) => ipcRenderer.invoke('print-receipt', options)
  },
  
  // Expose a safe version of require for specific modules
  require: (module) => {
    const allowedModules = ['path', 'url', 'crypto'];
    if (allowedModules.includes(module)) {
      return require(module);
    }
    throw new Error(`Module ${module} is not allowed`);
  }
});

// Expose a safe version of process
contextBridge.exposeInMainWorld('process', {
  env: {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PLATFORM: process.platform
  },
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  },
  platform: process.platform
});
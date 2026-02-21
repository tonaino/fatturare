const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const {
  initializeDatabase,
  getCompanyInfo,
  updateCompanyInfo,
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getProducts,
  getProductByName,
  createProduct,
  getDocuments,
  getDocumentById,
  getDocumentItems,
  getNextDocumentNumber,
  createDocument,
  finalizeDocument,
  finalizeDocumentById,
  updateDocument,
  updateDocumentStatus,
  getBankAccounts,
  getBankAccountById,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
  getBankAccountByCurrency,
  getSetting,
  updateSetting,
  getDashboardStats,
  getRecentUnpaidInvoices
} = require('./database');
const { createBackup } = require('./backup');
const { exportMonthDocuments, exportSelectedDocuments, exportDatabase } = require('./export');
const { generatePDF } = require('./pdf');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // and load the index.html of the app.
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173'); // Vite default port
    // Open the DevTools in development.
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/renderer/index.html'));
    // Keep DevTools closed in production.
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
  // Initialize database
  await initializeDatabase();
  
  createWindow();
  
  // Register IPC handlers
  ipcMain.handle('create-backup', createBackup);
  ipcMain.handle('export-month-documents', exportMonthDocuments);
  ipcMain.handle('export-selected-documents', exportSelectedDocuments);
  ipcMain.handle('export-database', exportDatabase);
  
  // Database operations
  ipcMain.handle('get-company-info', getCompanyInfo);
  ipcMain.handle('update-company-info', (event, companyData) => updateCompanyInfo(companyData));
  
  ipcMain.handle('get-customers', getCustomers);
  ipcMain.handle('get-customer-by-id', (event, id) => getCustomerById(id));
  ipcMain.handle('create-customer', (event, customerData) => createCustomer(customerData));
  ipcMain.handle('update-customer', (event, id, customerData) => updateCustomer(id, customerData));
  ipcMain.handle('delete-customer', (event, id) => deleteCustomer(id));
  
  ipcMain.handle('get-products', getProducts);
  ipcMain.handle('get-product-by-name', (event, name) => getProductByName(name));
  ipcMain.handle('create-product', (event, productData) => createProduct(productData));
  
  ipcMain.handle('get-documents', getDocuments);
  ipcMain.handle('get-document-by-id', (event, id) => getDocumentById(id));
  ipcMain.handle('get-document-items', (event, docId) => getDocumentItems(docId));
  ipcMain.handle('get-next-document-number', (event, type) => getNextDocumentNumber(type));
  ipcMain.handle('create-document', (event, documentData, items) => createDocument(documentData, items));
  ipcMain.handle('update-document', (event, id, documentData, items) => updateDocument(id, documentData, items));
  ipcMain.handle('finalize-document', (event, id, documentData, items) => finalizeDocumentById(id, documentData, items));
  ipcMain.handle('finalize-new-document', (event, documentData, items) => finalizeDocument(documentData, items));
  ipcMain.handle('update-document-status', (event, id, status) => updateDocumentStatus(id, status));
  ipcMain.handle('generate-pdf', (event, docId) => generatePDF(docId));
  ipcMain.handle('open-pdf', (event, filePath) => shell.openPath(filePath));

  ipcMain.handle('get-bank-accounts', getBankAccounts);
  ipcMain.handle('get-bank-account-by-id', (event, id) => getBankAccountById(id));
  ipcMain.handle('create-bank-account', (event, bankAccountData) => createBankAccount(bankAccountData));
  ipcMain.handle('update-bank-account', (event, id, bankAccountData) => updateBankAccount(id, bankAccountData));
  ipcMain.handle('delete-bank-account', (event, id) => deleteBankAccount(id));
  ipcMain.handle('get-bank-account-by-currency', (event, currency) => getBankAccountByCurrency(currency));

  ipcMain.handle('get-setting', (event, key) => getSetting(key));
  ipcMain.handle('update-setting', (event, key, value) => updateSetting(key, value));
  ipcMain.handle('get-dashboard-stats', getDashboardStats);
  ipcMain.handle('get-recent-unpaid-invoices', getRecentUnpaidInvoices);

  // Directory selection dialog
  ipcMain.handle('show-directory-dialog', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Directory',
      properties: ['openDirectory', 'createDirectory']
    });
    return result;
  });

  ipcMain.handle('quit-app', () => {
    app.quit();
  });

  // Reset everything handler
  ipcMain.handle('reset-everything', async () => {
    try {
      const fs = require('fs');
      const { dbPath } = require('./database');

      // Delete the database file
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
      }

      // Close the database connection (global db variable from database.js)
      const db = require('./database').db;
      if (db) {
        db.close();
      }

      // Reinitialize database (creates new empty file)
      await initializeDatabase();

      // Restart the application
      app.relaunch();
      app.quit();

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

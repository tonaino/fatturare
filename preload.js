const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Database operations
  getCompanyInfo: () => ipcRenderer.invoke('get-company-info'),
  updateCompanyInfo: (companyData) => ipcRenderer.invoke('update-company-info', companyData),
  
  getCustomers: () => ipcRenderer.invoke('get-customers'),
  getCustomerById: (id) => ipcRenderer.invoke('get-customer-by-id', id),
  createCustomer: (customerData) => ipcRenderer.invoke('create-customer', customerData),
  updateCustomer: (id, customerData) => ipcRenderer.invoke('update-customer', id, customerData),
  deleteCustomer: (id) => ipcRenderer.invoke('delete-customer', id),
  
  getProducts: () => ipcRenderer.invoke('get-products'),
  getProductByName: (name) => ipcRenderer.invoke('get-product-by-name', name),
  createProduct: (productData) => ipcRenderer.invoke('create-product', productData),
  
  getDocuments: () => ipcRenderer.invoke('get-documents'),
  getDocumentById: (id) => ipcRenderer.invoke('get-document-by-id', id),
  getDocumentItems: (docId) => ipcRenderer.invoke('get-document-items', docId),
  getNextDocumentNumber: (type) => ipcRenderer.invoke('get-next-document-number', type),
  createDocument: (documentData, items) => ipcRenderer.invoke('create-document', documentData, items),
  updateDocument: (id, documentData, items) => ipcRenderer.invoke('update-document', id, documentData, items),
  finalizeDocument: (id, documentData, items) => ipcRenderer.invoke('finalize-document', id, documentData, items),
  finalizeNewDocument: (documentData, items) => ipcRenderer.invoke('finalize-new-document', documentData, items),
  updateDocumentStatus: (id, status) => ipcRenderer.invoke('update-document-status', id, status),
  getDashboardStats: () => ipcRenderer.invoke('get-dashboard-stats'),
  getRecentUnpaidInvoices: () => ipcRenderer.invoke('get-recent-unpaid-invoices'),
  
  getSetting: (key) => ipcRenderer.invoke('get-setting', key),
  updateSetting: (key, value) => ipcRenderer.invoke('update-setting', key, value),

  // Bank account operations
  getBankAccounts: () => ipcRenderer.invoke('get-bank-accounts'),
  getBankAccountById: (id) => ipcRenderer.invoke('get-bank-account-by-id', id),
  createBankAccount: (bankAccountData) => ipcRenderer.invoke('create-bank-account', bankAccountData),
  updateBankAccount: (id, bankAccountData) => ipcRenderer.invoke('update-bank-account', id, bankAccountData),
  deleteBankAccount: (id) => ipcRenderer.invoke('delete-bank-account', id),
  getBankAccountByCurrency: (currency) => ipcRenderer.invoke('get-bank-account-by-currency', currency),

  // Backup and export
  createBackup: () => ipcRenderer.invoke('create-backup'),
  exportMonthDocuments: (month, year) => ipcRenderer.invoke('export-month-documents', { month, year }),
  exportSelectedDocuments: (month, year, documentIds) => ipcRenderer.invoke('export-selected-documents', { month, year, documentIds }),
  exportDatabase: () => ipcRenderer.invoke('export-database'),
  resetEverything: () => ipcRenderer.invoke('reset-everything'),
  generatePDF: (docId) => ipcRenderer.invoke('generate-pdf', docId),
  openPDF: (filePath) => ipcRenderer.invoke('open-pdf', filePath),

  // Directory selection dialog
  showDirectoryDialog: () => ipcRenderer.invoke('show-directory-dialog'),

  // App control
  quitApp: () => ipcRenderer.invoke('quit-app')
});

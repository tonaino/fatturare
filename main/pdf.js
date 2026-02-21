const { BrowserWindow, app } = require('electron');
const path = require('path');
const fs = require('fs');
const handlebars = require('handlebars');
const { getDocumentById, getDocumentItems, getCompanyInfo, getCustomerById, updateDocumentPdfPath, getBankAccountById, getBankAccountByCurrency } = require('./database');

// Register Handlebars helpers
handlebars.registerHelper('add', (a, b) => a + b);
handlebars.registerHelper('formatCurrency', (value) => {
  if (value === undefined || value === null) return '0.00 €';
  return parseFloat(value).toFixed(2) + ' €';
});

const generatePDF = async (docId) => {
  const document = await getDocumentById(docId);
  if (!document) throw new Error('Document not found');

  const items = await getDocumentItems(docId);
  const company = await getCompanyInfo();

  // Get bank account details - use specific account if selected, otherwise fall back to currency-based default
  let bankAccount = null;
  if (document.bank_account_id) {
    bankAccount = await getBankAccountById(document.bank_account_id);
  }
  if (!bankAccount) {
    // Fall back to currency-based default if no specific account selected
    bankAccount = await getBankAccountByCurrency(document.currency || 'EUR');
  }
  if (bankAccount) {
    company.iban = bankAccount.iban;
    company.bic = bankAccount.bic;
    company.bank_name = bankAccount.bank_name;
  }

  // Ensure items is an array
  if (!Array.isArray(items)) {
    console.error('getDocumentItems did not return an array:', items);
    throw new Error('Failed to load document items - not an array');
  }

  // Find customer safely
  let customer = null;
  if (document.customer_id) {
    customer = await getCustomerById(parseInt(document.customer_id));
  }

  if (!customer) {
    // Fallback if no customer linked
    customer = {
      name: 'N/A',
      address: 'N/A',
      bulstat: 'N/A',
      vat_id: 'N/A',
      mol: 'N/A'
    };
  }

  const vatRate = parseFloat(document.vat_rate || 20);

  // Ensure items is an array and has content for PDF generation
  if (!items || items.length === 0) {
    console.warn('Document has no items, using minimal template data');
  }

  // Helper function to get localized unit based on template
  const getLocalizedUnit = (unitCode, isBilingual) => {
    if (!unitCode) return 'pcs';

    const unitTranslations = {
      'pcs': isBilingual ? 'pcs' : 'бр',
      'kg': isBilingual ? 'kg' : 'кг',
      'm': isBilingual ? 'm' : 'м',
      'hours': isBilingual ? 'hours' : 'часа',
      'unit': isBilingual ? 'unit' : 'единица',
      'l': isBilingual ? 'l' : 'л',
      'other': isBilingual ? 'other' : 'друго'
    };

    return unitTranslations[unitCode] || unitCode;
  };

  // Determine if this is a bilingual template
  // If customer.default_template === 'BG', then it's Bulgarian-only (not bilingual)
  // If customer.default_template !== 'BG' or is undefined, then it's bilingual
  const isBilingual = customer.default_template === 'BG' ? false : true;

  // Extract clean number (without prefix) for display in PDF
  const cleanDocNumber = document.doc_number ? document.doc_number.replace(/^INV-|^CN-/, '') : '';

  // Generate ORIGINAL PDF
  const originalTemplateData = {
    company: company,
    customer: customer,
    doc_number: document.doc_number,  // Full number for internal reference
    clean_doc_number: cleanDocNumber, // Clean number for display
    issue_date: document.issue_date,
    tax_event_date: document.tax_event_date,
    payment_method: 'По сметка',
    vat_rate: vatRate,
    items: (items || []).map(item => {
      const net = parseFloat(item.total || 0);
      const vat = net * (vatRate / 100);
      return {
        name: item.name || 'Item',
        qty: item.qty || 1,
        unit: item.unit || 'pcs',
        unit_localized: getLocalizedUnit(item.unit, isBilingual),
        price: item.price || 0,
        total_net: net,
        total_vat: vat,
        total: net + vat
      };
    }),
    total_net: document.total_net,
    total_vat: document.total_vat,
    total_gross: document.total_gross,
    isCreditNote: document.type === 'CREDIT_NOTE',
    isProforma: document.type === 'PROFORMA_INVOICE',
    relatedInvNumber: document.related_inv_number,
    relatedInvDate: document.related_inv_date,
    reason: document.type === 'CREDIT_NOTE' ? document.correction_reason : document.exemption_reason,
    watermark_text: document.type === 'PROFORMA_INVOICE' ?
      (isBilingual ? 'PROFORMA' : 'ПРОФОРМА') :
      (isBilingual ? 'ORIGINAL' : 'ОРИГИНАЛ')
  };

  // Generate COPY PDF
  const copyTemplateData = {
    ...originalTemplateData,
    watermark_text: document.type === 'PROFORMA_INVOICE' ?
      (isBilingual ? 'PROFORMA COPY' : 'ПРОФОРМА КОПИЕ') :
      (isBilingual ? 'COPY' : 'КОПИЕ')
  };

  // Select template based on customer preference or default
  const templateName = customer.default_template === 'BG' ? 'bg-only' : 'bilingual';
  const templatePath = path.join(app.getAppPath(), 'templates', templateName, 'invoice.html');

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found at ${templatePath}`);
  }

  const templateHtml = fs.readFileSync(templatePath, 'utf8');
  const compiledTemplate = handlebars.compile(templateHtml);

  // Generate ORIGINAL PDF
  const originalHtmlContent = compiledTemplate(originalTemplateData);

  // Create hidden window to render PDF
  let workerWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false
    }
  });

  // Base64 encode the HTML to load it
  const originalBase64Html = Buffer.from(originalHtmlContent).toString('base64');
  await workerWindow.loadURL(`data:text/html;base64,${originalBase64Html}`);

  const pdfOptions = {
    marginsType: 0,
    pageSize: 'A4',
    printBackground: true,
    landscape: false
  };

  const originalData = await workerWindow.webContents.printToPDF(pdfOptions);

  const originalPdfFileName = `${cleanDocNumber.replace(/\//g, '-')}.pdf`;
  const pdfDir = path.join(app.getPath('documents'), 'Fatture');
  if (!fs.existsSync(pdfDir)) {
    fs.mkdirSync(pdfDir, { recursive: true });
  }

  const originalPdfPath = path.join(pdfDir, originalPdfFileName);
  fs.writeFileSync(originalPdfPath, originalData);

  workerWindow.destroy();

  // Generate COPY PDF
  const copyHtmlContent = compiledTemplate(copyTemplateData);

  workerWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false
    }
  });

  const copyBase64Html = Buffer.from(copyHtmlContent).toString('base64');
  await workerWindow.loadURL(`data:text/html;base64,${copyBase64Html}`);

  const copyData = await workerWindow.webContents.printToPDF(pdfOptions);

  const copyPdfFileName = `${cleanDocNumber.replace(/\//g, '-')}_COPY.pdf`;
  const copyPdfPath = path.join(pdfDir, copyPdfFileName);
  fs.writeFileSync(copyPdfPath, copyData);

  workerWindow.destroy();

  // Update document with original pdf_path in the database
  await updateDocumentPdfPath(docId, originalPdfPath);

  return { original: originalPdfPath, copy: copyPdfPath };
};

module.exports = { generatePDF };

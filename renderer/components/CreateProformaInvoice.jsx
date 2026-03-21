import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Banknote } from 'lucide-react';

export const CreateProformaInvoice = ({ editId, onComplete }) => {
  const { t } = useTranslation();
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState('');
  const [formData, setFormData] = useState({
    customer_id: '',
    currency: 'EUR',
    bank_account_id: '',
    issue_date: new Date().toISOString().split('T')[0],
    tax_event_date: new Date().toISOString().split('T')[0],
    status: 'draft', // Proforma invoices start as draft
    vat_rate: 20,
    exemption_reason: '',
    total_net: 0,
    total_vat: 0,
    total_gross: 0
  });
  const [items, setItems] = useState([
    { id: Date.now(), name: '', qty: 1, price: 0, total: 0 }
  ]);
  const [isFinalized, setIsFinalized] = useState(false);
  const [docNumber, setDocNumber] = useState('');
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductUnit, setNewProductUnit] = useState('pcs');
  const [showProductModal, setShowProductModal] = useState(false);
  const [showVatCalculator, setShowVatCalculator] = useState(false);
  const [currentVatItemIndex, setCurrentVatItemIndex] = useState(null);
  const [grossPriceInput, setGrossPriceInput] = useState('');

  useEffect(() => {
    loadInitialData();
  }, [editId]);

  const loadInitialData = async () => {
    try {
      const [customersData, productsData, bankAccountsData, nextNumber] = await Promise.all([
        window.electronAPI.getCustomers(),
        window.electronAPI.getProducts(),
        window.electronAPI.getBankAccounts(),
        editId ? null : window.electronAPI.getNextDocumentNumber('PROFORMA_INVOICE')
      ]);

      setCustomers((customersData || []).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })));
      setProducts(productsData || []);
      setBankAccounts(bankAccountsData || []);
      setNextInvoiceNumber(nextNumber);

      if (editId) {
        const doc = await window.electronAPI.getDocumentById(editId);
        const docItems = await window.electronAPI.getDocumentItems(editId);

        setIsFinalized(!!doc.doc_number);
        setDocNumber(doc.doc_number || '');

        setFormData({
          customer_id: doc.customer_id || '',
          currency: doc.currency || 'EUR',
          bank_account_id: doc.bank_account_id || '',
          doc_number: doc.doc_number || '', // Include doc_number for finalized invoices
          issue_date: doc.issue_date,
          tax_event_date: doc.tax_event_date,
          status: doc.status,
          vat_rate: doc.vat_rate,
          exemption_reason: doc.exemption_reason || '',
          total_net: doc.total_net,
          total_vat: doc.total_vat,
          total_gross: doc.total_gross
        });
        setItems(docItems.map(item => ({ ...item, id: item.id || Date.now() })));
      } else {
        // Reset states for new proforma invoice creation
        setIsFinalized(false);
        setDocNumber('');
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredBankAccounts = () => {
    return bankAccounts.filter(account => account.currency === formData.currency);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'customer_id') {
      // When customer changes, set default currency from customer
      const selectedCustomer = customers.find(c => c.id === parseInt(value));
      const customerCurrency = selectedCustomer ? (selectedCustomer.default_currency || 'EUR') : 'EUR';
      setFormData(prev => ({
        ...prev,
        [name]: value,
        currency: customerCurrency,
        bank_account_id: '' // Reset bank account when currency changes
      }));
    } else if (name === 'currency') {
      // When currency changes, reset bank account selection
      setFormData(prev => ({
        ...prev,
        [name]: value,
        bank_account_id: ''
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];

    if (field === 'name') {
      // Check if the product name exists in our product library
      const product = products.find(p => p.name === value);
      if (product) {
        newItems[index].name = product.name;
        newItems[index].price = product.default_price;
        newItems[index].unit = product.unit;
      } else {
        newItems[index].name = value;
      }
    } else {
      newItems[index][field] = value;
    }

    // Calculate totals
    newItems[index].total = parseFloat(newItems[index].qty || 0) * parseFloat(newItems[index].price || 0);

    setItems(newItems);
    calculateTotals(newItems);
  };

  const addNewItem = () => {
    setItems([...items, { id: Date.now(), name: '', qty: 1, price: 0, total: 0 }]);
  };

  const removeItem = (index) => {
    if (items.length > 1) {
      const newItems = [...items];
      newItems.splice(index, 1);
      setItems(newItems);
      calculateTotals(newItems);
    }
  };

  const calculateTotals = (itemsList = items) => {
    const totalNet = itemsList.reduce((sum, item) => sum + parseFloat(item.total || 0), 0);
    const totalVat = (totalNet * (parseFloat(formData.vat_rate) || 0) / 100);
    const totalGross = totalNet + totalVat;

    setFormData(prev => ({
      ...prev,
      total_net: totalNet,
      total_vat: totalVat,
      total_gross: totalGross
    }));
  };

  const handleVatRateChange = (e) => {
    const value = parseInt(e.target.value);

    setFormData(prev => {
      const updatedFormData = {
        ...prev,
        vat_rate: value,
        exemption_reason: value === 0 ? prev.exemption_reason : ''
      };

      // Recalculate totals with the updated VAT rate
      const totalNet = items.reduce((sum, item) => sum + parseFloat(item.total || 0), 0);
      const totalVat = (totalNet * (parseFloat(updatedFormData.vat_rate) || 0) / 100);
      const totalGross = totalNet + totalVat;

      return {
        ...updatedFormData,
        total_net: totalNet,
        total_vat: totalVat,
        total_gross: totalGross
      };
    });

    // Also update the items to reflect the new VAT rate in each item's calculation
    // This ensures that when the form is submitted, items have the correct VAT calculations
    const updatedItems = items.map(item => {
      const net = parseFloat(item.total || 0);
      const vat = net * (value / 100);
      return {
        ...item,
        total_net: net,
        total_vat: vat,
        total: net + vat
      };
    });

    setItems(updatedItems);
  };

  const handleSaveDraft = async () => {
    if (formData.vat_rate === 0 && !formData.exemption_reason) {
      alert(t('messages.selectExemptionReason'));
      return;
    }

    if (!formData.customer_id) {
      alert(t('messages.selectCustomer'));
      return;
    }

    try {
      const documentData = {
        type: 'PROFORMA_INVOICE',
        customer_id: formData.customer_id,
        currency: formData.currency,
        bank_account_id: formData.bank_account_id || null,
        related_inv_number: null,
        related_inv_date: null,
        issue_date: formData.issue_date,
        tax_event_date: formData.tax_event_date,
        status: 'draft',
        vat_rate: formData.vat_rate,
        exemption_reason: formData.vat_rate === 0 ? formData.exemption_reason : null,
        correction_reason: null,
        total_net: formData.total_net,
        total_vat: formData.total_vat,
        total_gross: formData.total_gross,
        pdf_path: null
      };

      await window.electronAPI.createDocument(documentData, items);
      alert(t('messages.proformaInvoiceSavedAsDraft'));

      if (onComplete) onComplete();

      // Reset form
      setFormData({
        customer_id: '',
        issue_date: new Date().toISOString().split('T')[0],
        tax_event_date: new Date().toISOString().split('T')[0],
        status: 'draft',
        vat_rate: 20,
        exemption_reason: '',
        total_net: 0,
        total_vat: 0,
        total_gross: 0
      });
      setItems([{ id: Date.now(), name: '', qty: 1, price: 0, total: 0 }]);
    } catch (error) {
      console.error('Error saving draft:', error);
      alert(t('messages.errorSavingDraft'));
    }
  };

  const handleFinalize = async () => {
    if (formData.vat_rate === 0 && !formData.exemption_reason) {
      alert(t('messages.selectExemptionReason'));
      return;
    }

    if (!formData.customer_id) {
      alert(t('messages.selectCustomer'));
      return;
    }

    try {
      const documentData = {
        type: 'PROFORMA_INVOICE',
        customer_id: formData.customer_id,
        currency: formData.currency,
        bank_account_id: formData.bank_account_id || null,
        related_inv_number: null,
        related_inv_date: null,
        issue_date: formData.issue_date,
        tax_event_date: formData.tax_event_date,
        status: 'unpaid', // Change status to unpaid when finalized
        vat_rate: formData.vat_rate,
        exemption_reason: formData.vat_rate === 0 ? formData.exemption_reason : null,
        correction_reason: null,
        total_net: formData.total_net,
        total_vat: formData.total_vat,
        total_gross: formData.total_gross,
        pdf_path: null
      };

      const result = await window.electronAPI.finalizeNewDocument(documentData, items);
      alert(t('messages.proformaInvoiceCreated', { docNumber: result.doc_number }));

      if (onComplete) onComplete();

      // Reset form
      setFormData({
        customer_id: '',
        issue_date: new Date().toISOString().split('T')[0],
        tax_event_date: new Date().toISOString().split('T')[0],
        status: 'draft',
        vat_rate: 20,
        exemption_reason: '',
        total_net: 0,
        total_vat: 0,
        total_gross: 0
      });
      setItems([{ id: Date.now(), name: '', qty: 1, price: 0, total: 0 }]);
    } catch (error) {
      console.error('Error finalizing proforma invoice:', error);
      alert(t('messages.errorFinalizingProformaInvoice'));
    }
  };

  const handleUpdate = async () => {
    if (formData.vat_rate === 0 && !formData.exemption_reason) {
      alert(t('messages.selectExemptionReason'));
      return;
    }

    if (!formData.customer_id) {
      alert(t('messages.selectCustomer'));
      return;
    }

    try {
      const documentData = {
        type: 'PROFORMA_INVOICE',
        customer_id: formData.customer_id,
        currency: formData.currency,
        bank_account_id: formData.bank_account_id || null,
        related_inv_number: null,
        related_inv_date: null,
        issue_date: formData.issue_date,
        tax_event_date: formData.tax_event_date,
        status: formData.status,
        vat_rate: formData.vat_rate,
        exemption_reason: formData.vat_rate === 0 ? formData.exemption_reason : null,
        correction_reason: null,
        total_net: formData.total_net,
        total_vat: formData.total_vat,
        total_gross: formData.total_gross,
        pdf_path: null,
        // CRITICAL: Preserve document number for finalized invoices
        doc_number: isFinalized ? formData.doc_number : null
      };

      await window.electronAPI.updateDocument(editId, documentData, items);
      alert(t('messages.proformaInvoiceUpdated'));

      if (onComplete) onComplete();

      // No reset since we're editing
    } catch (error) {
      console.error('Error updating proforma invoice:', error);
      alert(t('messages.errorUpdatingProformaInvoice'));
    }
  };

  const handleSaveDraftWhenEditing = async () => {
    if (formData.vat_rate === 0 && !formData.exemption_reason) {
      alert(t('messages.selectExemptionReason'));
      return;
    }

    if (!formData.customer_id) {
      alert(t('messages.selectCustomer'));
      return;
    }

    try {
      const documentData = {
        type: 'PROFORMA_INVOICE',
        customer_id: formData.customer_id,
        currency: formData.currency,
        bank_account_id: formData.bank_account_id || null,
        related_inv_number: null,
        related_inv_date: null,
        issue_date: formData.issue_date,
        tax_event_date: formData.tax_event_date,
        status: 'draft', // Always draft when saving as draft
        vat_rate: formData.vat_rate,
        exemption_reason: formData.vat_rate === 0 ? formData.exemption_reason : null,
        correction_reason: null,
        total_net: formData.total_net,
        total_vat: formData.total_vat,
        total_gross: formData.total_gross,
        pdf_path: null
      };

      await window.electronAPI.updateDocument(editId, documentData, items);
      alert(t('messages.proformaInvoiceUpdatedAsDraft'));

      if (onComplete) onComplete();
    } catch (error) {
      console.error('Error updating draft:', error);
      alert(t('messages.errorUpdatingDraft'));
    }
  };

  const handleFinalizeWhenEditing = async () => {
    if (formData.vat_rate === 0 && !formData.exemption_reason) {
      alert(t('messages.selectExemptionReason'));
      return;
    }

    if (!formData.customer_id) {
      alert(t('messages.selectCustomer'));
      return;
    }

    try {
      const documentData = {
        type: 'PROFORMA_INVOICE',
        customer_id: formData.customer_id,
        currency: formData.currency,
        bank_account_id: formData.bank_account_id || null,
        related_inv_number: null,
        related_inv_date: null,
        issue_date: formData.issue_date,
        tax_event_date: formData.tax_event_date,
        status: 'unpaid', // Set to unpaid when finalized
        vat_rate: formData.vat_rate,
        exemption_reason: formData.vat_rate === 0 ? formData.exemption_reason : null,
        correction_reason: null,
        total_net: formData.total_net,
        total_vat: formData.total_vat,
        total_gross: formData.total_gross,
        pdf_path: null
      };

      const result = await window.electronAPI.finalizeDocument(editId, documentData, items);
      alert(t('messages.proformaInvoiceFinalized', { docNumber: result.doc_number }));

      if (onComplete) onComplete();
    } catch (error) {
      console.error('Error finalizing proforma invoice:', error);
      alert(t('messages.errorFinalizingProformaInvoice'));
    }
  };

  // Function to convert proforma invoice to real invoice
  const handleConvertToInvoice = async () => {
    if (!isFinalized) {
      alert(t('messages.cannotConvertDraftToInvoice'));
      return;
    }

    if (!confirm(t('messages.confirmConvertProformaToInvoice'))) {
      return;
    }

    try {
      // Get the current proforma invoice data
      const currentDoc = await window.electronAPI.getDocumentById(editId);
      const currentItems = await window.electronAPI.getDocumentItems(editId);

      // Create a new invoice with the same data
      const invoiceData = {
        type: 'INVOICE',
        customer_id: currentDoc.customer_id,
        currency: currentDoc.currency,
        bank_account_id: currentDoc.bank_account_id || null,
        related_inv_number: null,
        related_inv_date: null,
        issue_date: currentDoc.issue_date,
        tax_event_date: currentDoc.tax_event_date,
        status: 'unpaid', // Start as unpaid
        vat_rate: currentDoc.vat_rate,
        exemption_reason: currentDoc.exemption_reason,
        correction_reason: null,
        total_net: currentDoc.total_net,
        total_vat: currentDoc.total_vat,
        total_gross: currentDoc.total_gross,
        pdf_path: null
      };

      // Create the new invoice
      const result = await window.electronAPI.finalizeNewDocument(invoiceData, currentItems);

      // Update the proforma invoice status to unpaid as requested
      await window.electronAPI.updateDocumentStatus(editId, 'unpaid');

      alert(t('messages.proformaInvoiceConverted', { docNumber: result.doc_number }));

      if (onComplete) onComplete();
    } catch (error) {
      console.error('Error converting proforma invoice to real invoice:', error);
      alert(t('messages.errorConvertingProformaInvoice'));
    }
  };


  const handleDuplicate = async () => {
    try {
      const documentData = {
        type: 'PROFORMA_INVOICE',
        customer_id: formData.customer_id,
        currency: formData.currency,
        bank_account_id: formData.bank_account_id || null,
        related_inv_number: null,
        related_inv_date: null,
        issue_date: new Date().toISOString().split('T')[0],
        tax_event_date: new Date().toISOString().split('T')[0],
        status: 'draft',
        vat_rate: formData.vat_rate,
        exemption_reason: formData.vat_rate === 0 ? formData.exemption_reason : null,
        correction_reason: null,
        total_net: formData.total_net,
        total_vat: formData.total_vat,
        total_gross: formData.total_gross,
        pdf_path: null
      };

      const itemsToDuplicate = items.map(({ id, ...rest }) => rest);

      await window.electronAPI.createDocument(documentData, itemsToDuplicate);
      alert(t('messages.documentDuplicated'));

      if (onComplete) onComplete();
    } catch (error) {
      console.error('Error duplicating proforma invoice:', error);
      alert(t('messages.errorDuplicatingDocument'));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (editId) {
      // For editing, update the document (keeps current status)
      return handleUpdate();
    } else {
      // For new proforma invoices, finalize by default
      return handleFinalize();
    }
  };

  const createProductAndAddToItem = async () => {
    if (!newProductName || !newProductPrice) {
      alert(t('messages.enterProductNamePrice'));
      return;
    }

    try {
      const productData = {
        name: newProductName,
        default_price: parseFloat(newProductPrice),
        unit: newProductUnit
      };

      const newProduct = await window.electronAPI.createProduct(productData);
      setProducts(prev => [...prev, newProduct]);

      // Add the new product to the last item in the list
      const newItems = [...items];
      const lastIndex = newItems.length - 1;
      newItems[lastIndex].name = newProduct.name;
      newItems[lastIndex].price = newProduct.default_price;
      newItems[lastIndex].unit = newProduct.unit;
      newItems[lastIndex].total = parseFloat(newItems[lastIndex].qty) * newProduct.default_price;

      setItems(newItems);
      calculateTotals(newItems);

      // Reset modal form
      setNewProductName('');
      setNewProductPrice('');
      setNewProductUnit('pcs');
      setShowProductModal(false);
    } catch (error) {
      console.error('Error creating product:', error);
      alert(t('messages.errorCreatingProduct'));
    }
  };

  const openVatCalculator = (index) => {
    setCurrentVatItemIndex(index);
    setGrossPriceInput('');
    setShowVatCalculator(true);
  };

  const applyGrossPrice = () => {
    if (currentVatItemIndex === null || grossPriceInput === '') return;

    const grossPrice = parseFloat(grossPriceInput);
    if (isNaN(grossPrice)) return;

    const vatRate = parseFloat(formData.vat_rate) || 0;
    const netPrice = grossPrice / (1 + (vatRate / 100));

    handleItemChange(currentVatItemIndex, 'price', netPrice.toFixed(2));

    setShowVatCalculator(false);
    setCurrentVatItemIndex(null);
    setGrossPriceInput('');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {editId ? (isFinalized ? t('documents.proforma.editTitle') + ` ${docNumber}` : t('documents.proforma.editDraftTitle')) : t('documents.proforma.title')}
        </h1>
        {!editId && nextInvoiceNumber && (
          <div className="text-sm text-gray-500">
            {t('documents.proforma.nextNumber')} <span className="font-medium text-gray-900">{nextInvoiceNumber}</span>
          </div>
        )}
        {editId && isFinalized && docNumber && (
          <div className="text-sm text-gray-500">
            {t('documents.proforma.proformaNumber')} <span className="font-medium text-gray-900">{docNumber}</span>
          </div>
        )}
      </div>

      <div className="space-y-6">
        <form onSubmit={handleSubmit}>
          {/* Client Info Section */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900 mb-4">{t('invoices.clientInfo')}</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label htmlFor="customer_id" className="block text-sm font-medium text-gray-700">
                  {t('invoices.customer')}
                </label>
                <div className="mt-1">
                  <select
                    id="customer_id"
                    name="customer_id"
                    value={formData.customer_id}
                    onChange={handleInputChange}
                    className="form-select block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    required
                  >
                    <option value="">{t('messages.selectCustomer')}</option>
                    {customers.map(customer => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="currency" className="block text-sm font-medium text-gray-700">
                  {t('invoices.currency')}
                </label>
                <div className="mt-1">
                  <select
                    id="currency"
                    name="currency"
                    value={formData.currency}
                    onChange={handleInputChange}
                    className="form-select block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    required
                  >
                    <option value="EUR">EUR (€)</option>
                    <option value="USD">USD ($)</option>
                    <option value="BGN">BGN (лв)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="bank_account_id" className="block text-sm font-medium text-gray-700">
                  {t('invoices.bankAccount')}
                </label>
                <div className="mt-1">
                  <select
                    id="bank_account_id"
                    name="bank_account_id"
                    value={formData.bank_account_id}
                    onChange={handleInputChange}
                    className="form-select block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                  >
                    <option value="">{t('invoices.selectBankAccountLabel')}</option>
                    {getFilteredBankAccounts().map(account => (
                      <option key={account.id} value={account.id}>
                        {account.nickname ? `${account.nickname} (${account.iban})` : account.iban}
                      </option>
                    ))}
                  </select>
                </div>
                {getFilteredBankAccounts().length === 0 && (
                  <p className="mt-1 text-sm text-gray-500">
                    {t('invoices.noBankAccountsAvailable')} {formData.currency}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Document Details Section */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900 mb-4">{t('invoices.documentDetails')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                  {t('invoices.status')}
                </label>
                <div className="mt-1">
                  <select
                    id="status"
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="form-select block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    disabled={isFinalized} // Disable status change for finalized invoices
                  >
                    <option value="draft">{t('documents.proforma.status.draft')}</option>
                    <option value="unpaid">{t('documents.proforma.status.unpaid')}</option>
                    <option value="paid">{t('documents.proforma.status.paid')}</option>
                    <option value="cancelled">{t('documents.proforma.status.cancelled')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="vat_rate" className="block text-sm font-medium text-gray-700">
                  {t('invoices.vatRate')}
                </label>
                <div className="mt-1">
                  <select
                    id="vat_rate"
                    name="vat_rate"
                    value={formData.vat_rate}
                    onChange={handleVatRateChange}
                    className="form-select block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                  >
                    <option value="20">20%</option>
                    <option value="9">9%</option>
                    <option value="0">0%</option>
                  </select>
                </div>
              </div>
            </div>

            {formData.vat_rate === 0 && (
              <div className="mt-4">
                <label htmlFor="exemption_reason" className="block text-sm font-medium text-gray-700">
                  {t('invoices.exemptionReason')}
                </label>
                <div className="mt-1">
                  <select
                    id="exemption_reason"
                    name="exemption_reason"
                    value={formData.exemption_reason}
                    onChange={handleInputChange}
                    className="form-select block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    required={formData.vat_rate === 0}
                  >
                    <option value="">{t('invoices.selectExemptionReason')}</option>
                    <option value="Art. 21, para. 2 VATA">{t('invoices.exemptionReasons.intraEU')}</option>
                    <option value="Art. 22, para. 1 VATA">{t('invoices.exemptionReasons.export')}</option>
                    <option value="Art. 27, para. 1 VATA">{t('invoices.exemptionReasons.outsideEU')}</option>
                    <option value="Other">{t('invoices.exemptionReasons.other')}</option>
                  </select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label htmlFor="issue_date" className="block text-sm font-medium text-gray-700">
                  {t('invoices.issueDate')}
                </label>
                <div className="mt-1">
                  <input
                    type="date"
                    name="issue_date"
                    id="issue_date"
                    value={formData.issue_date}
                    onChange={handleInputChange}
                    className="form-input block w-full sm:text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="tax_event_date" className="block text-sm font-medium text-gray-700">
                  {t('invoices.taxEventDate')}
                </label>
                <div className="mt-1">
                  <input
                    type="date"
                    name="tax_event_date"
                    id="tax_event_date"
                    value={formData.tax_event_date}
                    onChange={handleInputChange}
                    className="form-input block w-full sm:text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Line Items Section */}
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="overflow-x-auto">
              <table className="table min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('invoices.productService')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('invoices.unit')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('invoices.quantity')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('invoices.priceUnit')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('invoices.totalPrice')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('invoices.actions')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {items.map((item, index) => (
                    <tr key={item.id} className="invoice-item-row">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                          className="form-input block w-full sm:text-sm"
                          placeholder={t('invoices.productName')}
                          list="products"
                        />
                        <datalist id="products">
                          {products.map(product => (
                            <option key={product.id} value={product.name} />
                          ))}
                        </datalist>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={item.unit || ''}
                          onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                          className="form-select block w-full sm:text-sm rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        >
                          <option value="">{t('units.select')}</option>
                          <option value="pcs">{t('units.pcs')}</option>
                          <option value="kg">{t('units.kg')}</option>
                          <option value="m">{t('units.m')}</option>
                          <option value="hours">{t('units.hours')}</option>
                          <option value="unit">{t('units.unit')}</option>
                          <option value="l">{t('units.l')}</option>
                          <option value="other">{t('units.other')}</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="number"
                          value={item.qty}
                          onChange={(e) => handleItemChange(index, 'qty', e.target.value)}
                          className="form-input block w-full sm:text-sm"
                          min="0.01"
                          step="0.01"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="relative flex items-center">
                          <input
                            type="number"
                            value={item.price}
                            onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                            className="form-input block w-full pr-8 sm:text-sm"
                            min="0"
                            step="0.01"
                          />
                          <button
                            type="button"
                            onClick={() => openVatCalculator(index)}
                            className="absolute right-2 p-1 text-gray-400 hover:text-blue-500"
                            title={t('invoices.calculateFromGross')}
                          >
                            <Banknote size={16} />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {item.total?.toLocaleString('en-US', { style: 'currency', currency: 'EUR' })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="text-red-600 hover:text-red-900"
                          disabled={items.length <= 1}
                        >
                          {t('invoices.remove')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={addNewItem}
                className="btn-secondary inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                {t('invoices.addItem')}
              </button>
              <button
                type="button"
                onClick={() => setShowProductModal(true)}
                className="btn-secondary ml-2 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                {t('invoices.addNewProduct')}
              </button>
            </div>
          </div>

          {/* Legal Footnotes Section */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900 mb-4">{t('invoices.legalFootnotes')}</h3>
            <div className="text-sm text-gray-500">
              {t('documents.proforma.notFiscal') || 'Proforma invoice - not a fiscal document'}
            </div>
          </div>

          {/* Totals */}
          <div className="mt-8 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <label className="block text-sm font-medium text-gray-700">{t('invoices.totalNet')}</label>
              <div className="mt-1 text-lg font-semibold text-gray-900">
                {formData.total_net?.toLocaleString('en-US', { style: 'currency', currency: formData.currency })}
              </div>
            </div>
            <div className="sm:col-span-1">
              <label className="block text-sm font-medium text-gray-700">{t('invoices.totalVat')}</label>
              <div className="mt-1 text-lg font-semibold text-gray-900">
                {formData.total_vat?.toLocaleString('en-US', { style: 'currency', currency: formData.currency })}
              </div>
            </div>
            <div className="sm:col-span-1">
              <label className="block text-sm font-medium text-gray-700">{t('invoices.totalGross')}</label>
              <div className="mt-1 text-lg font-semibold text-gray-900">
                {formData.total_gross?.toLocaleString('en-US', { style: 'currency', currency: formData.currency })}
              </div>
            </div>
          </div>

          <div className="mt-6">
            {!editId ? (
              /* Creating new proforma invoice */
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="btn-secondary inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  {t('invoices.saveDraft')}
                </button>
                <button
                  type="button"
                  onClick={handleFinalize}
                  className="btn-primary inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  {t('invoices.finalizeInvoice')}
                </button>
              </div>
            ) : isFinalized ? (
              /* Editing finalized proforma invoice */
              <div className="flex space-x-4">
                <button
                  type="submit"
                  className="btn-primary inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  {t('invoices.updateInvoice')}
                </button>
                <button
                  type="button"
                  onClick={handleConvertToInvoice}
                  className="btn-secondary inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  {t('documents.proforma.convertToInvoice')}
                </button>
                <button
                  type="button"
                  onClick={handleDuplicate}
                  className="btn-secondary inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  {t('common.duplicate')}
                </button>
              </div>
            ) : (
              /* Editing draft proforma invoice - allow both save and finalize */
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={handleSaveDraftWhenEditing}
                  className="btn-secondary inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  {t('invoices.saveDraft')}
                </button>
                <button
                  type="button"
                  onClick={handleFinalizeWhenEditing}
                  className="btn-primary inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  {t('invoices.finalizeInvoice')}
                </button>
                <button
                  type="button"
                  onClick={handleDuplicate}
                  className="btn-secondary inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  {t('common.duplicate')}
                </button>
              </div>
            )}
          </div>
        </form>
      </div>

      {/* Add Product Modal */}
      {showProductModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">{t('invoices.addNewProduct')}</h3>
                    <form>
                      <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <label htmlFor="newProductName" className="block text-sm font-medium text-gray-700">
                            {t('invoices.productName')}
                          </label>
                          <div className="mt-1">
                            <input
                              type="text"
                              id="newProductName"
                              name="newProductName"
                              value={newProductName}
                              onChange={(e) => setNewProductName(e.target.value)}
                              className="form-input block w-full sm:text-sm"
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <label htmlFor="newProductPrice" className="block text-sm font-medium text-gray-700">
                            {t('invoices.priceUnit')}
                          </label>
                          <div className="mt-1">
                            <input
                              type="number"
                              id="newProductPrice"
                              name="newProductPrice"
                              value={newProductPrice}
                              onChange={(e) => setNewProductPrice(e.target.value)}
                              className="form-input block w-full sm:text-sm"
                              step="0.01"
                              min="0"
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <label htmlFor="newProductUnit" className="block text-sm font-medium text-gray-700">
                            {t('invoices.unit')}
                          </label>
                          <div className="mt-1">
                            <select
                              id="newProductUnit"
                              name="newProductUnit"
                              value={newProductUnit}
                              onChange={(e) => setNewProductUnit(e.target.value)}
                              className="form-select block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                            >
                              <option value="pcs">{t('units.pcs')}</option>
                              <option value="kg">{t('units.kg')}</option>
                              <option value="m">{t('units.m')}</option>
                              <option value="hours">{t('units.hours')}</option>
                              <option value="unit">{t('units.unit')}</option>
                              <option value="l">{t('units.l')}</option>
                              <option value="other">{t('units.other')}</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={createProductAndAddToItem}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  {t('invoices.addProductButton')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* VAT Calculator Modal */}
      {showVatCalculator && (
        <div className="fixed z-20 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true" onClick={() => setShowVatCalculator(false)}>
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-sm sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4 flex items-center">
                  <Banknote className="mr-2" size={20} />
                  {t('invoices.vatInclusiveCalculator')}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="gross_price" className="block text-sm font-medium text-gray-700">
                      {t('invoices.grossPrice')} ({formData.currency})
                    </label>
                    <div className="mt-1">
                      <input
                        type="number"
                        id="gross_price"
                        className="form-input block w-full sm:text-sm"
                        value={grossPriceInput}
                        onChange={(e) => setGrossPriceInput(e.target.value)}
                        placeholder="0.00"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && applyGrossPrice()}
                      />
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      {t('invoices.vatRateUsed')}: {formData.vat_rate}%
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={applyGrossPrice}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  {t('common.apply')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowVatCalculator(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
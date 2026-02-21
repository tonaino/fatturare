import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export const CreateCreditNote = ({ editId, onComplete }) => {
  const { t } = useTranslation();
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    customer_id: '',
    related_invoice_id: '',
    issue_date: new Date().toISOString().split('T')[0],
    tax_event_date: new Date().toISOString().split('T')[0],
    status: 'unpaid',
    vat_rate: 20,
    exemption_reason: '',
    correction_reason: '',
    total_net: 0,
    total_vat: 0,
    total_gross: 0
  });
  const [items, setItems] = useState([
    { id: Date.now(), name: '', qty: 1, price: 0, total: 0 }
  ]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductUnit, setNewProductUnit] = useState('pcs');
  const [showProductModal, setShowProductModal] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, [editId]);

  const loadInitialData = async () => {
    try {
      const [customersData, productsData, documentsData] = await Promise.all([
        window.electronAPI.getCustomers(),
        window.electronAPI.getProducts(),
        window.electronAPI.getDocuments()
      ]);

      // Filter only invoices for the related invoice dropdown
      const invoicesData = documentsData.filter(doc => doc.type === 'INVOICE');

      setCustomers(customersData.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })));
      setProducts(productsData);
      setInvoices(invoicesData);

      if (editId) {
        const doc = await window.electronAPI.getDocumentById(editId);
        const docItems = await window.electronAPI.getDocumentItems(editId);

        setFormData({
          customer_id: doc.customer_id || '',
          related_invoice_id: invoices.find(inv => inv.doc_number === doc.related_inv_number)?.id || '',
          issue_date: doc.issue_date,
          tax_event_date: doc.tax_event_date,
          status: doc.status,
          vat_rate: doc.vat_rate,
          exemption_reason: doc.exemption_reason || '',
          correction_reason: doc.correction_reason || '',
          total_net: doc.total_net,
          total_vat: doc.total_vat,
          total_gross: doc.total_gross
        });
        setItems(docItems.map(item => ({ ...item, id: item.id || Date.now() })));
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleInvoiceChange = (e) => {
    const invoiceId = parseInt(e.target.value);
    setFormData(prev => ({
      ...prev,
      related_invoice_id: invoiceId
    }));

    // Find and set the selected invoice data to auto-populate customer and items
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (invoice) {
      setSelectedInvoice(invoice);
      setFormData(prev => ({
        ...prev,
        customer_id: invoice.customer_id, // This would be implemented if we store customer_id in documents
        issue_date: new Date().toISOString().split('T')[0],
        tax_event_date: new Date().toISOString().split('T')[0]
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
    setFormData(prev => ({
      ...prev,
      vat_rate: value,
      exemption_reason: value === 0 ? prev.exemption_reason : ''
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.vat_rate === 0 && !formData.exemption_reason) {
      alert('Please select an exemption reason for 0% VAT rate');
      return;
    }

    if (!formData.correction_reason) {
      alert('Please provide a correction reason');
      return;
    }

    try {
      // Get the related invoice details if one was selected
      let relatedInvoiceNumber = null;
      let relatedInvoiceDate = null;

      if (formData.related_invoice_id) {
        const relatedInvoice = invoices.find(inv => inv.id === formData.related_invoice_id);
        if (relatedInvoice) {
          relatedInvoiceNumber = relatedInvoice.doc_number;
          relatedInvoiceDate = relatedInvoice.issue_date;
        }
      }

      // Prepare document data
      const documentData = {
        type: 'CREDIT_NOTE',
        customer_id: formData.customer_id,
        related_inv_number: relatedInvoiceNumber,
        related_inv_date: relatedInvoiceDate,
        issue_date: formData.issue_date,
        tax_event_date: formData.tax_event_date,
        status: formData.status,
        vat_rate: formData.vat_rate,
        exemption_reason: formData.vat_rate === 0 ? formData.exemption_reason : null,
        correction_reason: formData.correction_reason,
        total_net: formData.total_net,
        total_vat: formData.total_vat,
        total_gross: formData.total_gross,
        pdf_path: null // Will be set when PDF is generated
      };

      let result;
      if (editId) {
        // Keep existing doc_number when editing
        const existingDoc = await window.electronAPI.getDocumentById(editId);
        documentData.doc_number = existingDoc.doc_number;

        result = await window.electronAPI.updateDocument(editId, documentData, items);
        alert(`Credit Note ${result.doc_number} updated successfully!`);
      } else {
        documentData.doc_number = await window.electronAPI.getNextDocumentNumber('CREDIT_NOTE');
        result = await window.electronAPI.createDocument(documentData, items);
        alert(`Credit Note ${result.doc_number} created successfully!`);
      }

      if (onComplete) onComplete();

      // Reset form
      setFormData({
        customer_id: '',
        related_invoice_id: '',
        issue_date: new Date().toISOString().split('T')[0],
        tax_event_date: new Date().toISOString().split('T')[0],
        status: 'unpaid',
        vat_rate: 20,
        exemption_reason: '',
        correction_reason: '',
        total_net: 0,
        total_vat: 0,
        total_gross: 0
      });
      setItems([{ id: Date.now(), name: '', qty: 1, price: 0, total: 0 }]);
      setSelectedInvoice(null);
    } catch (error) {
      console.error('Error creating credit note:', error);
      alert('Error creating credit note');
    }
  };

  const createProductAndAddToItem = async () => {
    if (!newProductName || !newProductPrice) {
      alert('Please enter product name and price');
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
      alert('Error creating product');
    }
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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create New Credit Note</h1>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              <div className="sm:col-span-3">
                <label htmlFor="related_invoice_id" className="block text-sm font-medium text-gray-700">
                  Related Invoice (Optional)
                </label>
                <div className="mt-1">
                  <select
                    id="related_invoice_id"
                    name="related_invoice_id"
                    value={formData.related_invoice_id}
                    onChange={handleInvoiceChange}
                    className="form-select block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                  >
                    <option value="">Select a related invoice</option>
                    {invoices.map(invoice => (
                      <option key={invoice.id} value={invoice.id}>
                        {invoice.doc_number} - {new Date(invoice.issue_date).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="sm:col-span-3">
                <label htmlFor="customer_id" className="block text-sm font-medium text-gray-700">
                  Customer
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
                    <option value="">Select a customer</option>
                    {customers.map(customer => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="sm:col-span-3">
                <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                  Status
                </label>
                <div className="mt-1">
                  <select
                    id="status"
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="form-select block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                  >
                    <option value="unpaid">Unpaid</option>
                    <option value="paid">Paid</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div className="sm:col-span-3">
                <label htmlFor="correction_reason" className="block text-sm font-medium text-gray-700">
                  Correction Reason
                </label>
                <div className="mt-1">
                  <select
                    id="correction_reason"
                    name="correction_reason"
                    value={formData.correction_reason}
                    onChange={handleInputChange}
                    className="form-select block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    required
                  >
                    <option value="">Select correction reason</option>
                    <option value="Cancelled invoice">Cancelled invoice</option>
                    <option value="Price correction">Price correction</option>
                    <option value="Quantity correction">Quantity correction</option>
                    <option value="Product return">Product return</option>
                    <option value="Discount">Discount</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="sm:col-span-3">
                <label htmlFor="issue_date" className="block text-sm font-medium text-gray-700">
                  Issue Date
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

              <div className="sm:col-span-3">
                <label htmlFor="tax_event_date" className="block text-sm font-medium text-gray-700">
                  Tax Event Date
                </label>
                <div className="mt-1">
                  <input
                    type="date"
                    name="tax_event_date"
                    id="tax_event_date"
                    value={formData.tax_event_date}
                    onChange={handleInputChange}
                    className="form-input block w-full sm:text-sm"
                    required
                  />
                </div>
              </div>

              <div className="sm:col-span-3">
                <label htmlFor="vat_rate" className="block text-sm font-medium text-gray-700">
                  VAT Rate (%)
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

              {formData.vat_rate === 0 && (
                <div className="sm:col-span-3">
                  <label htmlFor="exemption_reason" className="block text-sm font-medium text-gray-700">
                    Exemption Reason
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
                      <option value="">Select exemption reason</option>
                      <option value="Art. 21, para. 2 VATA">Art. 21, para. 2 VATA - Intra-EU supply</option>
                      <option value="Art. 22, para. 1 VATA">Art. 22, para. 1 VATA - Export outside EU</option>
                      <option value="Art. 27, para. 1 VATA">Art. 27, para. 1 VATA - Services outside EU</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Items Section */}
            <div className="mt-8">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Credit Note Items</h3>

              <div className="overflow-x-auto">
                <table className="table min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product/Service</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price (EUR)</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total (EUR)</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
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
                            placeholder="Product name"
                            list="products"
                          />
                          <datalist id="products">
                            {products.map(product => (
                              <option key={product.id} value={product.name} />
                            ))}
                          </datalist>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="number"
                            value={item.qty}
                            onChange={(e) => handleItemChange(index, 'qty', e.target.value)}
                            className="form-input block w-full sm:text-sm"
                            min="0.01"
                            step="0.01"
                            placeholder="0.00"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="number"
                            value={item.price}
                            onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                            className="form-input block w-full sm:text-sm"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                          />
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
                            Remove
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
                  Add Item
                </button>
                <button
                  type="button"
                  onClick={() => setShowProductModal(true)}
                  className="btn-secondary ml-2 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  Add New Product
                </button>
              </div>
            </div>

            {/* Totals */}
            <div className="mt-8 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-3">
              <div className="sm:col-span-1">
                <label className="block text-sm font-medium text-gray-700">Total Net (EUR)</label>
                <div className="mt-1 text-lg font-semibold text-gray-900">
                  {formData.total_net?.toLocaleString('en-US', { style: 'currency', currency: 'EUR' })}
                </div>
              </div>
              <div className="sm:col-span-1">
                <label className="block text-sm font-medium text-gray-700">Total VAT (EUR)</label>
                <div className="mt-1 text-lg font-semibold text-gray-900">
                  {formData.total_vat?.toLocaleString('en-US', { style: 'currency', currency: 'EUR' })}
                </div>
              </div>
              <div className="sm:col-span-1">
                <label className="block text-sm font-medium text-gray-700">Total Gross (EUR)</label>
                <div className="mt-1 text-lg font-semibold text-gray-900">
                  {formData.total_gross?.toLocaleString('en-US', { style: 'currency', currency: 'EUR' })}
                </div>
              </div>
            </div>

            <div className="mt-6">
              <button
                type="submit"
                className="btn-primary inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Create Credit Note
              </button>
            </div>
          </form>
        </div>
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
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Add New Product</h3>
                    <form>
                      <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <label htmlFor="newProductName" className="block text-sm font-medium text-gray-700">
                            Product Name
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
                            Default Price (EUR)
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
                            Unit
                          </label>
                          <div className="mt-1">
                            <select
                              id="newProductUnit"
                              name="newProductUnit"
                              value={newProductUnit}
                              onChange={(e) => setNewProductUnit(e.target.value)}
                              className="form-select block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                            >
                              <option value="pcs">Pieces (pcs)</option>
                              <option value="kg">Kilograms (kg)</option>
                              <option value="m">Meters (m)</option>
                              <option value="hours">Hours</option>
                              <option value="unit">Unit</option>
                              <option value="l">Liters (l)</option>
                              <option value="other">Other</option>
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
                  Add Product
                </button>
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

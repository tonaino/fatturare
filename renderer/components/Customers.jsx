import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export const Customers = () => {
  const { t } = useTranslation();
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [viewingCustomer, setViewingCustomer] = useState(null);
  const [customerInvoices, setCustomerInvoices] = useState([]);
  const [showViewModal, setShowViewModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    bulstat: '',
    vat_id: '',
    mol: '',
    default_template: 'BG',
    default_currency: 'EUR'
  });

  useEffect(() => {
    loadCustomers();
  }, []);

  // Filter customers based on search term
  useEffect(() => {
    if (searchTerm) {
      const filtered = customers.filter(customer =>
        customer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.bulstat?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.vat_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.mol?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredCustomers(filtered);
    } else {
      setFilteredCustomers(customers);
    }
  }, [customers, searchTerm]);

  const loadCustomers = async () => {
    try {
      const data = await window.electronAPI.getCustomers();
      setCustomers(data);
    } catch (error) {
      console.error('Error loading customers:', error);
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

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    try {
      if (editingCustomer) {
        await window.electronAPI.updateCustomer(editingCustomer.id, formData);
      } else {
        await window.electronAPI.createCustomer(formData);
      }

      // Reset form and reload customers
      setFormData({
        name: '',
        address: '',
        bulstat: '',
        vat_id: '',
        mol: '',
        default_template: 'BG',
        default_currency: 'EUR'
      });
      setShowForm(false);
      setEditingCustomer(null);
      loadCustomers();
    } catch (error) {
      console.error('Error saving customer:', error);
      alert(t('messages.errorSavingCustomer'));
    }
  };

  const startEditing = (customer) => {
    setFormData({
      name: customer.name || '',
      address: customer.address || '',
      bulstat: customer.bulstat || '',
      vat_id: customer.vat_id || '',
      mol: customer.mol || '',
      default_template: customer.default_template || 'BG',
      default_currency: customer.default_currency || 'EUR'
    });
    setEditingCustomer(customer);
    setShowForm(true);
  };

  const deleteCustomer = async (id) => {
    if (window.confirm(t('customers.confirmDelete'))) {
      try {
        await window.electronAPI.deleteCustomer(id);
        loadCustomers();
      } catch (error) {
        console.error('Error deleting customer:', error);
        alert(t('messages.errorDeletingCustomer'));
      }
    }
  };

  const viewCustomer = async (customer) => {
    try {
      // Get all documents and filter by customer_id
      const allDocuments = await window.electronAPI.getDocuments();
      const customerInvoices = allDocuments.filter(doc => doc.customer_id === customer.id);

      setViewingCustomer(customer);
      setCustomerInvoices(customerInvoices);
      setShowViewModal(true);
    } catch (error) {
      console.error('Error loading customer invoices:', error);
      alert(t('messages.errorLoadingCustomerInvoices'));
    }
  };

  const closeViewModal = () => {
    setShowViewModal(false);
    setViewingCustomer(null);
    setCustomerInvoices([]);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingCustomer(null);
    setFormData({
      name: '',
      address: '',
      bulstat: '',
      vat_id: '',
      mol: '',
      default_template: 'BG',
      default_currency: 'EUR'
    });
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
        <h1 className="text-2xl font-bold text-gray-900">{t('customers.title')}</h1>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          {t('customers.addCustomer')}
        </button>
      </div>

      {showForm && (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              {editingCustomer ? t('customers.editCustomer') : t('customers.addNewCustomer')}
            </h3>
          </div>
          <div className="px-4 py-5 sm:p-6">
            <form onSubmit={handleFormSubmit}>
              <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                <div className="sm:col-span-6">
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    {t('customers.customerName')}
                  </label>
                  <div className="mt-1">
                    <input
                      type="text"
                      name="name"
                      id="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="form-input block w-full sm:text-sm"
                      required
                    />
                  </div>
                </div>

                <div className="sm:col-span-6">
                  <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                    {t('settings.address')}
                  </label>
                  <div className="mt-1">
                    <textarea
                      id="address"
                      name="address"
                      rows={3}
                      value={formData.address}
                      onChange={handleInputChange}
                      className="form-input block w-full sm:text-sm"
                    />
                  </div>
                </div>

                <div className="sm:col-span-3">
                  <label htmlFor="bulstat" className="block text-sm font-medium text-gray-700">
                    {t('settings.bulstat')}
                  </label>
                  <div className="mt-1">
                    <input
                      type="text"
                      name="bulstat"
                      id="bulstat"
                      value={formData.bulstat}
                      onChange={handleInputChange}
                      className="form-input block w-full sm:text-sm"
                    />
                  </div>
                </div>

                <div className="sm:col-span-3">
                  <label htmlFor="vat_id" className="block text-sm font-medium text-gray-700">
                    {t('settings.vatId')}
                  </label>
                  <div className="mt-1">
                    <input
                      type="text"
                      name="vat_id"
                      id="vat_id"
                      value={formData.vat_id}
                      onChange={handleInputChange}
                      className="form-input block w-full sm:text-sm"
                    />
                  </div>
                </div>

                <div className="sm:col-span-6">
                  <label htmlFor="mol" className="block text-sm font-medium text-gray-700">
                    {t('customers.accountablePerson')}
                  </label>
                  <div className="mt-1">
                    <input
                      type="text"
                      name="mol"
                      id="mol"
                      value={formData.mol}
                      onChange={handleInputChange}
                      className="form-input block w-full sm:text-sm"
                    />
                  </div>
                </div>

                <div className="sm:col-span-3">
                  <label htmlFor="default_template" className="block text-sm font-medium text-gray-700">
                    {t('customers.defaultTemplate')}
                  </label>
                  <div className="mt-1">
                    <select
                      id="default_template"
                      name="default_template"
                      value={formData.default_template}
                      onChange={handleInputChange}
                      className="form-select block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    >
                      <option value="BG">{t('customers.filters.bgOnly')}</option>
                      <option value="BILINGUAL">{t('customers.filters.bilingual')}</option>
                    </select>
                  </div>
                </div>

                <div className="sm:col-span-3">
                  <label htmlFor="default_currency" className="block text-sm font-medium text-gray-700">
                    {t('customers.defaultCurrency')}
                  </label>
                  <div className="mt-1">
                    <select
                      id="default_currency"
                      name="default_currency"
                      value={formData.default_currency}
                      onChange={handleInputChange}
                      className="form-select block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    >
                      <option value="EUR">EUR (€)</option>
                      <option value="USD">USD ($)</option>
                      <option value="BGN">BGN (лв)</option>
                      <option value="GBP">GBP (£)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex space-x-4">
                <button
                  type="submit"
                  className="btn-primary inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  {editingCustomer ? t('customers.updateCustomer') : t('customers.addCustomer')}
                </button>
                <button
                  type="button"
                  onClick={cancelForm}
                  className="btn-secondary inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  {t('settings.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          {customers.length > 0 && (
            <div className="mt-4 flex">
              <div className="flex-1 max-w-lg">
                <label htmlFor="search" className="sr-only">{t('customers.searchPlaceholder')}</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    name="search"
                    id="search"
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder={t('customers.searchPlaceholder')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="px-4 py-5 sm:p-6">
          {customers.length > 0 ? (
            <div className="overflow-x-auto">
              {filteredCustomers.length > 0 ? (
                <table className="table min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('products.name')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('settings.bulstat')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('settings.vatId')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('customers.defaultTemplate')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('settings.currency')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('settings.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredCustomers.map((customer) => (
                      <tr key={customer.id} className="invoice-item-row">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{customer.bulstat || '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{customer.vat_id || '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">
                            {customer.default_template === 'BG' ? t('customers.filters.bgOnly') : t('customers.filters.bilingual')}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{customer.default_currency || 'EUR'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => viewCustomer(customer)}
                              className="text-blue-600 hover:text-blue-900 p-1 rounded tooltip"
                              title={t('customers.viewDetails')}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                              </svg>
                            </button>
                            <button
                              onClick={() => startEditing(customer)}
                              className="text-indigo-600 hover:text-indigo-900 p-1 rounded tooltip"
                              title={t('customers.editCustomer')}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                              </svg>
                            </button>
                            <button
                              onClick={() => deleteCustomer(customer.id)}
                              className="text-red-600 hover:text-red-900 p-1 rounded tooltip"
                              title={t('customers.deleteCustomer')}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-24">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                  </svg>
                  <h3 className="mt-4 text-lg font-medium text-gray-900">{t('customers.noCustomersFound')}</h3>
                  <p className="mt-2 text-sm text-gray-500 max-w-sm mx-auto">
                    {t('customers.adjustSearch')}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-24">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"></path>
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">{t('customers.noCustomersYet')}</h3>
              <p className="mt-2 text-sm text-gray-500 max-w-sm mx-auto">
                {t('customers.startAdding')}
              </p>
              <div className="mt-6">
                <button
                  onClick={() => setShowForm(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                  </svg>
                  {t('customers.addCustomer')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Customer View Modal */}
      {showViewModal && viewingCustomer && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                      {t('customers.detailsTitle', { name: viewingCustomer.name })}
                    </h3>

                    {/* Customer Information */}
                    <div className="bg-gray-50 rounded-lg p-4 mb-6">
                      <h4 className="text-md font-medium text-gray-900 mb-3">{t('customers.customerInformation')}</h4>
                      <div className="grid grid-cols-1 gap-y-3 gap-x-4 sm:grid-cols-2">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">{t('products.name')}</label>
                          <p className="mt-1 text-sm text-gray-900">{viewingCustomer.name}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">{t('settings.address')}</label>
                          <p className="mt-1 text-sm text-gray-900">{viewingCustomer.address || t('settings.na')}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">{t('settings.bulstat')}</label>
                          <p className="mt-1 text-sm text-gray-900">{viewingCustomer.bulstat || t('settings.na')}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">{t('settings.vatId')}</label>
                          <p className="mt-1 text-sm text-gray-900">{viewingCustomer.vat_id || t('settings.na')}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">{t('customers.accountablePerson')}</label>
                          <p className="mt-1 text-sm text-gray-900">{viewingCustomer.mol || t('settings.na')}</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">{t('customers.defaultTemplate')}</label>
                          <p className="mt-1 text-sm text-gray-900">
                            {viewingCustomer.default_template === 'BG' ? t('customers.filters.bgOnly') : t('customers.filters.bilingual')}
                          </p>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-medium text-gray-700">{t('customers.defaultCurrency')}</label>
                          <p className="mt-1 text-sm text-gray-900">{viewingCustomer.default_currency || 'EUR'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Customer Invoices */}
                    <div className="mt-6">
                      <h4 className="text-md font-medium text-gray-900 mb-3">
                        {t('customers.invoicesCount', { count: customerInvoices.length })}
                      </h4>

                      {customerInvoices.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('documents.number')}</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('dashboard.totalInvoices')}</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('documents.date')}</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('documents.total')}</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('documents.status')}</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {customerInvoices.map((invoice) => (
                                <tr key={invoice.id}>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">{invoice.doc_number}</div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-500">
                                      {invoice.type === 'INVOICE' ? t('customers.type.invoice') :
                                        invoice.type === 'CREDIT_NOTE' ? t('customers.type.creditNote') :
                                          t('customers.type.proformaInvoice')}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-500">{invoice.issue_date}</div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-500">
                                      {invoice.total_gross?.toLocaleString('en-US', { style: 'currency', currency: 'EUR' })}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                                      ${invoice.status === 'paid' ? 'bg-green-100 text-green-800' :
                                        invoice.status === 'unpaid' ? 'bg-yellow-100 text-yellow-800' :
                                          'bg-red-100 text-red-800'}`}
                                    >
                                      {invoice.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-gray-500 text-center py-8">{t('customers.noInvoices')}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={closeViewModal}
                  className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  {t('settings.close')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

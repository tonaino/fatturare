import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';

// Language options
const LANGUAGE_OPTIONS = [
  { value: 'bg', label: 'Български' },
  { value: 'en', label: 'English' }
];

// Currency options for bank accounts
const CURRENCY_OPTIONS = [
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'USD', label: 'USD ($)' },
  { value: 'BGN', label: 'BGN (лв)' },
  { value: 'GBP', label: 'GBP (£)' }
];

export const CompanySettings = ({ companyInfo, setCompanyInfo }) => {
  const { t, i18n } = useTranslation();
  const [formData, setFormData] = useState({
    name: '',
    bulstat: '',
    vat_id: '',
    address: '',
    mol: '',
    logo_path: ''
  });

  const [invoiceNumbering, setInvoiceNumbering] = useState({
    invoice_start_number: '',
    credit_note_start_number: '',
    proforma_invoice_start_number: ''
  });

  const [loading, setLoading] = useState(false);
  const [numberingLoading, setNumberingLoading] = useState(false);

  // Bank accounts state
  const [bankAccounts, setBankAccounts] = useState([]);
  const [showBankForm, setShowBankForm] = useState(false);
  const [editingBankAccount, setEditingBankAccount] = useState(null);
  const [bankFormData, setBankFormData] = useState({
    currency: 'EUR',
    iban: '',
    bic: '',
    nickname: '',
    bank_name: ''
  });
  const [bankLoading, setBankLoading] = useState(false);

  // Reset Everything state
  const [enableReset, setEnableReset] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (companyInfo) {
      setFormData({
        name: companyInfo.name || '',
        bulstat: companyInfo.bulstat || '',
        vat_id: companyInfo.vat_id || '',
        address: companyInfo.address || '',
        mol: companyInfo.mol || '',
        logo_path: companyInfo.logo_path || ''
      });
    }
  }, [companyInfo]);

  useEffect(() => {
    loadBankAccounts();
  }, []);

  useEffect(() => {
    loadInvoiceNumbering();
  }, []);

  const loadBankAccounts = async () => {
    try {
      const accounts = await window.electronAPI.getBankAccounts();
      setBankAccounts(accounts);
    } catch (error) {
      console.error('Error loading bank accounts:', error);
    }
  };

  const handleBankChange = (e) => {
    const { name, value } = e.target;
    setBankFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleBankSubmit = async (e) => {
    e.preventDefault();
    setBankLoading(true);

    try {
      if (editingBankAccount) {
        await window.electronAPI.updateBankAccount(editingBankAccount.id, bankFormData);
      } else {
        await window.electronAPI.createBankAccount(bankFormData);
      }

      // Reset form and reload accounts
      setShowBankForm(false);
      setEditingBankAccount(null);
      setBankFormData({
        currency: 'EUR',
        iban: '',
        bic: '',
        nickname: ''
      });
      loadBankAccounts();
    } catch (error) {
      console.error('Error saving bank account:', error);
      alert(t('settings.saveBankError'));
    } finally {
      setBankLoading(false);
    }
  };

  const startEditingBankAccount = (account) => {
    setBankFormData({
      currency: account.currency,
      iban: account.iban || '',
      bic: account.bic || '',
      nickname: account.nickname || '',
      bank_name: account.bank_name || ''
    });
    setEditingBankAccount(account);
    setShowBankForm(true);
  };

  const deleteBankAccount = async (id) => {
    if (window.confirm(t('settings.deleteConfirm'))) {
      try {
        await window.electronAPI.deleteBankAccount(id);
        loadBankAccounts();
      } catch (error) {
        console.error('Error deleting bank account:', error);
        alert(t('settings.deleteBankError'));
      }
    }
  };

  const cancelBankForm = () => {
    setShowBankForm(false);
    setEditingBankAccount(null);
    setBankFormData({
      currency: 'EUR',
      iban: '',
      bic: '',
      nickname: '',
      bank_name: ''
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };



  const loadInvoiceNumbering = async () => {
    try {
      const [invoiceStart, creditNoteStart, proformaInvoiceStart] = await Promise.all([
        window.electronAPI.getSetting('invoice_start_number'),
        window.electronAPI.getSetting('credit_note_start_number'),
        window.electronAPI.getSetting('proforma_invoice_start_number')
      ]);

      setInvoiceNumbering({
        invoice_start_number: invoiceStart || '1',
        credit_note_start_number: creditNoteStart || '1',
        proforma_invoice_start_number: proformaInvoiceStart || '1'
      });
    } catch (error) {
      console.error('Error loading invoice numbering:', error);
    }
  };

  const handleNumberingChange = (e) => {
    const { name, value } = e.target;
    setInvoiceNumbering(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleNumberingSubmit = async (e) => {
    e.preventDefault();
    setNumberingLoading(true);

    try {
      await Promise.all([
        window.electronAPI.updateSetting('invoice_start_number', invoiceNumbering.invoice_start_number),
        window.electronAPI.updateSetting('credit_note_start_number', invoiceNumbering.credit_note_start_number),
        window.electronAPI.updateSetting('proforma_invoice_start_number', invoiceNumbering.proforma_invoice_start_number)
      ]);

      alert(t('settings.numberingUpdated'));
    } catch (error) {
      console.error('Error updating numbering settings:', error);
      alert(t('settings.numberingUpdateError'));
    } finally {
      setNumberingLoading(false);
    }
  };

  const handleLanguageChange = (e) => {
    const newLanguage = e.target.value;
    i18n.changeLanguage(newLanguage);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await window.electronAPI.updateCompanyInfo(formData);
      if (result) {
        alert(t('settings.companyUpdated'));
        // Update the company info in the parent component
        setCompanyInfo(formData);
      }
    } catch (error) {
      console.error('Error updating company info:', error);
      alert(t('settings.updateCompanyError'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetClick = async () => {
    // First show confirmation dialog
    setShowExportDialog(true);
  };

  const handleExportConfirm = async () => {
    setShowExportDialog(false);

    try {
      const exportResult = await window.electronAPI.exportDatabase();
      if (!exportResult.success) {
        alert(t('settings.exportDatabaseError'));
        return;
      }
      // Continue to reset
      await performReset();
    } catch (error) {
      console.error('Export error:', error);
      alert(t('settings.exportDatabaseError'));
    }
  };

  const handleSkipExport = async () => {
    setShowExportDialog(false);
    await performReset();
  };

  const performReset = async () => {
    setResetting(true);
    try {
      const result = await window.electronAPI.resetEverything();
      if (result.success) {
        alert(t('settings.resetComplete'));
        // App should restart, so this might not be reached
      } else {
        alert('Error resetting: ' + result.error);
      }
    } catch (error) {
      console.error('Reset error:', error);
      alert('Error resetting: ' + error.message);
    } finally {
      setResetting(false);
    }
  };

  const handleResetDialogClose = () => {
    setShowResetDialog(false);
    setEnableReset(false);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('settings.title')}</h1>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">{t('settings.companyInfo')}</h3>
          <p className="mt-1 text-sm text-gray-500">{t('settings.companyInfoDesc')}</p>
        </div>
        <div className="px-4 py-5 sm:p-6">
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              <div className="sm:col-span-6">
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  {t('settings.companyName')}
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    name="name"
                    id="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="form-input block w-full sm:text-sm"
                    required
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
                    onChange={handleChange}
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
                    onChange={handleChange}
                    className="form-input block w-full sm:text-sm"
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
                    onChange={handleChange}
                    className="form-input block w-full sm:text-sm"
                  />
                </div>
              </div>

              <div className="sm:col-span-6">
                <label htmlFor="mol" className="block text-sm font-medium text-gray-700">
                  {t('settings.accountablePerson')}
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    name="mol"
                    id="mol"
                    value={formData.mol}
                    onChange={handleChange}
                    className="form-input block w-full sm:text-sm"
                  />
                </div>
              </div>

              <div className="sm:col-span-6">
                <label htmlFor="logo_path" className="block text-sm font-medium text-gray-700">
                  {t('settings.logoPath')}
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    name="logo_path"
                    id="logo_path"
                    value={formData.logo_path}
                    onChange={handleChange}
                    className="form-input block w-full sm:text-sm"
                    placeholder={t('settings.logoPathPlaceholder')}
                  />
                </div>
              </div>

              <div className="sm:col-span-6">
                <label htmlFor="language" className="block text-sm font-medium text-gray-700">
                  {t('settings.language')}
                </label>
                <div className="mt-1">
                  <select
                    id="language"
                    name="language"
                    value={i18n.language}
                    onChange={handleLanguageChange}
                    className="form-select block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                  >
                    <option value="bg">{t('settings.bulgarian')}</option>
                    <option value="en">{t('settings.english')}</option>
                  </select>
                </div>
                <p className="mt-2 text-sm text-gray-500">{t('settings.selectLanguage')}</p>
              </div>
            </div>

            <div className="mt-6">
              <button
                type="submit"
                disabled={loading}
                className="btn-primary inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? t('settings.saving') : t('settings.saveChanges')}
              </button>
            </div>
          </form>
        </div>
      </div>



      {/* Bank Accounts Section */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg mt-8">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">{t('settings.bankAccounts')}</h3>
              <p className="mt-1 text-sm text-gray-500">{t('settings.bankAccountsDesc')}</p>
            </div>
            <button
              onClick={() => setShowBankForm(true)}
              className="btn-primary inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {t('settings.addBankAccount')}
            </button>
          </div>
        </div>

        {showBankForm && (
          <div className="px-4 py-5 sm:p-6">
            <form onSubmit={handleBankSubmit}>
              <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                <div className="sm:col-span-3">
                  <label htmlFor="currency" className="block text-sm font-medium text-gray-700">
                    {t('settings.currency')}
                  </label>
                  <div className="mt-1">
                    <select
                      id="currency"
                      name="currency"
                      value={bankFormData.currency}
                      onChange={handleBankChange}
                      className="form-select block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                      required
                    >
                      {CURRENCY_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="sm:col-span-3">
                  <label htmlFor="iban" className="block text-sm font-medium text-gray-700">
                    {t('settings.iban')}
                  </label>
                  <div className="mt-1">
                    <input
                      type="text"
                      name="iban"
                      id="iban"
                      value={bankFormData.iban}
                      onChange={handleBankChange}
                      className="form-input block w-full sm:text-sm"
                      required
                    />
                  </div>
                </div>

                <div className="sm:col-span-6">
                  <label htmlFor="bic" className="block text-sm font-medium text-gray-700">
                    {t('settings.bic')}
                  </label>
                  <div className="mt-1">
                    <input
                      type="text"
                      name="bic"
                      id="bic"
                      value={bankFormData.bic}
                      onChange={handleBankChange}
                      className="form-input block w-full sm:text-sm"
                    />
                  </div>
                </div>

                <div className="sm:col-span-6">
                  <label htmlFor="nickname" className="block text-sm font-medium text-gray-700">
                    {t('settings.nickname')}
                  </label>
                  <div className="mt-1">
                    <input
                      type="text"
                      name="nickname"
                      id="nickname"
                      value={bankFormData.nickname}
                      onChange={handleBankChange}
                      className="form-input block w-full sm:text-sm"
                      placeholder={t('settings.nicknamePlaceholder')}
                    />
                  </div>
                  <p className="mt-2 text-sm text-gray-500">{t('settings.nicknameDesc')}</p>
                </div>

                <div className="sm:col-span-6">
                  <label htmlFor="bank_name" className="block text-sm font-medium text-gray-700">
                    {t('settings.bankName')}
                  </label>
                  <div className="mt-1">
                    <input
                      type="text"
                      name="bank_name"
                      id="bank_name"
                      value={bankFormData.bank_name}
                      onChange={handleBankChange}
                      className="form-input block w-full sm:text-sm"
                      placeholder={t('settings.bankNamePlaceholder')}
                    />
                  </div>
                  <p className="mt-2 text-sm text-gray-500">{t('settings.bankNameDesc')}</p>
                </div>
              </div>

              <div className="mt-6 flex space-x-4">
                <button
                  type="submit"
                  disabled={bankLoading}
                  className="btn-primary inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {bankLoading ? t('settings.saving') : (editingBankAccount ? t('settings.updateAccount') : t('settings.addAccount'))}
                </button>
                <button
                  type="button"
                  onClick={cancelBankForm}
                  className="btn-secondary inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  {t('settings.cancel')}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="px-4 py-5 sm:p-6">
          {bankAccounts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="table min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('settings.currency')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('settings.bankName')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('settings.nickname')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('settings.iban')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('settings.bic')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('settings.actions')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {bankAccounts.map((account) => (
                    <tr key={account.id} className="invoice-item-row">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {CURRENCY_OPTIONS.find(c => c.value === account.currency)?.label || account.currency}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{account.bank_name || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 font-medium">{account.nickname || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{account.iban}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{account.bic || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => startEditingBankAccount(account)}
                          className="text-indigo-600 hover:text-indigo-900 mr-4"
                        >
                          {t('settings.edit')}
                        </button>
                        <button
                          onClick={() => deleteBankAccount(account.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          {t('settings.delete')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500">{t('settings.noBankAccounts')}</p>
          )}
        </div>
      </div>

      {/* Document Numbering Section */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg mt-8">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">{t('settings.documentNumbering')}</h3>
          <p className="mt-1 text-sm text-gray-500">{t('settings.documentNumberingDesc')}</p>
        </div>
        <div className="px-4 py-5 sm:p-6">
          <form onSubmit={handleNumberingSubmit}>
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              <div className="sm:col-span-3">
                <label htmlFor="invoice_start_number" className="block text-sm font-medium text-gray-700">
                  {t('settings.invoiceStartNumber')}
                </label>
                <div className="mt-1">
                  <input
                    type="number"
                    name="invoice_start_number"
                    id="invoice_start_number"
                    value={invoiceNumbering.invoice_start_number}
                    onChange={handleNumberingChange}
                    className="form-input block w-full sm:text-sm"
                    min="1"
                    required
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  {t('settings.invoicePreview', { number: (invoiceNumbering.invoice_start_number || 1).toString().padStart(10, '0') })}
                </p>
              </div>

              <div className="sm:col-span-3">
                <label htmlFor="credit_note_start_number" className="block text-sm font-medium text-gray-700">
                  {t('settings.creditNoteStartNumber')}
                </label>
                <div className="mt-1">
                  <input
                    type="number"
                    name="credit_note_start_number"
                    id="credit_note_start_number"
                    value={invoiceNumbering.credit_note_start_number}
                    onChange={handleNumberingChange}
                    className="form-input block w-full sm:text-sm"
                    min="1"
                    required
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  {t('settings.creditNotePreview', { number: (invoiceNumbering.credit_note_start_number || 1).toString().padStart(10, '0') })}
                </p>
              </div>

              <div className="sm:col-span-3">
                <label htmlFor="proforma_invoice_start_number" className="block text-sm font-medium text-gray-700">
                  {t('settings.proformaInvoiceStartNumber')}
                </label>
                <div className="mt-1">
                  <input
                    type="number"
                    name="proforma_invoice_start_number"
                    id="proforma_invoice_start_number"
                    value={invoiceNumbering.proforma_invoice_start_number}
                    onChange={handleNumberingChange}
                    className="form-input block w-full sm:text-sm"
                    min="1"
                    required
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  {t('settings.proformaInvoicePreview', { number: (invoiceNumbering.proforma_invoice_start_number || 1).toString().padStart(10, '0') })}
                </p>
              </div>
            </div>

            <div className="mt-6">
              <button
                type="submit"
                disabled={numberingLoading}
                className="btn-primary inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {numberingLoading ? t('settings.saving') : t('settings.saveNumbering')}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Reset Everything Section */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg mt-8">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-red-900">{t('settings.resetEverything')}</h3>
          <p className="mt-1 text-sm text-gray-500">{t('settings.resetEverythingDesc')}</p>
        </div>
        <div className="px-4 py-5 sm:p-6">
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                id="enable-reset"
                type="checkbox"
                checked={enableReset}
                onChange={(e) => setEnableReset(e.target.checked)}
                className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
              />
              <label htmlFor="enable-reset" className="ml-2 block text-sm text-gray-900">
                {t('settings.enableReset')}
              </label>
            </div>

            <div>
              <button
                onClick={handleResetClick}
                disabled={!enableReset || resetting}
                className="btn-danger inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resetting ? t('settings.resetting') : t('settings.resetEverythingBtn')}
              </button>
              {!enableReset && <p className="mt-2 text-sm text-gray-500">{t('settings.enableResetDescription')}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Export Before Reset Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('settings.exportBeforeReset')}</DialogTitle>
            <DialogDescription>
              {t('settings.confirmReset')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={handleSkipExport}
              className="btn-secondary inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              {t('settings.skipExportBtn')}
            </button>
            <button
              onClick={handleExportConfirm}
              className="btn-primary inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              {t('settings.exportBtn')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Confirmation Dialog (fallback - but actually using export dialog as main confirmation) */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('settings.confirmReset')}</DialogTitle>
            <DialogDescription>
              {t('settings.confirmReset')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={handleResetDialogClose}
              className="btn-secondary inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              {t('settings.cancel')}
            </button>
            <button
              onClick={() => {
                setShowResetDialog(false);
                performReset();
              }}
              className="btn-danger inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              {t('settings.resetEverythingBtn')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

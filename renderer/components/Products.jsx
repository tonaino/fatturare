import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export const Products = () => {
  const { t } = useTranslation();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    default_price: '',
    unit: 'pcs'
  });

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const data = await window.electronAPI.getProducts();
      setProducts(data);
    } catch (error) {
      console.error('Error loading products:', error);
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
      // Prepare data with proper number conversion
      const productData = {
        ...formData,
        default_price: parseFloat(formData.default_price) || 0
      };

      await window.electronAPI.createProduct(productData);

      // Reset form and reload products
      setFormData({
        name: '',
        default_price: '',
        unit: 'pcs'
      });
      setShowForm(false);
      loadProducts();
    } catch (error) {
      console.error('Error saving product:', error);
      alert(t('messages.errorSavingProduct'));
    }
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingProduct(null);
    setFormData({
      name: '',
      default_price: '',
      unit: 'pcs'
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
        <h1 className="text-2xl font-bold text-gray-900">{t('app.products')}</h1>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          {t('products.addProduct')}
        </button>
      </div>

      {showForm && (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              {t('products.addNewProduct')}
            </h3>
          </div>
          <div className="px-4 py-5 sm:p-6">
            <form onSubmit={handleFormSubmit}>
              <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                <div className="sm:col-span-6">
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    {t('products.productName')}
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

                <div className="sm:col-span-3">
                  <label htmlFor="default_price" className="block text-sm font-medium text-gray-700">
                    {t('products.defaultPriceCurrency')}
                  </label>
                  <div className="mt-1">
                    <input
                      type="number"
                      name="default_price"
                      id="default_price"
                      value={formData.default_price}
                      onChange={handleInputChange}
                      className="form-input block w-full sm:text-sm"
                      step="0.01"
                      min="0"
                      required
                    />
                  </div>
                </div>

                <div className="sm:col-span-3">
                  <label htmlFor="unit" className="block text-sm font-medium text-gray-700">
                    {t('products.unit')}
                  </label>
                  <div className="mt-1">
                    <select
                      id="unit"
                      name="unit"
                      value={formData.unit}
                      onChange={handleInputChange}
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

              <div className="mt-6 flex space-x-4">
                <button
                  type="submit"
                  className="btn-primary inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  {t('products.addProduct')}
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
          <h3 className="text-lg leading-6 font-medium text-gray-900">{t('products.title')}</h3>
          <p className="mt-1 text-sm text-gray-500">{t('products.manageProductsDesc')}</p>
        </div>
        <div className="px-4 py-5 sm:p-6">
          {products.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="table min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('products.name')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('products.defaultPrice')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('products.unit')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {products.map((product) => (
                    <tr key={product.id} className="invoice-item-row">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{product.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{product.default_price?.toLocaleString('en-US', { style: 'currency', currency: 'EUR' })}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{t(`units.${product.unit}`)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-24">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">{t('products.noProductsYet')}</h3>
              <p className="mt-2 text-sm text-gray-500 max-w-sm mx-auto">
                {t('products.startAdding')}
              </p>
              <div className="mt-6">
                <button
                  onClick={() => setShowForm(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                  </svg>
                  {t('products.addProduct')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

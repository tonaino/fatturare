import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export const Dashboard = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState({
    totalInvoices: 0,
    totalCreditNotes: 0,
    totalRevenue: 0,
    unpaidInvoices: 0,
    unpaidInvoicesTotal: 0
  });
  const [recentInvoices, setRecentInvoices] = useState([]);

  useEffect(() => {
    // Load dashboard stats
    const loadStats = async () => {
      try {
        const data = await window.electronAPI.getDashboardStats();
        setStats(data);
      } catch (error) {
        console.error('Error loading dashboard stats:', error);
      }
    };

    // Load recent unpaid invoices
    const loadRecentInvoices = async () => {
      try {
        const data = await window.electronAPI.getRecentUnpaidInvoices();
        setRecentInvoices(data);
      } catch (error) {
        console.error('Error loading recent invoices:', error);
      }
    };

    loadStats();
    loadRecentInvoices();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('dashboard.title')}</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-6 mb-8 md:grid-cols-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-sm font-medium text-gray-500 mb-2">{t('dashboard.totalOutstanding')}</h2>
          <p className="text-3xl font-bold text-gray-900">{stats.totalRevenue.toLocaleString('en-US', { style: 'currency', currency: 'EUR' })}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-sm font-medium text-gray-500 mb-2">{t('dashboard.paidThisMonth')}</h2>
          <p className="text-3xl font-bold text-gray-900">{stats.totalRevenue.toLocaleString('en-US', { style: 'currency', currency: 'EUR' })}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-sm font-medium text-gray-500 mb-2">Неплатени фактури</h2>
          <p className="text-3xl font-bold text-gray-900">{stats.unpaidInvoices}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-sm font-medium text-gray-500 mb-2">Общо неплатени</h2>
          <p className="text-3xl font-bold text-gray-900">{stats.unpaidInvoicesTotal.toLocaleString('en-US', { style: 'currency', currency: 'EUR' })}</p>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white p-6 shadow rounded-lg">
        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-2">{t('dashboard.recentActivity')}</h3>
        <p className="text-sm text-gray-500">{t('dashboard.recentActivityDesc')}</p>
        <div className="mt-4">
          {recentInvoices.length > 0 ? (
            <div className="space-y-3">
              {recentInvoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{invoice.doc_number}</p>
                    <p className="text-xs text-gray-500">
                      {invoice.customer_name ? invoice.customer_name : 'Unknown Customer'} • {new Date(invoice.issue_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {invoice.total_gross.toLocaleString('en-US', { style: 'currency', currency: invoice.currency })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">{t('dashboard.noRecentActivity')}</p>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dashboard } from './components/Dashboard';
import { CompanySettings } from './components/CompanySettings';
import { Customers } from './components/Customers';
import { Products } from './components/Products';
import { Documents } from './components/Documents';
import { CreateInvoice } from './components/CreateInvoice';
import { CreateCreditNote } from './components/CreateCreditNote';
import { CreateProformaInvoice } from './components/CreateProformaInvoice';
import { Button } from './components/ui/button';
import {
  Home,
  FileText,
  Users,
  Package,
  Settings,
  FilePlus,
  FileMinus,
  File,
  LogOut
} from 'lucide-react';

export default function App() {
  const { t } = useTranslation();
  const [activeView, setActiveView] = useState('dashboard');
  const [companyInfo, setCompanyInfo] = useState(null);
  const [editDocId, setEditDocId] = useState(null);

  const navigateToEdit = (id, type) => {
    setEditDocId(id);
    if (type === 'INVOICE') {
      setActiveView('create-invoice');
    } else if (type === 'CREDIT_NOTE') {
      setActiveView('create-credit-note');
    } else if (type === 'PROFORMA_INVOICE') {
      setActiveView('create-proforma-invoice');
    }
  };

  useEffect(() => {
    // Load company info when app starts
    const loadCompanyInfo = async () => {
      try {
        const info = await window.electronAPI.getCompanyInfo();
        setCompanyInfo(info);
      } catch (error) {
        console.error('Error loading company info:', error);
      }
    };

    loadCompanyInfo();
  }, []);

  const renderActiveView = () => {
    switch (activeView) {
      case 'dashboard':
        return <Dashboard />;
      case 'company-settings':
        return <CompanySettings companyInfo={companyInfo} setCompanyInfo={setCompanyInfo} />;
      case 'customers':
        return <Customers />;
      case 'products':
        return <Products />;
      case 'documents':
        return <Documents onEdit={navigateToEdit} />;
      case 'create-invoice':
        return <CreateInvoice editId={editDocId} onComplete={() => { setEditDocId(null); setActiveView('documents'); }} />;
      case 'create-credit-note':
        return <CreateCreditNote editId={editDocId} onComplete={() => { setEditDocId(null); setActiveView('documents'); }} />;
      case 'create-proforma-invoice':
        return <CreateProformaInvoice editId={editDocId} onComplete={() => { setEditDocId(null); setActiveView('documents'); }} />;
      default:
        return <Dashboard />;
    }
  };

  const sidebarItems = [
    { id: 'dashboard', label: t('app.dashboard'), icon: Home },
    { id: 'documents', label: t('app.documents'), icon: FileText },
    { id: 'customers', label: t('app.customers'), icon: Users },
    { id: 'products', label: t('app.products'), icon: Package },
    { id: 'company-settings', label: t('app.settings'), icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white/80 backdrop-blur-md border-r border-gray-200 p-6 shadow-lg">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">{t('app.title')}</h1>
        <nav className="space-y-2">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.id}
                variant={activeView === item.id ? 'default' : 'ghost'}
                className="w-full justify-start gap-3 h-12 text-left"
                onClick={() => setActiveView(item.id)}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Button>
            );
          })}
        </nav>
        <div className="mt-8 space-y-2">
          <Button
            variant={activeView === 'create-invoice' && !editDocId ? 'default' : 'outline'}
            onClick={() => { setEditDocId(null); setActiveView('create-invoice'); }}
            className="w-full gap-3"
          >
            <FilePlus className="h-5 w-5" />
            {t('app.newInvoice')}
          </Button>
          <Button
            variant={activeView === 'create-credit-note' && !editDocId ? 'default' : 'outline'}
            onClick={() => { setEditDocId(null); setActiveView('create-credit-note'); }}
            className="w-full gap-3"
          >
            <FileMinus className="h-5 w-5" />
            {t('app.newCreditNote')}
          </Button>
          <Button
            variant={activeView === 'create-proforma-invoice' && !editDocId ? 'default' : 'outline'}
            onClick={() => { setEditDocId(null); setActiveView('create-proforma-invoice'); }}
            className="w-full gap-3"
          >
            <File className="h-5 w-5" />
            {t('app.newProformaInvoice')}
          </Button>
        </div>
        <div className="mt-6 space-y-2">
          <Button
            variant="outline"
            onClick={async () => {
              const result = await window.electronAPI.createBackup();
              if (result.success) {
                alert(t('messages.backupCreated', { filePath: result.filePath }));
              } else if (!result.canceled) {
                alert(t('messages.backupFailed', { error: result.error }));
              }
            }}
            className="w-full"
          >
            {t('app.backup')}
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              await window.electronAPI.quitApp();
            }}
            className="w-full gap-3"
          >
            <LogOut className="h-5 w-5" />
            {t('app.exit')}
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8">
        {renderActiveView()}
      </main>
    </div>
  );
}

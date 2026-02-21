// ... existing code ...
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';

export const Documents = ({ onEdit }) => {
  const { t } = useTranslation();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilters, setStatusFilters] = useState({
    paid: false,
    unpaid: false,
    draft: false,
    cancelled: false
  });
  const [typeFilters, setTypeFilters] = useState({
    invoice: false,
    credit_note: false,
    proforma_invoice: false
  });
  const [sortBy, setSortBy] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [filteredDocuments, setFilteredDocuments] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormData, setExportFormData] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear()
  });
  const [selectedDocuments, setSelectedDocuments] = useState(new Set());
  const [monthlyDocs, setMonthlyDocs] = useState([]);

  useEffect(() => {
    loadDocuments();
  }, []);

  useEffect(() => {
    filterDocuments();
  }, [documents, searchTerm, statusFilters, typeFilters, sortBy, sortDirection]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilters, typeFilters]);

  // Update monthly docs when export form data changes
  useEffect(() => {
    if (showExportModal) {
      const monthDocs = documents.filter(doc => {
        if (!doc.doc_number || !doc.issue_date) return false; // Skip drafts and docs without dates

        const docDate = new Date(doc.issue_date);
        if (isNaN(docDate.getTime())) return false;

        return (
          (docDate.getMonth() + 1) === exportFormData.month &&
          docDate.getFullYear() === exportFormData.year &&
          (doc.status === 'paid' || doc.status === 'unpaid' || doc.status === 'cancelled') // Only final docs
        );
      });

      setMonthlyDocs(monthDocs);
      setSelectedDocuments(new Set(monthDocs.map(doc => doc.id)));
    }
  }, [exportFormData.month, exportFormData.year, documents, showExportModal]);

  const filterDocuments = () => {
    let filtered = [...documents];

    // Apply search filter
    if (searchTerm.trim()) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(doc =>
        (doc.doc_number && doc.doc_number.toLowerCase().includes(lowerSearchTerm)) ||
        (doc.customer_name && doc.customer_name.toLowerCase().includes(lowerSearchTerm)) ||
        (doc.issue_date && doc.issue_date.toLowerCase().includes(lowerSearchTerm))
      );
    }

    // Apply status filters
    const activeStatuses = Object.entries(statusFilters)
      .filter(([_, isActive]) => isActive)
      .map(([status, _]) => status);

    if (activeStatuses.length > 0) {
      filtered = filtered.filter(doc => activeStatuses.includes(doc.status));
    }

    // Apply type filters
    const activeTypes = Object.entries(typeFilters)
      .filter(([_, isActive]) => isActive)
      .map(([type, _]) => type);

    if (activeTypes.length > 0) {
      filtered = filtered.filter(doc => {
        let docType = '';
        if (doc.type === 'INVOICE') {
          docType = 'invoice';
        } else if (doc.type === 'CREDIT_NOTE') {
          docType = 'credit_note';
        } else if (doc.type === 'PROFORMA_INVOICE') {
          docType = 'proforma_invoice';
        }
        return activeTypes.includes(docType);
      });
    }

    // Sort filtered documents
    if (sortBy) {
      filtered.sort((a, b) => {
        let aVal, bVal;
        switch (sortBy) {
          case 'number':
            aVal = a.doc_number || '';
            bVal = b.doc_number || '';
            break;
          case 'date':
            aVal = new Date(a.issue_date);
            bVal = new Date(b.issue_date);
            break;
          case 'customer':
            aVal = a.customer_name || '';
            bVal = b.customer_name || '';
            break;
          case 'total':
            aVal = a.total_gross || 0;
            bVal = b.total_gross || 0;
            break;
          case 'status':
            aVal = a.status || '';
            bVal = b.status || '';
            break;
          default:
            return 0;
        }
        if (aVal < bVal) {
          return sortDirection === 'asc' ? -1 : 1;
        }
        if (aVal > bVal) {
          return sortDirection === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    setFilteredDocuments(filtered);
  };

  const loadDocuments = async () => {
    try {
      const data = await window.electronAPI.getDocuments();
      setDocuments(data);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  // PDF generation is now automatic, keeping this for manual regeneration if needed
  const handleGeneratePDF = async (docId) => {
    try {
      const pdfPath = await window.electronAPI.generatePDF(docId);
      alert(`PDF regenerated successfully at: ${pdfPath}`);
      console.log('PDF path returned:', pdfPath);
      const refreshResult = await loadDocuments(); // Refresh to show updated PDF path
      console.log('Documents refreshed after PDF regeneration');
      return refreshResult;
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF: ' + error.message);
    }
  };

  const handleMarkAsPaid = async (docId) => {
    try {
      await window.electronAPI.updateDocumentStatus(docId, 'paid');
      loadDocuments();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error updating status');
    }
  };

  const handleExportSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const result = await window.electronAPI.exportMonthDocuments(
        exportFormData.month,
        exportFormData.year
      );
      
      if (result.success) {
        alert(`Documents exported successfully to: ${result.exportPath}`);
        setShowExportModal(false);
      } else if (!result.canceled) {
        alert(`Export failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Error exporting documents:', error);
      alert('Error exporting documents');
    }
  };

  const handleExportChange = (e) => {
    const { name, value } = e.target;
    setExportFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleModalOpen = () => {
    setShowExportModal(true);

    // Get documents for the selected month
    const selectedMonth = exportFormData.month;
    const selectedYear = exportFormData.year;

    const monthDocs = documents.filter(doc => {
      const docDate = new Date(doc.issue_date);
      return docDate.getMonth() + 1 === selectedMonth && docDate.getFullYear() === selectedYear;
    });

    setMonthlyDocs(monthDocs);
    setSelectedDocuments(new Set(monthDocs.map(doc => doc.id)));
  };

  const handleDocumentToggle = (docId) => {
    const newSelected = new Set(selectedDocuments);
    if (newSelected.has(docId)) {
      newSelected.delete(docId);
    } else {
      newSelected.add(docId);
    }
    setSelectedDocuments(newSelected);
  };

  const handleExportWithSelection = async () => {
    const selectedIds = Array.from(selectedDocuments);

    if (selectedIds.length === 0) {
      alert('Please select at least one document to export.');
      return;
    }

    try {
      const result = await window.electronAPI.exportSelectedDocuments(
        exportFormData.month,
        exportFormData.year,
        selectedIds
      );

      if (result.success) {
        alert(`Documents exported successfully to: ${result.exportPath}`);
        setShowExportModal(false);
        setSelectedDocuments(new Set());
        setMonthlyDocs([]);
      } else if (!result.canceled) {
        alert(`Export failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Error exporting documents:', error);
      alert('Error exporting documents');
    }
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDirection('asc');
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('documents.title')}</h1>
        <button
          onClick={handleModalOpen}
          className="btn-secondary inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
        >
          {t('documents.exportMonth')}
        </button>
      </div>

      {/* Export Modal */}
      {showExportModal && (
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
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">{t('documents.exportModalTitle')}</h3>

                    {/* Month Selection */}
                    <div className="mb-6 grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="month" className="block text-sm font-medium text-gray-700">
                          {t('documents.month')}
                        </label>
                        <select
                          id="month"
                          name="month"
                          value={exportFormData.month}
                          onChange={handleExportChange}
                          className="form-select mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                        >
                          <option value="1">{t('documents.monthNames.january')}</option>
                          <option value="2">{t('documents.monthNames.february')}</option>
                          <option value="3">{t('documents.monthNames.march')}</option>
                          <option value="4">{t('documents.monthNames.april')}</option>
                          <option value="5">{t('documents.monthNames.may')}</option>
                          <option value="6">{t('documents.monthNames.june')}</option>
                          <option value="7">{t('documents.monthNames.july')}</option>
                          <option value="8">{t('documents.monthNames.august')}</option>
                          <option value="9">{t('documents.monthNames.september')}</option>
                          <option value="10">{t('documents.monthNames.october')}</option>
                          <option value="11">{t('documents.monthNames.november')}</option>
                          <option value="12">{t('documents.monthNames.december')}</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="year" className="block text-sm font-medium text-gray-700">
                          {t('documents.year')}
                        </label>
                        <input
                          type="number"
                          id="year"
                          name="year"
                          value={exportFormData.year}
                          onChange={handleExportChange}
                          min="2000"
                          max="2100"
                          className="form-input mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        />
                      </div>
                    </div>

                    {/* Document Checklist */}
                    <div className="mb-6">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">{t('documents.selectDocumentsToExportTitle')}</h4>
                      <div className="max-h-64 overflow-y-auto">
                        {monthlyDocs.length > 0 ? (
                          <div className="space-y-2">
                            {monthlyDocs.map((doc) => (
                              <label key={doc.id} className="flex items-center space-x-3 py-2 px-3 rounded-md hover:bg-gray-50">
                                <input
                                  type="checkbox"
                                  checked={selectedDocuments.has(doc.id)}
                                  onChange={() => handleDocumentToggle(doc.id)}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center space-x-2">
                                    <span className="text-sm font-medium text-gray-900">{doc.doc_number}</span>
                                    <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                                      doc.type === 'CREDIT_NOTE' ? 'bg-purple-100 text-purple-800' :
                                      doc.status === 'paid' ? 'bg-green-100 text-green-800' :
                                      doc.status === 'unpaid' ? 'bg-amber-100 text-amber-800' :
                                      doc.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}>
                                      {doc.type === 'CREDIT_NOTE' ? 'Credit Note' : doc.status}
                                    </span>
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {doc.customer_name} • {doc.total_gross?.toLocaleString('en-US', { style: 'currency', currency: 'EUR' })}
                                  </div>
                                </div>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 py-4">No documents found for the selected month/year.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleExportWithSelection}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Export Selected
                </button>
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      {documents.length > 0 && (
        <div className="bg-white border-t border-b mb-6">
          <div className="px-6 py-4 flex items-center gap-4">
            <div className="relative w-80">
              <input
                type="text"
                placeholder="Search documents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input block w-full pl-10 py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
              </div>
            </div>

            <div className="flex gap-2">
              {[
                { key: 'paid', label: 'Paid', color: 'bg-green-100 text-green-800 hover:bg-green-200' },
                { key: 'unpaid', label: 'Unpaid', color: 'bg-amber-100 text-amber-800 hover:bg-amber-200' },
                { key: 'draft', label: 'Draft', color: 'bg-blue-100 text-blue-800 hover:bg-blue-200' },
                { key: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-800 hover:bg-red-200' }
              ].map(({ key, label, color }) => (
                <button
                  key={key}
                  onClick={() => setStatusFilters(prev => ({ ...prev, [key]: !prev[key] }))}
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    statusFilters[key]
                      ? `ring-2 ring-blue-500 ${color}`
                      : `bg-gray-50 text-gray-700 hover:bg-gray-100`
                  }`}
                >
                  <svg
                    className={`w-4 h-4 mr-2 ${statusFilters[key] ? 'text-current' : 'hidden'}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  {label}
                </button>
              ))}
            </div>

            <div className="ml-auto flex gap-2">
              {[
                { key: 'invoice', label: 'Invoice', color: 'bg-blue-100 text-blue-800 hover:bg-blue-200' },
                { key: 'credit_note', label: 'Credit Note', color: 'bg-purple-100 text-purple-800 hover:bg-purple-200' },
                { key: 'proforma_invoice', label: 'Proforma Invoice', color: 'bg-cyan-100 text-cyan-800 hover:bg-cyan-200' }
              ].map(({ key, label, color }) => (
                <button
                  key={key}
                  onClick={() => setTypeFilters(prev => ({ ...prev, [key]: !prev[key] }))}
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    typeFilters[key]
                      ? `ring-2 ring-blue-500 ${color}`
                      : `bg-gray-50 text-gray-700 hover:bg-gray-100`
                  }`}
                >
                  <svg
                    className={`w-4 h-4 mr-2 ${typeFilters[key] ? 'text-current' : 'hidden'}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  {label}
                </button>
              ))}
            </div>

            {(Object.values(statusFilters).some(Boolean) || Object.values(typeFilters).some(Boolean) || searchTerm) && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilters({ paid: false, unpaid: false, draft: false, cancelled: false });
                  setTypeFilters({ invoice: false, credit_note: false, proforma_invoice: false });
                  setCurrentPage(1);
                }}
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          {(() => {
            const paginatedDocuments = filteredDocuments.slice(
              (currentPage - 1) * itemsPerPage,
              currentPage * itemsPerPage
            );
            if (filteredDocuments.length > 0) {
              return (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="cursor-pointer" onClick={() => handleSort('number')}>
                            Number {sortBy === 'number' && (sortDirection === 'asc' ? '↑' : '↓')}
                          </TableHead>
                          <TableHead className="cursor-pointer" onClick={() => handleSort('date')}>
                            Date {sortBy === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
                          </TableHead>
                          <TableHead className="cursor-pointer" onClick={() => handleSort('customer')}>
                            Customer {sortBy === 'customer' && (sortDirection === 'asc' ? '↑' : '↓')}
                          </TableHead>
                          <TableHead className="cursor-pointer" onClick={() => handleSort('total')}>
                            Total {sortBy === 'total' && (sortDirection === 'asc' ? '↑' : '↓')}
                          </TableHead>
                          <TableHead className="cursor-pointer" onClick={() => handleSort('status')}>
                            Status {sortBy === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
                          </TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedDocuments.map((document) => (
                          <TableRow key={document.id}>
                            <TableCell>
                              <div className="text-sm font-medium text-gray-900">{document.doc_number}</div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm text-gray-500">{document.issue_date}</div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm text-gray-500">{document.customer_name}</div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm text-gray-500">{document.total_gross?.toLocaleString('en-US', { style: 'currency', currency: 'EUR' })}</div>
                            </TableCell>
                            <TableCell>
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                                ${document.type === 'CREDIT_NOTE' ? 'bg-purple-100 text-purple-800' :
                                  document.type === 'PROFORMA_INVOICE' ? 'bg-blue-100 text-blue-800' :
                                  document.status === 'paid' ? 'bg-green-100 text-green-800' :
                                  document.status === 'unpaid' ? 'bg-amber-100 text-amber-800' :
                                  document.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                  'bg-gray-100 text-gray-800'}`}
                              >
                                {document.type === 'CREDIT_NOTE' ? 'Credit Note' :
                                 document.type === 'PROFORMA_INVOICE' ? 'Proforma Invoice' :
                                 document.status === 'paid' ? 'Paid' :
                                 document.status === 'unpaid' ? 'Unpaid' :
                                 document.status === 'cancelled' ? 'Cancelled' :
                                 document.status}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => onEdit(document.id, document.type)}
                                  className="text-indigo-600 hover:text-indigo-900 p-1 rounded tooltip"
                                  title="Edit document"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                                  </svg>
                                </button>
                                {document.status === 'unpaid' && (
                                  <button
                                    onClick={() => handleMarkAsPaid(document.id)}
                                    className="text-green-600 hover:text-green-900 p-1 rounded tooltip"
                                    title="Mark as paid"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                    </svg>
                                  </button>
                                )}
                                {document.doc_number && (
                                  <button
                                    onClick={async () => {
                                      try {
                                        // Check if PDF path exists in the document
                                        if (document.pdf_path) {
                                          await window.electronAPI.openPDF(document.pdf_path);
                                        } else {
                                          // If no PDF path, generate it first
                                          const pdfPath = await window.electronAPI.generatePDF(document.id);
                                          alert(`PDF generated successfully at: ${pdfPath}`);
                                          // Refresh data to get updated PDF path
                                          await loadDocuments();
                                        }
                                      } catch (error) {
                                        console.error('Error opening/generating PDF:', error);
                                        alert('Error opening PDF: ' + error.message);
                                      }
                                    }}
                                    className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-green-700 bg-green-100 hover:bg-green-200 tooltip"
                                    title="View PDF"
                                  >
                                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                                    </svg>
                                    View PDF
                                  </button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {filteredDocuments.length > itemsPerPage && (
                    <div className="flex justify-center items-center space-x-2 mt-4 pb-4">
                      <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(currentPage - 1)}
                        className="px-3 py-1 text-sm text-gray-500 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                      >
                        ‹
                      </button>
                      {Array.from({ length: Math.ceil(filteredDocuments.length / itemsPerPage) }, (_, i) => i + 1).map(page => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`px-3 py-1 text-sm border rounded disabled:opacity-50 ${page === currentPage ? 'bg-blue-500 text-white border-blue-500' : 'text-gray-500 bg-white border-gray-300 hover:bg-gray-50'}`}
                        >
                          {page}
                        </button>
                      ))}
                      <button
                        disabled={currentPage === Math.ceil(filteredDocuments.length / itemsPerPage)}
                        onClick={() => setCurrentPage(currentPage + 1)}
                        className="px-3 py-1 text-sm text-gray-500 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                      >
                        ›
                      </button>
                    </div>
                  )}
                </>
              );
            } else if (documents.length > 0) {
              return (
                <div className="text-center py-24">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                  </svg>
                  <h3 className="mt-4 text-lg font-medium text-gray-900">No documents match your search</h3>
                  <p className="mt-2 text-sm text-gray-500 max-w-sm mx-auto">
                    Try adjusting your search terms or clearing the filters to see more documents
                  </p>
                  <div className="mt-6">
                    <button
                      onClick={() => {
                        setSearchTerm('');
                        setStatusFilters({ paid: false, unpaid: false, draft: false, cancelled: false });
                        setTypeFilters({ invoice: false, credit_note: false, proforma_invoice: false });
                        setCurrentPage(1);
                      }}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      Clear search & filters
                    </button>
                  </div>
                </div>
              );
            } else {
              return (
                <div className="text-center py-24">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                  </svg>
                  <h3 className="mt-4 text-lg font-medium text-gray-900">No documents yet</h3>
                  <p className="mt-2 text-sm text-gray-500 max-w-sm mx-auto">
                    Create invoices and credit notes to get started with your business paperwork
                  </p>
                  <div className="mt-6">
                    <button
                      onClick={() => onEdit(null, 'INVOICE')}
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                      </svg>
                      Create Invoice
                    </button>
                  </div>
                </div>
              );
            }
          })()}
        </div>
      </div>
    </div>
  );
};

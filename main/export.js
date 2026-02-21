const { dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { getDocuments } = require('./database'); // Use the real database

const exportMonthDocuments = async (event, { month, year }) => {
  try {
    // Show directory selection dialog
    const result = await dialog.showOpenDialog({
      title: 'Select Export Directory',
      properties: ['openDirectory']
    });

    if (result.canceled) {
      return { success: false, canceled: true };
    }

    const exportBasePath = result.filePaths[0];
    
    // Create export folder name
    const monthNames = [
      '01_January', '02_February', '03_March', '04_April', '05_May', '06_June',
      '07_July', '08_August', '09_September', '10_October', '11_November', '12_December'
    ];
    
    const monthName = monthNames[parseInt(month) - 1];
    const exportFolderName = `Export_${monthName}_${year}`;
    const exportPath = path.join(exportBasePath, exportFolderName);
    
    // Create export directory
    if (!fs.existsSync(exportPath)) {
      fs.mkdirSync(exportPath, { recursive: true });
    }
    
    // Get all documents from the database
    const allDocuments = await getDocuments();

    // Filter documents by month and year based on issue_date (the actual invoice date)
    const monthFormatted = month.toString().padStart(2, '0');
    const documents = allDocuments.filter(doc => {
      // Skip drafts (no document number) and documents without issue dates
      if (!doc.doc_number || !doc.issue_date) return false;

      // Parse the issue date (the date on the actual invoice)
      const docDate = new Date(doc.issue_date);
      if (isNaN(docDate.getTime())) {
        console.warn(`Invalid issue_date for document ${doc.doc_number}: ${doc.issue_date}`);
        return false;
      }

      // Get month/year from issue date
      const docMonth = (docDate.getMonth() + 1).toString().padStart(2, '0'); // Month is 0-indexed
      const docYear = docDate.getFullYear().toString();

      // Filter by selected month and year based on invoice date
      const monthMatches = docMonth === monthFormatted;
      const yearMatches = docYear === year.toString();
      const matches = monthMatches && yearMatches;

      console.log(`Document ${doc.doc_number}: date=${doc.issue_date}, month=${docMonth}, year=${docYear}, matches=${matches}`);

      return matches;
    });
    
    // Copy each PDF file to the export directory (using copy version, generating if needed)
    let copiedCount = 0;
    for (const document of documents) {
      if (document.pdf_path && fs.existsSync(document.pdf_path)) {
        // Look for the copy version first (with _COPY suffix)
        const originalFileName = path.basename(document.pdf_path);
        const dirName = path.dirname(document.pdf_path);

        // Create copy filename by replacing .pdf with _COPY.pdf
        const copyFileName = originalFileName.replace(/\.pdf$/, '_COPY.pdf');
        const copyFilePath = path.join(dirName, copyFileName);

        // Generate copy if it doesn't exist
        if (!fs.existsSync(copyFilePath)) {
          // Need to regenerate the PDF to create the copy
          const { generatePDF } = require('./pdf');
          await generatePDF(document.id);

          // After regeneration, the copy file should be named based on the document number
          // The generatePDF function creates files using cleanDocNumber, so we need to construct the correct path
          const cleanDocNumber = document.doc_number ? document.doc_number.replace(/^INV-|^CN-/, '').replace(/\//g, '-') : String(document.id);
          const expectedCopyFileName = `${cleanDocNumber}_COPY.pdf`;
          const expectedCopyPath = path.join(dirName, expectedCopyFileName);

          // Check if the expected copy file exists
          if (fs.existsSync(expectedCopyPath)) {
            // Use the correctly named copy file
            const sourcePath = expectedCopyPath;
            const fileName = path.basename(sourcePath);
            const destinationPath = path.join(exportPath, fileName);

            // Copy the file
            fs.copyFileSync(sourcePath, destinationPath);
            copiedCount++;
          } else {
            console.warn(`Expected copy file does not exist: ${expectedCopyPath}`);
          }
        } else {
          // Use the copy file (it should exist)
          const sourcePath = copyFilePath;
          const fileName = path.basename(sourcePath);
          const destinationPath = path.join(exportPath, fileName);

          // Copy the file
          fs.copyFileSync(sourcePath, destinationPath);
          copiedCount++;
        }
      }
    }

    return {
      success: true,
      exportPath,
      folderName: exportFolderName,
      documentCount: documents.length,
      copiedCount: copiedCount
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const exportSelectedDocuments = async (event, { month, year, documentIds }) => {
  try {
    // Show directory selection dialog
    const result = await dialog.showOpenDialog({
      title: 'Select Export Directory',
      properties: ['openDirectory']
    });

    if (result.canceled) {
      return { success: false, canceled: true };
    }

    const exportBasePath = result.filePaths[0];

    // Create export folder name
    const monthNames = [
      '01_January', '02_February', '03_March', '04_April', '05_May', '06_June',
      '07_July', '08_August', '09_September', '10_October', '11_November', '12_December'
    ];

    const monthName = monthNames[parseInt(month) - 1];
    const exportFolderName = `Export_Selected_${monthName}_${year}`;
    const exportPath = path.join(exportBasePath, exportFolderName);

    // Create export directory
    if (!fs.existsSync(exportPath)) {
      fs.mkdirSync(exportPath, { recursive: true });
    }

    // Get all documents from the database
    const allDocuments = await getDocuments();

    // Filter documents by selected IDs
    const documents = allDocuments.filter(doc => documentIds.includes(doc.id));

    // Copy each PDF file to the export directory (using copy version, generating if needed)
    let copiedCount = 0;
    for (const document of documents) {
      if (document.pdf_path && fs.existsSync(document.pdf_path)) {
        // Look for the copy version first (with _COPY suffix)
        const originalFileName = path.basename(document.pdf_path);
        const dirName = path.dirname(document.pdf_path);

        // Create copy filename by replacing .pdf with _COPY.pdf
        const copyFileName = originalFileName.replace(/\.pdf$/, '_COPY.pdf');
        const copyFilePath = path.join(dirName, copyFileName);

        // Generate copy if it doesn't exist
        if (!fs.existsSync(copyFilePath)) {
          // Need to regenerate the PDF to create the copy
          const { generatePDF } = require('./pdf');
          await generatePDF(document.id);

          // After regeneration, the copy file should be named based on the document number
          // The generatePDF function creates files using cleanDocNumber, so we need to construct the correct path
          const cleanDocNumber = document.doc_number ? document.doc_number.replace(/^INV-|^CN-/, '').replace(/\//g, '-') : String(document.id);
          const expectedCopyFileName = `${cleanDocNumber}_COPY.pdf`;
          const expectedCopyPath = path.join(dirName, expectedCopyFileName);

          // Check if the expected copy file exists
          if (fs.existsSync(expectedCopyPath)) {
            // Use the correctly named copy file
            const sourcePath = expectedCopyPath;
            const fileName = path.basename(sourcePath);
            const destinationPath = path.join(exportPath, fileName);

            // Copy the file
            fs.copyFileSync(sourcePath, destinationPath);
            copiedCount++;
          } else {
            console.warn(`Expected copy file does not exist: ${expectedCopyPath}`);
          }
        } else {
          // Use the copy file (it should exist)
          const sourcePath = copyFilePath;
          const fileName = path.basename(sourcePath);
          const destinationPath = path.join(exportPath, fileName);

          // Copy the file
          fs.copyFileSync(sourcePath, destinationPath);
          copiedCount++;
        }
      }
    }

    return {
      success: true,
      exportPath,
      folderName: exportFolderName,
      documentCount: documents.length,
      copiedCount: copiedCount
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const exportDatabase = async (event) => {
  try {
    const { dialog } = require('electron');
    const path = require('path');
    const fs = require('fs');

    // Show save dialog to select export location
    const result = await dialog.showSaveDialog({
      title: 'Export Database',
      defaultPath: `fatturare_backup_${new Date().toISOString().split('T')[0]}.db`,
      filters: [
        { name: 'SQLite Database', extensions: ['db', 'sqlite'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled) {
      return { success: false, canceled: true };
    }

    const exportPath = result.filePath;

    // Get database path from database module
    const { dbPath } = require('./database');

    // Copy the database file
    fs.copyFileSync(dbPath, exportPath);

    return {
      success: true,
      exportPath: exportPath
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

module.exports = { exportMonthDocuments, exportSelectedDocuments, exportDatabase };

const { dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const createBackup = async () => {
  try {
    // Get the current database path
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'fatturare.sqlite');

    // Check if database exists
    if (!fs.existsSync(dbPath)) {
      throw new Error('Database file not found');
    }
    
    // Show save dialog
    const result = await dialog.showSaveDialog({
      title: 'Backup Database',
      defaultPath: `fatturare_backup_${new Date().toISOString().split('T')[0]}.db`,
      filters: [
        { name: 'SQLite Database', extensions: ['db'] }
      ]
    });
    
    if (result.canceled) {
      return { success: false, canceled: true };
    }
    
    // Copy the database file to the selected location
    fs.copyFileSync(dbPath, result.filePath);
    
    return { success: true, filePath: result.filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

module.exports = { createBackup };

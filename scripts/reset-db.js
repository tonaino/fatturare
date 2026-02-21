const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('🔄 Resetting database for production build...');

// The database path is determined at runtime by Electron, but based on the code:
// - Development/production getPath('userData') returns different paths
// - The file is always named 'fatturare.sqlite'

// Common production locations:
// macOS: ~/Library/Application Support/Fatturare/fatturare.sqlite
// Windows: %APPDATA%\Fatturare\fatturare.sqlite
// Linux: ~/.config/Fatturare/fatturare.sqlite

const userHome = os.homedir();
const possiblePaths = {
  darwin: path.join(userHome, 'Library', 'Application Support', 'Fatturare'),
  win32: path.join(userHome, 'AppData', 'Roaming', 'Fatturare'),
  linux: path.join(userHome, '.config', 'Fatturare')
};

const platform = os.platform();
const dbDir = possiblePaths[platform];

if (!dbDir) {
  console.log(`❌ Unsupported platform: ${platform}`);
  process.exit(1);
}

const dbPath = path.join(dbDir, 'fatturare.sqlite');

console.log(`🎯 Target database path: ${dbPath}`);

// Create directory if it doesn't exist
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log(`📁 Created directory: ${dbDir}`);
}

// Remove database file if it exists
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log(`🗑️  Removed existing database: ${dbPath}`);
} else {
  console.log(`ℹ️  No existing database found at: ${dbPath}`);
}

console.log('📦 Database reset complete. Next build will start with fresh database.');

// Also remove any backup files in the same directory
const backupFiles = fs.readdirSync(dbDir).filter(file =>
  file.startsWith('fatturare_backup_') && file.endsWith('.sqlite')
);

backupFiles.forEach(backupFile => {
  const backupPath = path.join(dbDir, backupFile);
  try {
    fs.unlinkSync(backupPath);
    console.log(`🗑️  Removed backup file: ${backupFile}`);
  } catch (error) {
    console.warn(`⚠️  Could not remove backup file ${backupFile}:`, error.message);
  }
});

console.log('✅ Production database cleanup complete.');

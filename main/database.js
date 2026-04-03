const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

const userDataPath = app.getPath('userData');

// Create the database directory if it doesn't exist
if (!fs.existsSync(userDataPath)) {
  fs.mkdirSync(userDataPath, { recursive: true });
}

// Database path - initially use default path, can be changed after settings are loaded
let dbPath = path.join(userDataPath, 'fatturare.sqlite');

// Import PDF generation function

let db;

const connect = () => {
  return new Promise((resolve, reject) => {
    try {
      db = new Database(dbPath);
      resolve(db);
    } catch (err) {
      reject(err);
    }
  });
};

const query = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    try {
      const stmt = db.prepare(sql);
      const rows = stmt.all(params);
      resolve(rows);
    } catch (err) {
      reject(err);
    }
  });
};

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    try {
      const stmt = db.prepare(sql);
      const row = stmt.get(params);
      resolve(row);
    } catch (err) {
      reject(err);
    }
  });
};

const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    try {
      const stmt = db.prepare(sql);
      const result = stmt.run(params);
      resolve({ lastID: result.lastInsertRowid, changes: result.changes });
    } catch (err) {
      reject(err);
    }
  });
};

const exec = (sql) => {
  return new Promise((resolve, reject) => {
    try {
      db.exec(sql);
      resolve();
    } catch (err) {
      reject(err);
    }
  });
};

const initializeDatabase = async () => {
  await connect();

  // Enable foreign keys for SQLite
  await run('PRAGMA foreign_keys = ON');

  // Create base tables if they don't exist
  await exec(`
    -- Company & Customers
    CREATE TABLE IF NOT EXISTS my_company (
      id INTEGER PRIMARY KEY,
      name TEXT,
      bulstat TEXT,
      vat_id TEXT,
      address TEXT,
      mol TEXT,
      logo_path TEXT,
      iban TEXT DEFAULT '',
      bic TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS company_bank_accounts (
      id INTEGER PRIMARY KEY,
      currency TEXT NOT NULL,
      iban TEXT,
      bic TEXT
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY,
      name TEXT,
      address TEXT,
      bulstat TEXT,
      vat_id TEXT,
      mol TEXT,
      default_template TEXT CHECK(default_template IN ('BG', 'BILINGUAL')),
      default_currency TEXT DEFAULT 'EUR'
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY,
      name TEXT UNIQUE,
      default_price REAL,
      unit TEXT
    );

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY,
      type TEXT CHECK(type IN ('INVOICE', 'CREDIT_NOTE', 'PROFORMA_INVOICE')),
      customer_id INTEGER,
      currency TEXT DEFAULT 'EUR',
      doc_number TEXT UNIQUE,
      related_inv_number TEXT,
      related_inv_date TEXT,
      issue_date TEXT,
      tax_event_date TEXT,
      status TEXT CHECK(status IN ('paid', 'unpaid', 'cancelled', 'draft')),
      vat_rate INTEGER DEFAULT 20,
      exemption_reason TEXT,
      correction_reason TEXT,
      total_net REAL,
      total_vat REAL,
      total_gross REAL,
      pdf_path TEXT,
      FOREIGN KEY(customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS document_items (
      id INTEGER PRIMARY KEY,
      doc_id INTEGER,
      name TEXT,
      qty REAL,
      price REAL,
      total REAL,
      FOREIGN KEY(doc_id) REFERENCES documents(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Initialize default data
  const company = await get('SELECT COUNT(*) as count FROM my_company');
  if (company.count === 0) {
    await run(`
      INSERT INTO my_company (id, name, bulstat, vat_id, address, mol, iban, bic)
      VALUES (1, '', '', '', '', '', '', '')
    `);
  }

  const settingsCount = await get('SELECT COUNT(*) as count FROM settings');
  if (settingsCount.count === 0) {
    await run('INSERT INTO settings (key, value) VALUES (?, ?)', ['invoice_start_number', '1']);
    await run('INSERT INTO settings (key, value) VALUES (?, ?)', ['credit_note_start_number', '1']);
    await run('INSERT INTO settings (key, value) VALUES (?, ?)', ['proforma_invoice_start_number', '1']);
  }

  // Run migrations to ensure schema is up to date
  await runMigrations();

  console.log('Real SQLite database initialized');
};

// Company
const getCompanyInfo = () => get('SELECT * FROM my_company WHERE id = 1');
const updateCompanyInfo = (data) => run(
  'UPDATE my_company SET name=?, bulstat=?, vat_id=?, address=?, mol=?, logo_path=? WHERE id=1',
  [data.name, data.bulstat, data.vat_id, data.address, data.mol, data.logo_path]
);

// Bank Accounts
const getBankAccounts = () => query('SELECT * FROM company_bank_accounts');
const getBankAccountById = (id) => get('SELECT * FROM company_bank_accounts WHERE id = ?', [id]);
const createBankAccount = (data) => run(
  'INSERT INTO company_bank_accounts (currency, iban, bic, nickname, bank_name) VALUES (?, ?, ?, ?, ?)',
  [data.currency, data.iban, data.bic, data.nickname, data.bank_name]
);
const updateBankAccount = (id, data) => run(
  'UPDATE company_bank_accounts SET currency=?, iban=?, bic=?, nickname=?, bank_name=? WHERE id=?',
  [data.currency, data.iban, data.bic, data.nickname, data.bank_name, id]
);
const deleteBankAccount = (id) => run('DELETE FROM company_bank_accounts WHERE id = ?', [id]);
const getBankAccountByCurrency = (currency) => get('SELECT * FROM company_bank_accounts WHERE currency = ?', [currency]);

// Customers
const getCustomers = () => query('SELECT * FROM customers');
const getCustomerById = (id) => get('SELECT * FROM customers WHERE id = ?', [id]);
const createCustomer = (data) => run(
  'INSERT INTO customers (name, address, bulstat, vat_id, mol, default_template, default_currency) VALUES (?, ?, ?, ?, ?, ?, ?)',
  [data.name, data.address, data.bulstat, data.vat_id, data.mol, data.default_template, data.default_currency]
).then(res => getCustomerById(res.lastID));
const updateCustomer = (id, data) => run(
  'UPDATE customers SET name=?, address=?, bulstat=?, vat_id=?, mol=?, default_template=?, default_currency=? WHERE id=?',
  [data.name, data.address, data.bulstat, data.vat_id, data.mol, data.default_template, data.default_currency, id]
);
const deleteCustomer = (id) => run('DELETE FROM customers WHERE id = ?', [id]);

// Products
const getProducts = () => query('SELECT * FROM products');
const getProductByName = (name) => get('SELECT * FROM products WHERE name = ?', [name]);
const createProduct = (data) => run(
  'INSERT INTO products (name, default_price, unit) VALUES (?, ?, ?)',
  [data.name, data.default_price, data.unit]
).then(res => get('SELECT * FROM products WHERE id = ?', [res.lastID]));

// Documents
const getDocuments = () => query(`
  SELECT
    d.*,
    c.name as customer_name
  FROM documents d
  LEFT JOIN customers c ON d.customer_id = c.id
  ORDER BY d.issue_date DESC, d.id DESC
`);
const getDocumentById = (id) => get('SELECT * FROM documents WHERE id = ?', [id]);
const getDocumentItems = (docId) => query('SELECT * FROM document_items WHERE doc_id = ?', [docId]);

const getNextDocumentNumber = async (type) => {
  let key, prefix;
  if (type === 'INVOICE') {
    key = 'invoice_start_number';
    prefix = 'INV-';
  } else if (type === 'CREDIT_NOTE') {
    key = 'credit_note_start_number';
    prefix = 'CN-';
  } else if (type === 'PROFORMA_INVOICE') {
    key = 'proforma_invoice_start_number';
    prefix = 'PRO-';
  } else {
    throw new Error(`Unknown document type: ${type}`);
  }

  const setting = await get('SELECT value FROM settings WHERE key = ?', [key]);

  // If setting doesn't exist, create it with default value '1'
  if (!setting) {
    await run('INSERT INTO settings (key, value) VALUES (?, ?)', [key, '1']);
    return prefix + '1'.toString().padStart(10, '0');
  }

  return prefix + setting.value.toString().padStart(10, '0');
};

const incrementDocumentNumber = async (type) => {
  let key;
  if (type === 'INVOICE') {
    key = 'invoice_start_number';
  } else if (type === 'CREDIT_NOTE') {
    key = 'credit_note_start_number';
  } else if (type === 'PROFORMA_INVOICE') {
    key = 'proforma_invoice_start_number';
  } else {
    throw new Error(`Unknown document type: ${type}`);
  }

  let setting = await get('SELECT value FROM settings WHERE key = ?', [key]);

  // If setting doesn't exist, create it with default value '1'
  if (!setting) {
    await run('INSERT INTO settings (key, value) VALUES (?, ?)', [key, '1']);
    setting = { value: '1' };
  }

  const current = parseInt(setting.value);
  await run('UPDATE settings SET value = ? WHERE key = ?', [(current + 1).toString(), key]);
};

const createDocument = async (data, items) => {
  const res = await run(
    `INSERT INTO documents (type, customer_id, currency, doc_number, related_inv_number, related_inv_date, issue_date, tax_event_date, status, vat_rate, exemption_reason, correction_reason, total_net, total_vat, total_gross, pdf_path, bank_account_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.type, data.customer_id, data.currency, data.doc_number, data.related_inv_number, data.related_inv_date, data.issue_date, data.tax_event_date, data.status, data.vat_rate, data.exemption_reason, data.correction_reason, data.total_net, data.total_vat, data.total_gross, null, data.bank_account_id]
  );

  const docId = res.lastID;
  for (const item of items) {
    await run(
      'INSERT INTO document_items (doc_id, name, qty, price, total, unit) VALUES (?, ?, ?, ?, ?, ?)',
      [docId, item.name, item.qty, item.price, item.total, item.unit]
    );
  }
  return getDocumentById(docId);
};

const updateDocument = async (id, data, items) => {
  // Ensure items is an array
  const itemsArray = Array.isArray(items) ? items : [items];

  // Get current document to preserve important data for finalized invoices
  const currentDoc = await getDocumentById(id);

  // For finalized invoices (with doc_number), preserve the document number
  // For draft invoices (without doc_number), allow doc_number to be null
  const docNumber = data.doc_number || currentDoc.doc_number;

  await run(
    `UPDATE documents SET customer_id=?, currency=?, doc_number=?, related_inv_number=?, related_inv_date=?, issue_date=?, tax_event_date=?, status=?, vat_rate=?, exemption_reason=?, correction_reason=?, total_net=?, total_vat=?, total_gross=?, pdf_path=?, bank_account_id=? WHERE id=?`,
    [data.customer_id, data.currency, docNumber, data.related_inv_number, data.related_inv_date, data.issue_date, data.tax_event_date, data.status, data.vat_rate, data.exemption_reason, data.correction_reason, data.total_net, data.total_vat, data.total_gross, data.pdf_path || null, data.bank_account_id, id]
  );

  await run('DELETE FROM document_items WHERE doc_id = ?', [id]);
  for (const item of itemsArray) {
    await run(
      'INSERT INTO document_items (doc_id, name, qty, price, total, unit) VALUES (?, ?, ?, ?, ?, ?)',
      [id, item.name, item.qty, item.price, item.total, item.unit]
    );
  }

  const document = await getDocumentById(id);

  // Regenerate PDFs for updated final documents (original and copy)
  if (document.doc_number && document.status !== 'draft') {
    try {
      const { generatePDF } = require('./pdf');
      const pdfPaths = await generatePDF(document.id);
      console.log(`PDFs regenerated automatically for updated document: Original: ${pdfPaths.original}, Copy: ${pdfPaths.copy}`);
    } catch (error) {
      console.error('Error regenerating PDF for updated document:', error);
    }
  }

  return document;
};

const updateDocumentStatus = (id, status) => run('UPDATE documents SET status = ? WHERE id = ?', [status, id]);
const updateDocumentPdfPath = (id, pdfPath) => run('UPDATE documents SET pdf_path = ? WHERE id = ?', [pdfPath, id]);

// Settings
const getSetting = (key) => get('SELECT value FROM settings WHERE key = ?', [key]).then(r => r ? r.value : null);
const updateSetting = (key, value) => run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);

// Migration system
const MIGRATIONS = [
  // Version 1: Initial schema
  async () => {
    console.log('Migration: Initial schema already applied');
  },

  // Version 2: Add currency support
  async () => {
    console.log('Migration v2: Adding currency column');
    const docColumns = await query("PRAGMA table_info(documents)");
    const hasCurrencyColumn = docColumns.some(col => col.name === 'currency');
    if (!hasCurrencyColumn) {
      await run('ALTER TABLE documents ADD COLUMN currency TEXT DEFAULT "EUR"');
    }

    const customerColumns = await query("PRAGMA table_info(customers)");
    const hasCustomerCurrencyColumn = customerColumns.some(col => col.name === 'default_currency');
    if (!hasCustomerCurrencyColumn) {
      await run('ALTER TABLE customers ADD COLUMN default_currency TEXT DEFAULT "EUR"');
    }

    console.log('Migration v2: Currency support added');
  },

  // Version 3: Add bank account tables
  async () => {
    console.log('Migration v3: Adding bank account tables');
    const companyColumns = await query("PRAGMA table_info(my_company)");
    const hasIbanColumn = companyColumns.some(col => col.name === 'iban');
    const hasBicColumn = companyColumns.some(col => col.name === 'bic');

    let alterSql = 'ALTER TABLE my_company';
    let additions = [];

    if (!hasIbanColumn) additions.push('ADD COLUMN iban TEXT DEFAULT ""');
    if (!hasBicColumn) additions.push('ADD COLUMN bic TEXT DEFAULT ""');

    if (additions.length > 0) {
      await run(alterSql + ' ' + additions.join(', '));
    }

    // Create company_bank_accounts table if it doesn't exist
    try {
      await run(`
          CREATE TABLE company_bank_accounts (
            id INTEGER PRIMARY KEY,
            currency TEXT NOT NULL,
            iban TEXT,
            bic TEXT,
            bank_name TEXT
          )
        `);
      console.log('Company bank accounts table created');
    } catch (error) {
      if (!error.message.includes('already exists')) {
        throw error;
      }
    }

    console.log('Migration v3: Bank account support added');
  },

  // Version 4: Add draft status support and fix constraints
  async () => {
    console.log('Migration v4: Adding draft status support');
    try {
      const draftCount = await query("SELECT COUNT(*) as count FROM documents WHERE status = 'draft'");
      if (draftCount[0].count === 0) {
        // If no draft documents exist, try inserting a dummy one to test constraint
        try {
          await run("INSERT INTO documents (type, customer_id, currency, doc_number, issue_date, status, vat_rate, total_net, total_vat, total_gross) VALUES ('INVOICE', NULL, 'EUR', 'TEST', '2023-01-01', 'draft', 20, 0, 0, 0)");
          await run("DELETE FROM documents WHERE doc_number = 'TEST'");
          console.log('Status constraint already supports draft');
        } catch (constraintError) {
          console.log('Recreating documents table to fix status constraint');

          // Temporarily disable foreign keys to allow dropping tables
          await run('PRAGMA foreign_keys = OFF');

          // Get all existing documents and items
          const existingDocs = await query("SELECT * FROM documents");
          const existingItems = await query("SELECT * FROM document_items");

          // Drop tables in correct order (items first since it references documents)
          await run("DROP TABLE IF EXISTS document_items");
          await run("DROP TABLE documents");

          // Recreate with correct constraints (this time includes 'draft')
          await run(`
              CREATE TABLE documents (
                id INTEGER PRIMARY KEY,
                type TEXT CHECK(type IN ('INVOICE', 'CREDIT_NOTE')),
                customer_id INTEGER,
                currency TEXT DEFAULT 'EUR',
                doc_number TEXT UNIQUE,
                related_inv_number TEXT,
                related_inv_date TEXT,
                issue_date TEXT,
                tax_event_date TEXT,
                status TEXT CHECK(status IN ('paid', 'unpaid', 'cancelled', 'draft')),
                vat_rate INTEGER DEFAULT 20,
                exemption_reason TEXT,
                correction_reason TEXT,
                total_net REAL,
                total_vat REAL,
                total_gross REAL,
                pdf_path TEXT
              )
            `);

          await run(`
              CREATE TABLE document_items (
                id INTEGER PRIMARY KEY,
                doc_id INTEGER,
                name TEXT,
                qty REAL,
                price REAL,
                total REAL,
                unit TEXT,
                FOREIGN KEY(doc_id) REFERENCES documents(id)
              )
            `);

          // Restore data - insert documents first
          for (const doc of existingDocs) {
            try {
              await run(
                `INSERT INTO documents (id, type, customer_id, currency, doc_number, related_inv_number, related_inv_date, issue_date, tax_event_date, status, vat_rate, exemption_reason, correction_reason, total_net, total_vat, total_gross, pdf_path)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [doc.id, doc.type, doc.customer_id, doc.currency, doc.doc_number, doc.related_inv_number, doc.related_inv_date, doc.issue_date, doc.tax_event_date, doc.status, doc.vat_rate, doc.exemption_reason, doc.correction_reason, doc.total_net, doc.total_vat, doc.total_gross, doc.pdf_path]
              );
            } catch (insertError) {
              console.log('Warning: Could not restore document:', doc.doc_number, insertError.message);
            }
          }

          // Then restore items
          for (const item of existingItems) {
            try {
              await run(
                `INSERT INTO document_items (id, doc_id, name, qty, price, total, unit)
                   VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [item.id, item.doc_id, item.name, item.qty, item.price, item.total, item.unit]
              );
            } catch (insertError) {
              console.log('Warning: Could not restore document item:', item.id, insertError.message);
            }
          }

          // Re-enable foreign keys
          await run('PRAGMA foreign_keys = ON');

          console.log('Successfully recreated documents tables with correct constraints');
        }
      }
    } catch (migrationError) {
      console.log('Migration check completed:', migrationError.message);
    }

    // Create trigger for additional validation if needed
    try {
      await run('DROP TRIGGER IF EXISTS documents_status_check;');
      await run(`
          CREATE TRIGGER documents_status_check
          BEFORE INSERT ON documents
          BEGIN
            SELECT CASE
              WHEN NEW.status NOT IN ('paid', 'unpaid', 'cancelled', 'draft')
            THEN RAISE(ABORT, 'Invalid status value')
          END;
        END;
      `);
      console.log('Created status check trigger for documents table');
    } catch (triggerError) {
      console.log('Could not create trigger:', triggerError.message);
    }

    console.log('Migration v4: Draft status support added');
  },

  // Version 5: Add nickname field to bank accounts
  async () => {
    console.log('Migration v5: Adding nickname field to bank accounts');
    try {
      const bankColumns = await query("PRAGMA table_info(company_bank_accounts)");
      const hasNicknameColumn = bankColumns.some(col => col.name === 'nickname');
      if (!hasNicknameColumn) {
        await run('ALTER TABLE company_bank_accounts ADD COLUMN nickname TEXT');
        console.log('Added nickname column to company_bank_accounts table');
      } else {
        console.log('Nickname column already exists');
      }
    } catch (error) {
      console.error('Migration v5 failed:', error);
      throw error;
    }
    console.log('Migration v5: Nickname support added to bank accounts');
  },

  // Version 6: Add bank_account_id to documents table
  async () => {
    console.log('Migration v6: Adding bank_account_id field to documents table');
    try {
      const docColumns = await query("PRAGMA table_info(documents)");
      const hasBankAccountIdColumn = docColumns.some(col => col.name === 'bank_account_id');
      if (!hasBankAccountIdColumn) {
        await run('ALTER TABLE documents ADD COLUMN bank_account_id INTEGER REFERENCES company_bank_accounts(id)');
        console.log('Added bank_account_id column to documents table');
      } else {
        console.log('bank_account_id column already exists');
      }
    } catch (error) {
      console.error('Migration v6 failed:', error);
      throw error;
    }
    console.log('Migration v6: Bank account selection support added to documents');
  },

  // Version 7: Add unit column to document_items table
  async () => {
    console.log('Migration v7: Adding unit field to document_items table');
    try {
      const itemColumns = await query("PRAGMA table_info(document_items)");
      const hasUnitColumn = itemColumns.some(col => col.name === 'unit');
      if (!hasUnitColumn) {
        await run('ALTER TABLE document_items ADD COLUMN unit TEXT');
        console.log('Added unit column to document_items table');
      } else {
        console.log('unit column already exists');
      }
    } catch (error) {
      console.error('Migration v7 failed:', error);
      throw error;
    }
    console.log('Migration v7: Unit support added to document items');
  },

  // Version 8: Add bank_name column to company_bank_accounts table
  async () => {
    console.log('Migration v8: Adding bank_name field to company_bank_accounts table');
    try {
      const bankColumns = await query("PRAGMA table_info(company_bank_accounts)");
      const hasBankNameColumn = bankColumns.some(col => col.name === 'bank_name');
      if (!hasBankNameColumn) {
        await run('ALTER TABLE company_bank_accounts ADD COLUMN bank_name TEXT');
        console.log('Added bank_name column to company_bank_accounts table');
      } else {
        console.log('bank_name column already exists');
      }
    } catch (error) {
      console.error('Migration v8 failed:', error);
      throw error;
    }
    console.log('Migration v8: Bank name support added to bank accounts');
  },

  // Version 9: Add PROFORMA_INVOICE type support
  async () => {
    console.log('Migration v9: Adding PROFORMA_INVOICE type support');
    try {
      // Check if we need to recreate the documents table to update the CHECK constraint
      const existingDocs = await query("SELECT * FROM documents");

      // Temporarily disable foreign keys to allow dropping tables
      await run('PRAGMA foreign_keys = OFF');

      // Get all existing documents and items
      const allExistingDocs = await query("SELECT * FROM documents");
      const existingItems = await query("SELECT * FROM document_items");

      // Drop tables in correct order (items first since it references documents)
      await run("DROP TABLE IF EXISTS document_items");
      await run("DROP TABLE documents");

      // Recreate with correct constraints (this time includes 'PROFORMA_INVOICE')
      await run(`
          CREATE TABLE documents (
            id INTEGER PRIMARY KEY,
            type TEXT CHECK(type IN ('INVOICE', 'CREDIT_NOTE', 'PROFORMA_INVOICE')),
            customer_id INTEGER,
            currency TEXT DEFAULT 'EUR',
            doc_number TEXT UNIQUE,
            related_inv_number TEXT,
            related_inv_date TEXT,
            issue_date TEXT,
            tax_event_date TEXT,
            status TEXT CHECK(status IN ('paid', 'unpaid', 'cancelled', 'draft')),
            vat_rate INTEGER DEFAULT 20,
            exemption_reason TEXT,
            correction_reason TEXT,
            total_net REAL,
            total_vat REAL,
            total_gross REAL,
            pdf_path TEXT,
            bank_account_id INTEGER REFERENCES company_bank_accounts(id)
          )
        `);

      await run(`
          CREATE TABLE document_items (
            id INTEGER PRIMARY KEY,
            doc_id INTEGER,
            name TEXT,
            qty REAL,
            price REAL,
            total REAL,
            unit TEXT,
            FOREIGN KEY(doc_id) REFERENCES documents(id)
          )
        `);

      // Restore data - insert documents first
      for (const doc of allExistingDocs) {
        try {
          await run(
            `INSERT INTO documents (id, type, customer_id, currency, doc_number, related_inv_number, related_inv_date, issue_date, tax_event_date, status, vat_rate, exemption_reason, correction_reason, total_net, total_vat, total_gross, pdf_path, bank_account_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [doc.id, doc.type, doc.customer_id, doc.currency, doc.doc_number, doc.related_inv_number, doc.related_inv_date, doc.issue_date, doc.tax_event_date, doc.status, doc.vat_rate, doc.exemption_reason, doc.correction_reason, doc.total_net, doc.total_vat, doc.total_gross, doc.pdf_path, doc.bank_account_id]
          );
        } catch (insertError) {
          console.log('Warning: Could not restore document:', doc.doc_number, insertError.message);
        }
      }

      // Then restore items
      for (const item of existingItems) {
        try {
          await run(
            `INSERT INTO document_items (id, doc_id, name, qty, price, total, unit)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [item.id, item.doc_id, item.name, item.qty, item.price, item.total, item.unit]
          );
        } catch (insertError) {
          console.log('Warning: Could not restore document item:', item.id, insertError.message);
        }
      }

      // Re-enable foreign keys
      await run('PRAGMA foreign_keys = ON');

      console.log('Successfully recreated documents tables with PROFORMA_INVOICE type support');
    } catch (error) {
      console.error('Migration v9 failed:', error);
      throw error;
    }
    console.log('Migration v9: PROFORMA_INVOICE type support added');
  }
];

const getCurrentSchemaVersion = async () => {
  try {
    const version = await getSetting('schema_version');
    return parseInt(version) || 0;
  } catch (error) {
    return 0;
  }
};

const setSchemaVersion = async (version) => {
  await updateSetting('schema_version', version.toString());
};

// Update the MIGRATIONS array length if needed
// Current migrations: 0 (initial), 1-8 (existing), 9 (PROFORMA_INVOICE)

const runMigrations = async () => {
  console.log('Checking database schema version...');
  const currentVersion = await getCurrentSchemaVersion();
  console.log(`Current schema version: ${currentVersion}, Latest: ${MIGRATIONS.length}`);

  if (currentVersion < MIGRATIONS.length) {
    console.log('Running migrations...');
    for (let version = currentVersion + 1; version <= MIGRATIONS.length; version++) {
      console.log(`Applying migration v${version}...`);
      try {
        await MIGRATIONS[version - 1](); // Arrays are 0-indexed
        console.log(`Migration v${version} completed successfully`);
      } catch (error) {
        console.error(`Migration v${version} failed:`, error);
        throw error;
      }
    }

    await setSchemaVersion(MIGRATIONS.length);
    console.log(`Schema updated to version ${MIGRATIONS.length}`);
  } else {
    console.log('Database schema is up to date');
  }
};

// Recent Activities - Last 10 unpaid invoices ordered by age (oldest to newest)
const getRecentUnpaidInvoices = () => query(`
  SELECT
    d.id,
    d.doc_number,
    d.issue_date,
    d.total_gross,
    d.currency,
    c.name as customer_name
  FROM documents d
  LEFT JOIN customers c ON d.customer_id = c.id
  WHERE d.type = 'INVOICE' AND d.status = 'unpaid'
  ORDER BY d.issue_date ASC
  LIMIT 10
`);

// Dashboard Stats
const getDashboardStats = async () => {
  const invoices = await get("SELECT COUNT(*) as count FROM documents WHERE type = 'INVOICE'");
  const creditNotes = await get("SELECT COUNT(*) as count FROM documents WHERE type = 'CREDIT_NOTE'");
  const revenue = await get("SELECT SUM(total_gross) as total FROM documents WHERE type = 'INVOICE' AND status = 'paid'");
  const unpaid = await get("SELECT COUNT(*) as count FROM documents WHERE type = 'INVOICE' AND status = 'unpaid'");
  const unpaidTotal = await get("SELECT SUM(total_gross) as total FROM documents WHERE type = 'INVOICE' AND status = 'unpaid' AND doc_number IS NOT NULL");

  return {
    totalInvoices: invoices.count || 0,
    totalCreditNotes: creditNotes.count || 0,
    totalRevenue: revenue.total || 0,
    unpaidInvoices: unpaid.count || 0,
    unpaidInvoicesTotal: unpaidTotal.total || 0
  };
};

module.exports = {
  initializeDatabase,
  getCompanyInfo,
  updateCompanyInfo,
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getProducts,
  getProductByName,
  createProduct,
  getDocuments,
  getDocumentById,
  getDocumentItems,
  getNextDocumentNumber,
  incrementDocumentNumber,
  createDocument,
  finalizeDocument: async (data, items) => {
    // Get the next number and increment the counter
    const docNumber = await getNextDocumentNumber(data.type);
    await incrementDocumentNumber(data.type);

    // Set the status to unpaid and use today's date for final documents
    const today = new Date().toISOString().split('T')[0];
    data.status = 'unpaid';
    data.doc_number = docNumber;
    data.issue_date = today;
    data.tax_event_date = today;
    
    const document = await createDocument(data, items);

    // Automatically generate PDFs (original and copy)
    try {
      const { generatePDF } = require('./pdf');
      const pdfPaths = await generatePDF(document.id);
      console.log(`PDFs generated automatically for new document: Original: ${pdfPaths.original}, Copy: ${pdfPaths.copy}`);
    } catch (error) {
      console.error('Error generating PDF for new document:', error);
    }

    return document;
  },

  finalizeDocumentById: async (id, data, items) => {
    // Get the next number and increment the counter
    const docNumber = await getNextDocumentNumber(data.type);
    await incrementDocumentNumber(data.type);

    // Set the status to unpaid and use today's date for final documents
    const today = new Date().toISOString().split('T')[0];
    data.status = 'unpaid';
    data.doc_number = docNumber;
    data.issue_date = today;
    data.tax_event_date = today;
    
    const document = await updateDocument(id, data, items);

    // Automatically generate PDFs (original and copy)
    try {
      const { generatePDF } = require('./pdf');
      const pdfPaths = await generatePDF(document.id);
      console.log(`PDFs generated automatically for updated document: Original: ${pdfPaths.original}, Copy: ${pdfPaths.copy}`);
    } catch (error) {
      console.error('Error generating PDF for updated document:', error);
    }

    return document;
  },
  updateDocument,
  updateDocumentStatus,
  updateDocumentPdfPath,
  getBankAccounts,
  getBankAccountById,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
  getBankAccountByCurrency,
  getSetting,
  updateSetting,
  getDashboardStats,
  getRecentUnpaidInvoices,
  // Migration system exports
  runMigrations,
  getCurrentSchemaVersion,
  MIGRATIONS,
  dbPath
};

/**
 * Electron Main Process
 * 
 * Entry point for the Electron desktop application.
 * Handles window creation and IPC for database setup.
 */

const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const { Client } = require('pg')


// Protocol registration
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('aof-biz', process.execPath, [path.resolve(process.argv[1])])
  }
} else {
  app.setAsDefaultProtocolClient('aof-biz')
}

// Single instance lock for deep links on Windows/Linux
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()

      // Capture the URL from the command line (for deep links)
      const url = commandLine.pop()
      if (url && url.startsWith('aof-biz://')) {
        mainWindow.webContents.send('auth-callback', url)
      }
    }
  })
}

// The SQL script to set up the Supabase database
const SETUP_SQL = `
-- Orders Table
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory Table
CREATE TABLE IF NOT EXISTS inventory (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Settings Table
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tracking Numbers Table
CREATE TABLE IF NOT EXISTS tracking_numbers (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order Sources Table
CREATE TABLE IF NOT EXISTS order_sources (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products Table
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running)
DROP POLICY IF EXISTS "Users can manage own orders" ON orders;
DROP POLICY IF EXISTS "Users can manage own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can manage own inventory" ON inventory;
DROP POLICY IF EXISTS "Users can manage own settings" ON settings;
DROP POLICY IF EXISTS "Users can manage own tracking_numbers" ON tracking_numbers;
DROP POLICY IF EXISTS "Users can manage own order_sources" ON order_sources;
DROP POLICY IF EXISTS "Users can manage own products" ON products;

-- Create RLS Policies
CREATE POLICY "Users can manage own orders" ON orders
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own expenses" ON expenses
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own inventory" ON inventory
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own settings" ON settings
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own tracking_numbers" ON tracking_numbers
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own order_sources" ON order_sources
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own products" ON products
  FOR ALL USING (auth.uid() = user_id);
`;

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: path.join(__dirname, '../public/logo.png'),
    autoHideMenuBar: true,
    titleBarStyle: 'default',
    show: false
  })

  // Start maximized/fullscreen as requested
  mainWindow.maximize()

  // Load the app
  if (process.env.VITE_DEV_SERVER_URL) {
    // Development: load from Vite dev server
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    // Production: load built files
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// IPC Handler: Open Auth Window (Integrated Login)
let authWindow = null
ipcMain.handle('open-auth-window', async (event, url) => {
  if (authWindow) {
    authWindow.focus()
    return { success: true }
  }

  authWindow = new BrowserWindow({
    width: 600,
    height: 700,
    autoHideMenuBar: true,
    title: 'AOF Biz Login',
    icon: path.join(__dirname, '../public/logo.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  authWindow.loadURL(url)

  authWindow.on('closed', () => {
    authWindow = null
  })

  return { success: true }
})

// Close auth window on success callback
ipcMain.on('close-auth-window', () => {
  if (authWindow) {
    authWindow.close()
    authWindow = null
  }
})

// IPC Handler: Setup Database
ipcMain.handle('setup-database', async (event, connectionString) => {
  const client = new Client({ connectionString })

  try {
    await client.connect()
    await client.query(SETUP_SQL)
    return { success: true, message: 'Database setup completed successfully!' }
  } catch (err) {
    console.error('Database setup error:', err)
    return { success: false, error: err.message }
  } finally {
    await client.end()
  }
})

// IPC Handler: Test Database Connection
ipcMain.handle('test-database-connection', async (event, connectionString) => {
  const client = new Client({ connectionString })

  try {
    await client.connect()
    const result = await client.query('SELECT NOW()')
    return { success: true, serverTime: result.rows[0].now }
  } catch (err) {
    console.error('Connection test error:', err)
    return { success: false, error: err.message }
  } finally {
    await client.end()
  }
})

// IPC Handler: Open URL in default browser
ipcMain.handle('open-external', async (event, url) => {
  try {
    await shell.openExternal(url)
    return { success: true }
  } catch (err) {
    console.error('Open external error:', err)
    return { success: false, error: err.message }
  }
})

const fs = require('fs')
const https = require('https')
const crypto = require('crypto')
const os = require('os')
const { spawn } = require('child_process')

// App lifecycle
app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// Protocol handler for macOS
app.on('open-url', (event, url) => {
  event.preventDefault()
  if (mainWindow) {
    mainWindow.webContents.send('auth-callback', url)
  } else {
    app.once('ready', () => {
      if (mainWindow) mainWindow.webContents.send('auth-callback', url)
    })
  }
})

// --- SOFTWARE UPDATE SYSTEM (Custom) ---

let downloadedFilePath = null;

function sendUpdateStatus(type, data = {}) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('update-status', { type, ...data });
  }
}

function verifyChecksum(filePath, expectedChecksum) {
  return new Promise((resolve) => {
    if (!expectedChecksum) return resolve(true);

    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => {
      const actualChecksum = hash.digest('hex');
      resolve(actualChecksum.toLowerCase() === expectedChecksum.toLowerCase());
    });
    stream.on('error', () => resolve(false));
  });
}

ipcMain.handle('start-download', async (event, url, checksum) => {
  const tempDir = os.tmpdir();
  const fileName = `aof-biz-update-${Date.now()}.exe`;
  const filePath = path.join(tempDir, fileName);
  downloadedFilePath = filePath;

  const downloadFile = (downloadUrl) => {
    return new Promise((resolve, reject) => {
      https.get(downloadUrl, (response) => {
        // Handle Redirects
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          return resolve(downloadFile(response.headers.location));
        }

        if (response.statusCode !== 200) {
          return reject(new Error(`Failed to download: ${response.statusCode}`));
        }

        const totalSize = parseInt(response.headers['content-length'], 10);
        let downloadedSize = 0;
        const file = fs.createWriteStream(filePath);

        response.on('data', (chunk) => {
          downloadedSize += chunk.length;
          const percent = (downloadedSize / totalSize) * 100;
          sendUpdateStatus('downloading', { percent });
        });

        response.pipe(file);

        file.on('finish', async () => {
          file.close();

          if (checksum) {
            const isValid = await verifyChecksum(filePath, checksum);
            if (!isValid) {
              fs.unlinkSync(filePath);
              sendUpdateStatus('error', { error: 'Checksum verification failed. The file may be corrupted.' });
              return resolve({ success: false, error: 'Checksum failed' });
            }
          }

          sendUpdateStatus('downloaded');
          resolve({ success: true, path: filePath });
        });
      }).on('error', (err) => {
        fs.unlink(filePath, () => { });
        sendUpdateStatus('error', { error: err.message });
        reject(err);
      });
    });
  };

  return downloadFile(url);
});

ipcMain.handle('install-update', () => {
  if (!downloadedFilePath || !fs.existsSync(downloadedFilePath)) {
    console.error('Installation failed: File not found');
    return;
  }

  // Spawn the installer and quit the app
  const installer = spawn(downloadedFilePath, ['/S'], { // /S for silent if supported, but usually just launching is fine
    detached: true,
    stdio: 'ignore'
  });

  installer.unref();
  app.quit();
});

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
    // If window not ready yet, store URL or wait
    app.once('ready', () => {
      if (mainWindow) mainWindow.webContents.send('auth-callback', url)
    })
  }
})

// --- SOFTWARE UPDATE SYSTEM (Electron) ---

let autoUpdater;
try {
  autoUpdater = require('electron-updater').autoUpdater;
  autoUpdater.autoDownload = false; // We handle download via UI manually or auto-update flag
  autoUpdater.allowPrerelease = false;

  // Logging
  autoUpdater.logger = console;
} catch (e) {
  console.warn('electron-updater not found. Update features disabled.');
}

function sendUpdateStatus(type, data = {}) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('update-status', { type, ...data });
  }
}

if (autoUpdater) {
  autoUpdater.on('checking-for-update', () => sendUpdateStatus('checking'));
  autoUpdater.on('update-available', (info) => sendUpdateStatus('available', { info }));
  autoUpdater.on('update-not-available', (info) => sendUpdateStatus('not-available', { info }));
  autoUpdater.on('error', (err) => sendUpdateStatus('error', { error: err.message }));
  autoUpdater.on('download-progress', (progressObj) => {
    sendUpdateStatus('downloading', { percent: progressObj.percent });
  });
  autoUpdater.on('update-downloaded', (info) => sendUpdateStatus('downloaded', { info }));
}

// IPC Handlers for Updates
ipcMain.handle('check-for-updates', async () => {
  if (!autoUpdater) return { error: 'Updater not initialized' };
  try {
    return await autoUpdater.checkForUpdates();
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('start-download', async () => {
  if (!autoUpdater) return { error: 'Updater not initialized' };
  return await autoUpdater.downloadUpdate();
});

ipcMain.handle('install-update', () => {
  if (!autoUpdater) return;
  autoUpdater.quitAndInstall();
});

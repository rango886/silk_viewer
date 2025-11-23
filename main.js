const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

// 获取命令行参数中的文件路径
function getFileFromArgs(argv) {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
  
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('-')) {
      try {
        const ext = path.extname(arg).toLowerCase();
        if (imageExtensions.includes(ext) && fs.existsSync(arg)) {
          return arg;
        }
      } catch (e) {
        // ignore
      }
    }
  }
  return null;
}

// --- 修改：移除单例锁逻辑，支持多开窗口 ---
// 之前这里有 app.requestSingleInstanceLock()，移除后每次启动都会创建新进程/新窗口

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    center: true,
    frame: false,
    backgroundColor: '#1e1e1e',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    }
  });

  mainWindow.loadFile('index.html');
  
  // 移除默认菜单
  Menu.setApplicationMenu(null);

  // --- 快捷键调试 ---
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' && input.type === 'keyDown') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
    if (input.control && input.shift && input.key.toLowerCase() === 'i' && input.type === 'keyDown') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  // --- 右键菜单 ---
  mainWindow.webContents.on('context-menu', (e, props) => {
    Menu.buildFromTemplate([
      { label: '打开开发者工具 (Open DevTools)', click: () => mainWindow.webContents.toggleDevTools() },
      { label: '检查元素 (Inspect)', click: () => mainWindow.webContents.inspectElement(props.x, props.y) },
      { type: 'separator' },
      { label: '刷新 (Reload)', click: () => mainWindow.reload() }
    ]).popup(mainWindow);
  });

  // 窗口加载完毕后，处理当前实例的启动参数
  mainWindow.webContents.on('did-finish-load', () => {
    const filePath = getFileFromArgs(process.argv);
    if (filePath) {
      mainWindow.webContents.send('open-file', filePath);
    }
  });

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  if (mainWindow === null) createWindow();
});

// --- IPC 通信 ---
ipcMain.on('window-min', () => mainWindow.minimize());
ipcMain.on('window-max', () => {
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('window-close', () => mainWindow.close());
ipcMain.on('window-fullscreen', () => {
  const flag = !mainWindow.isFullScreen();
  mainWindow.setFullScreen(flag);
});

// --- 窗口大小控制 ---
ipcMain.on('window-resize-inc', () => {
    if (!mainWindow) return;
    const { x, y, width, height } = mainWindow.getBounds();
    const factor = 1.1; // 放大 10%
    const newWidth = Math.round(width * factor);
    const newHeight = Math.round(height * factor);
    // 保持中心缩放
    const newX = Math.round(x - (newWidth - width) / 2);
    const newY = Math.round(y - (newHeight - height) / 2);
    
    mainWindow.setBounds({ x: newX, y: newY, width: newWidth, height: newHeight });
});

ipcMain.on('window-resize-dec', () => {
    if (!mainWindow) return;
    const { x, y, width, height } = mainWindow.getBounds();
    const factor = 0.9; // 缩小 10%
    const newWidth = Math.max(400, Math.round(width * factor)); // 最小宽度限制
    const newHeight = Math.max(300, Math.round(height * factor));
    
    const newX = Math.round(x - (newWidth - width) / 2);
    const newY = Math.round(y - (newHeight - height) / 2);

    mainWindow.setBounds({ x: newX, y: newY, width: newWidth, height: newHeight });
});

ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['jpg', 'png', 'gif', 'webp', 'jpeg', 'bmp', 'svg'] }]
  });
  return result.filePaths;
});
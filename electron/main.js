const {app, BrowserWindow, shell} = require('electron');
const path = require('path');

function createWindow () {
    const window = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 900,
        minHeight: 650,
        title: 'PenguinMod Offline',
        backgroundColor: '#171717',
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true
        }
    });

    window.webContents.setWindowOpenHandler(({url}) => {
        if (url.startsWith('https://') || url.startsWith('http://')) {
            shell.openExternal(url);
        }
        return {action: 'deny'};
    });

    window.webContents.on('will-navigate', (event, url) => {
        if (!url.startsWith('file://')) {
            event.preventDefault();
            if (url.startsWith('https://') || url.startsWith('http://')) {
                shell.openExternal(url);
            }
        }
    });

    window.loadFile(path.join(app.getAppPath(), 'build-offline', 'PenguinMod.html'));
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

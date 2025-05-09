const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const { setupAutoUpdater } = require('./auto-updater');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const path = require('path');

let mainWindow;
let accessToken = null;
let pendingMagicToken = null;


const { screen } = require('electron');

function createWindow() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    mainWindow = new BrowserWindow({
        width: 1800,
        height: height,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            // devTools: true
        }
    });

    mainWindow.loadURL('https://macsolutionroom.net')
        .then(() => {
            console.log('📄 Pagina caricata');
            // mainWindow.webContents.openDevTools(); // 👈 apre DevTools
        })
        .catch(err => console.error('❌ Errore caricamento pagina:', err));

    mainWindow.webContents.on('did-navigate', (event, url) => {
        if (pendingMagicToken) {
            console.log('🚀 Invio token magic salvato post-load');
            mainWindow.webContents.send('magic-token', pendingMagicToken);
            pendingMagicToken = null;
        }

        console.log('🌐 Navigato a:', url);

        if (url.includes('/login')) {
            console.log('🔒 Login rilevato, rimuovo menu');
            clearElectronMenu();
        } else if (accessToken) {
            // Ricrea il menu solo se c'è un token attivo
            loadMenuConToken(accessToken);
        }
    });

    mainWindow.setMenuBarVisibility(false);
}


function convertToElectronMenu(items) {
    return items.map(item => {
        const menuItem = {
            label: item.label
        };

        if (item.url) {
            menuItem.click = () => mainWindow.loadURL(item.url);
        }

        if (item.submenu) {
            menuItem.submenu = convertToElectronMenu(item.submenu);
        }

        return menuItem;
    });
}

function clearElectronMenu() {
    Menu.setApplicationMenu(null); // Rimuove completamente il menu
    mainWindow.setMenuBarVisibility(false); // Nasconde la barra
    accessToken = null; // Reset del token
}

function handleMagicLink(url) {
    console.log('🔗 Magic link ricevuto:', url);

    try {
        const parsed = new URL(url);
        const token = parsed.searchParams.get('token');

        if (!token) {
            console.warn('❌ Token mancante nel link');
            return;
        }

        console.log('✅ Token estratto:', token);
        pendingMagicToken = token;

        if (mainWindow && mainWindow.webContents) {
            const sendToken = () => {
                console.log('📨 Invio magic token al renderer...');
                mainWindow.webContents.send('magic-token', token);
                pendingMagicToken = null;
            };

            if (mainWindow.webContents.isLoading()) {
                mainWindow.webContents.once('did-finish-load', sendToken);
            } else {
                sendToken();
            }
        }
    } catch (err) {
        console.error('❌ Errore parsing URL magic link:', err);
    }
}

console.log('🛠 process.argv al boot:', process.argv);

async function loadMenuConToken(token) {
    try {
        const response = await fetch('https://macsolutionroom.net/api/electron-menu', {
            headers: { Authorization: 'Bearer ' + token }
        });

        const menuJson = await response.json();

        const electronMenu = convertToElectronMenu(menuJson);
        Menu.setApplicationMenu(Menu.buildFromTemplate(electronMenu));
        mainWindow.setMenuBarVisibility(true);
    } catch (err) {
        console.error('❌ Errore nel caricamento del menu con token:', err);
    }
}

ipcMain.on('access-token', (event, token) => {
    console.log('✅ Token ricevuto da renderer:', token);
    accessToken = token;
    if (mainWindow.webContents.isLoading()) {
        mainWindow.webContents.once('did-finish-load', () => {
            loadMenuConToken(accessToken);
        });
    } else {
        loadMenuConToken(accessToken);
    }
});


ipcMain.on('user-logged-out', () => {
    console.log('🚪 Logout ricevuto da webapp');
    clearElectronMenu();
});

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine) => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
        // Gestisce quando l'app è già aperta e riceve un URL
        const url = commandLine.find(arg => arg.startsWith('myapp://'));
        if (url) handleMagicLink(url);
    });
}

app.setAsDefaultProtocolClient('myapp');

app.whenReady().then(() => {
    console.log('🔍 process.argv:', process.argv);
    createWindow();

    setupAutoUpdater();

    // 👇 Gestione del magic link se l'app è stata aperta direttamente via protocollo
    const url = process.argv.find(arg => arg.startsWith('myapp://'));
    if (url) {
        console.log('📦 App avviata con magic link:', url);
        handleMagicLink(url);
    }
});


app.on('open-url', (event, url) => {
    event.preventDefault();
    handleMagicLink(url);
});


app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

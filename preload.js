const { contextBridge, ipcRenderer } = require('electron');

console.log('[preload] preload.js caricato');

let pendingToken = null;
let tokenCallback = null;

contextBridge.exposeInMainWorld('electronAPI', {
    sendAccessToken: (token) => {
        console.log('[preload] accessToken inviato');
        ipcRenderer.send('access-token', token);
    },
    userLoggedOut: () => {
        console.log('[preload] logout inviato');
        ipcRenderer.send('user-logged-out');
    },
    onMagicToken: (callback) => {
        console.log('[preload] callback registrata per magic-token');

        tokenCallback = callback;

        // Se il token era già arrivato prima che il listener fosse attivo
        if (pendingToken) {
            console.log('[preload] token pendente trovato, lo invio subito');
            tokenCallback(pendingToken);
            pendingToken = null;
        }

        ipcRenderer.removeAllListeners('magic-token');

        ipcRenderer.on('magic-token', (event, token) => {
            console.log('[preload] evento magic-token ricevuto');

            if (tokenCallback) {
                tokenCallback(token);
            } else {
                console.log('[preload] nessuna callback attiva, salvo token in pending');
                pendingToken = token;
            }
        });
    }
});

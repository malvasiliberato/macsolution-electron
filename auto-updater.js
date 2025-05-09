// auto-updater.js
const { autoUpdater } = require('electron-updater');
const { dialog } = require('electron');
const log = require('electron-log');

log.transports.file.level = 'info';
autoUpdater.logger = log;

function setupAutoUpdater() {
    autoUpdater.on('checking-for-update', () => {
        log.info('🔍 Verifica aggiornamenti...');
    });

    autoUpdater.on('update-available', (info) => {
        log.info('⬇️ Aggiornamento disponibile:', info.version);
    });

    autoUpdater.on('update-not-available', () => {
        log.info('✔️ Nessun aggiornamento disponibile');
    });

    autoUpdater.on('error', (err) => {
        log.error('❌ Errore aggiornamento:', err);
    });

    autoUpdater.on('download-progress', (progress) => {
        log.info(`📦 Download aggiornamento: ${progress.percent.toFixed(2)}%`);
    });

    autoUpdater.on('update-downloaded', () => {
        const result = dialog.showMessageBoxSync({
            type: 'question',
            buttons: ['Riavvia ora', 'Più tardi'],
            defaultId: 0,
            message: 'Un aggiornamento è stato scaricato. Vuoi riavviare ora per applicarlo?'
        });

        if (result === 0) {
            autoUpdater.quitAndInstall();
        }
    });

    autoUpdater.checkForUpdatesAndNotify();
}

module.exports = { setupAutoUpdater };

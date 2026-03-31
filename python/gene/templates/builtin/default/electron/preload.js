/**
 * {{ project_name }} — Preload Script
 * Exposes a secure, limited API to the renderer via contextBridge.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gene', {
  // IPC invoke (request/response)
  invoke: (channel, ...args) => {
    const validChannels = ['app:get-config', 'app:restart-python'];
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    throw new Error(`Invalid channel: ${channel}`);
  },

  // IPC listener (one-way from main)
  on: (channel, callback) => {
    const validChannels = ['app:python-status', 'app:update-available'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  },

  // Platform info
  platform: process.platform,
  isDev: process.env.GENE_DEV === 'true',
});

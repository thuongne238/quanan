// Network status utility
// Uses browser-native APIs (navigator.onLine + events)
// Compatible with all Android API levels in WebView

export const getNetworkStatus = async () => {
  return {
    connected: navigator.onLine,
    connectionType: navigator.onLine ? 'wifi' : 'none',
  };
};

export const addNetworkListener = async (callback) => {
  const onOnline = () => callback({ connected: true, connectionType: 'wifi' });
  const onOffline = () => callback({ connected: false, connectionType: 'none' });
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
};

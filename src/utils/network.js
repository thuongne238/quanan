// Network status utility
// Uses @capacitor/network on mobile, falls back to navigator.onLine on web

let Network = null;

const loadCapacitorNetwork = async () => {
  try {
    const mod = await import('@capacitor/network');
    Network = mod.Network;
    return true;
  } catch {
    return false;
  }
};

export const getNetworkStatus = async () => {
  const loaded = await loadCapacitorNetwork();
  if (loaded && Network) {
    try {
      const status = await Network.getStatus();
      return {
        connected: status.connected,
        connectionType: status.connectionType, // wifi, cellular, none, unknown
      };
    } catch {
      // fall through
    }
  }
  // Web fallback
  return {
    connected: navigator.onLine,
    connectionType: navigator.onLine ? 'wifi' : 'none',
  };
};

export const addNetworkListener = async (callback) => {
  const loaded = await loadCapacitorNetwork();
  if (loaded && Network) {
    try {
      const handle = await Network.addListener('networkStatusChange', (status) => {
        callback({
          connected: status.connected,
          connectionType: status.connectionType,
        });
      });
      return () => handle.remove();
    } catch {
      // fall through
    }
  }
  // Web fallback
  const onOnline = () => callback({ connected: true, connectionType: 'wifi' });
  const onOffline = () => callback({ connected: false, connectionType: 'none' });
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
};

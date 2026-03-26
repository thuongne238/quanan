// Bluetooth utility using @capacitor-community/bluetooth-le
// Provides scanning & device listing for thermal printer connection

let BleClient = null;

const loadBLE = async () => {
  try {
    const mod = await import('@capacitor-community/bluetooth-le');
    BleClient = mod.BleClient;
    return true;
  } catch {
    return false;
  }
};

export const initBluetooth = async () => {
  const loaded = await loadBLE();
  if (!loaded || !BleClient) {
    throw new Error('Bluetooth LE not available on this platform');
  }
  await BleClient.initialize({ androidNeverForLocation: true });
};

export const scanDevices = async (duration = 5000) => {
  if (!BleClient) await initBluetooth();

  const devices = [];

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(async () => {
      try {
        await BleClient.stopLEScan();
      } catch {}
      resolve(devices);
    }, duration);

    BleClient.requestLEScan({}, (result) => {
      const existing = devices.find(d => d.deviceId === result.device.deviceId);
      if (!existing) {
        devices.push({
          deviceId: result.device.deviceId,
          name: result.device.name || result.localName || 'Unknown Device',
          rssi: result.rssi,
        });
      }
    }).catch((err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
};

export const connectDevice = async (deviceId) => {
  if (!BleClient) await initBluetooth();
  await BleClient.connect(deviceId);
  return true;
};

export const disconnectDevice = async (deviceId) => {
  if (!BleClient) await initBluetooth();
  await BleClient.disconnect(deviceId);
};

export const isBluetoothAvailable = async () => {
  try {
    const loaded = await loadBLE();
    if (!loaded) return false;
    await BleClient.initialize({ androidNeverForLocation: true });
    return true;
  } catch {
    return false;
  }
};

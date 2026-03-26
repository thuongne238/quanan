import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pos.takeaway',
  appName: 'POS Takeaway',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;

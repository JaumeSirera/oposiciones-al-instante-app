import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jaumesirera.TestsOposiciones',
  appName: 'Tests Oposiciones',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
    webContentsDebuggingEnabled: true,
    appendUserAgent: 'TestsOposiciones/1.0'
  },
  server: {
    cleartext: true,
    androidScheme: 'https'
  }
};

export default config;


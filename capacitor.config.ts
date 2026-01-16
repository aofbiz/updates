import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aofbiz.app',
  appName: 'AllSet',
  webDir: 'dist',
  server: {
    // Allow external URLs (for Supabase)
    allowNavigation: ['*.supabase.co', '*.supabase.com']
  },
  android: {
    // Android specific settings
    allowMixedContent: true
  }
};

export default config;

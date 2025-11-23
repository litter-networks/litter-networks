import { defineConfig, type UserConfigExport, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

const customHostLogger = (): PluginOption => ({
  name: 'custom-host-logger',
  configureServer(server) {
    const httpServer = server.httpServer;
    if (!httpServer) {
      return;
    }
    httpServer.once('listening', () => {
      const address = httpServer.address();
      if (address && typeof address === 'object') {
        const port = address.port;
        // eslint-disable-next-line no-console
        console.log(`  ➜  Network: http://local.litternetworks.org:${port}/`);
      }
    });
  },
});

const plugins: PluginOption[] = [react(), tsconfigPaths()];

if (!process.env.VITEST) {
  plugins.push(customHostLogger());
}

const config: UserConfigExport & { test: Record<string, unknown> } = {
  plugins,
  server: {
    host: '0.0.0.0',
    allowedHosts: ['local.litternetworks.org'],
    proxy: {
      '/api': {
        target: 'https://aws.litternetworks.org',
        changeOrigin: true,
        secure: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
};

// https://vite.dev/config/
export default defineConfig(config);

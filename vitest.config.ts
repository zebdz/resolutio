import { defineConfig } from 'vitest/config';
import path from 'path';
import fs from 'fs';
import { getGitVersion, getBuildId } from './build/version-helper';

const version = getGitVersion();
const buildId = getBuildId();

function versionFilePlugin() {
  return {
    name: 'version-file',
    writeBundle(options: { dir?: string }) {
      const outDir = options.dir || 'dist';
      fs.writeFileSync(
        path.resolve(outDir, 'version.txt'),
        `${version} (${buildId})\n`
      );
    },
  };
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __BUILD_ID__: JSON.stringify(buildId),
  },
  plugins: [versionFilePlugin()],
  test: {
    globals: true,
    environment: 'node',
    setupFiles: [],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/e2e/**',
      '**/.next/**',
      '**/playwright-report/**',
      '**/test-results/**',
    ],
  },
  resolve: {
    alias: [
      { find: '@/src', replacement: path.resolve(__dirname, './src') },
      {
        find: '@/domain',
        replacement: path.resolve(__dirname, './src/domain'),
      },
      {
        find: '@/application',
        replacement: path.resolve(__dirname, './src/application'),
      },
      {
        find: '@/infrastructure',
        replacement: path.resolve(__dirname, './src/infrastructure'),
      },
      { find: '@/web', replacement: path.resolve(__dirname, './src/web') },
      { find: '@', replacement: path.resolve(__dirname, './') },
    ],
  },
});

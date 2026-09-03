import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig, Plugin} from 'vite';

function copyStaticProjectFilesPlugin(): Plugin {
  return {
    name: 'copy-static-project-files',
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist');
      if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir, { recursive: true });
      }
      // Copy db.js & supabase-config.js
      const filesToCopy = ['db.js', 'supabase-config.js', 'supabase_schema.sql'];
      filesToCopy.forEach(file => {
        const filePath = path.resolve(__dirname, file);
        if (fs.existsSync(filePath)) {
          fs.copyFileSync(filePath, path.resolve(distDir, file));
        }
      });
      // Copy assets directory recursively
      const srcAssets = path.resolve(__dirname, 'assets');
      const distAssets = path.resolve(distDir, 'assets');
      if (fs.existsSync(srcAssets)) {
        fs.cpSync(srcAssets, distAssets, { recursive: true, force: true });
      }
    }
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), copyStaticProjectFilesPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: 'dist',
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          orders: path.resolve(__dirname, 'orders.html'),
          balance: path.resolve(__dirname, 'balance.html'),
          contact: path.resolve(__dirname, 'contact.html'),
          profile: path.resolve(__dirname, 'profile.html'),
          referral: path.resolve(__dirname, 'referral.html'),
          admin: path.resolve(__dirname, 'admin/index.html'),
        },
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

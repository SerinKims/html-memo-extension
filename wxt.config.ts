import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  manifestVersion: 3,
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: '웹 메모 HTML 검토',
    short_name: '웹 메모',
    description: '웹페이지 메모와 전체 화면을 단일 HTML 검토 파일로 저장합니다.',
    permissions: ['storage', 'activeTab', 'scripting', 'downloads', 'offscreen'],
    icons: {
      16: 'icons/16.png',
      32: 'icons/32.png',
      48: 'icons/48.png',
      128: 'icons/128.png',
    },
    action: {
      default_icon: {
        16: 'icons/16.png',
        32: 'icons/32.png',
        48: 'icons/48.png',
        128: 'icons/128.png',
      },
    },
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});

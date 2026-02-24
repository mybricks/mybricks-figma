import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const isWatch = process.argv.includes('--watch');

const uiHtmlPath = path.resolve('src/ui.html');
const uiHtmlContent = fs.readFileSync(uiHtmlPath, 'utf8');

const codeConfig = {
  entryPoints: ['src/code.ts'],
  bundle: true,
  outfile: 'dist/code.js',
  format: 'iife',
  target: 'es2017',
  platform: 'neutral',
  logLevel: 'info',
  define: {
    __html__: JSON.stringify(uiHtmlContent),
  },
};

const uiPlugin = {
  name: 'html-copy',
  setup(build) {
    build.onEnd(() => {
      fs.copyFileSync(path.resolve('src/ui.html'), path.resolve('dist/ui.html'));
      console.log('Copied ui.html to dist/');
    });
  },
};

async function main() {
  if (isWatch) {
    const ctx = await esbuild.context({ ...codeConfig, plugins: [uiPlugin] });
    await ctx.watch();
    console.log('Watching for changes...');
  } else {
    await esbuild.build({ ...codeConfig, plugins: [uiPlugin] });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

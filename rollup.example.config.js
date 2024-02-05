import eslint from '@rollup/plugin-eslint';
import esbuild from 'rollup-plugin-esbuild';

export default [
  {
    input: './example/index.ts',
    output: {
      format: 'esm',
      file: 'example/index.esm.js',
    },
    plugins: [esbuild(), eslint()],
  },
];

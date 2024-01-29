import path from 'path';
import eslint from '@rollup/plugin-eslint';
import terser from '@rollup/plugin-terser';
import esbuild from 'rollup-plugin-esbuild';
import { dts } from 'rollup-plugin-dts';

export default [
  {
    input: './src/index.ts',
    output: [
      {
        file: 'dist/index.esm.js',
        format: 'esm',
        sourcemap: true,
      },
      {
        file: 'dist/index.cjs.js',
        format: 'cjs',
        sourcemap: true,
      },
    ],
    plugins: [esbuild(), eslint(), terser()],
  },
  {
    input: './src/index.ts',
    output: {
      format: 'esm',
      file: 'dist/index.d.ts',
    },
    plugins: [dts()],
  },
];

import typescript from 'rollup-plugin-typescript2';
import commonjs from '@rollup/plugin-commonjs'
import external from 'rollup-plugin-peer-deps-external';
import { nodeResolve } from '@rollup/plugin-node-resolve';

export default {
    input: 'src/index.tsx',
    output: [
        {
            file: "./dist/index.js",
            format: 'cjs',
            exports: 'named',
            sourcemap: true
        },
        {
            file: "./dist/index.es.js",
            format: 'es',
            exports: 'named',
            sourcemap: true
        }
    ],
    plugins: [
        external(),
        nodeResolve(),
        typescript(),
        commonjs(),
    ]
};
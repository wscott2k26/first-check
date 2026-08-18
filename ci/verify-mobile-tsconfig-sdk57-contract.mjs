import fs from 'node:fs';
import path from 'node:path';
const root=process.argv[2];
if(!root) throw new Error('usage: node verify-mobile-tsconfig-sdk57-contract.mjs <source-root>');
const ts=JSON.parse(fs.readFileSync(path.join(root,'apps/mobile/tsconfig.json'),'utf8'));
if('baseUrl' in (ts.compilerOptions ?? {})) throw new Error('Expo SDK 57 / TypeScript 6 mobile tsconfig must not use deprecated baseUrl');
const alias=ts.compilerOptions?.paths?.['@/*'];
if(!Array.isArray(alias) || alias[0] !== './*') throw new Error(`@/* path alias changed unexpectedly: ${JSON.stringify(alias)}`);
console.log('Expo SDK 57 mobile tsconfig contract passed.');

import fs from 'node:fs';
import path from 'node:path';
const root=process.argv[2];
if(!root)throw new Error('usage: node verify-expo-sdk57-package-contract.mjs <source-root>');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'apps/mobile/package.json'),'utf8'));
if(pkg.dependencies?.['expo-router'] !== '~57.0.14') throw new Error(`expo-router must be ~57.0.14 for the current SDK 57 package line; got ${pkg.dependencies?.['expo-router']}`);
if(!String(pkg.dependencies?.expo ?? '').startsWith('~57.')) throw new Error(`Expo SDK package must stay on ~57.x; got ${pkg.dependencies?.expo}`);
console.log('Expo SDK 57 package contract passed.');

import fs from 'node:fs';
import path from 'node:path';
const root=process.argv[2];
if(!root) throw new Error('usage: node apply-mobile-tsconfig-sdk57-compat.mjs <source-root>');
const file=path.join(root,'apps/mobile/tsconfig.json');
const ts=JSON.parse(fs.readFileSync(file,'utf8'));
if(ts.compilerOptions) delete ts.compilerOptions.baseUrl;
fs.writeFileSync(file,JSON.stringify(ts,null,2)+'\n');
console.log('Removed deprecated baseUrl from mobile tsconfig.');

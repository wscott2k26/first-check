import fs from 'node:fs';
import path from 'node:path';
const root=process.argv[2];
if(!root) throw new Error('usage: node verify-typescript-sdk57-contract.mjs <source-root>');
const rootPkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const mobilePkg=JSON.parse(fs.readFileSync(path.join(root,'apps/mobile/package.json'),'utf8'));
for (const [where,value] of [['root',rootPkg.devDependencies?.typescript],['mobile',mobilePkg.devDependencies?.typescript]]) {
  if(value !== '~6.0.3') throw new Error(`${where} TypeScript must be ~6.0.3 for Expo SDK 57 template compatibility; got ${value}`);
}
console.log('Expo SDK 57 TypeScript contract passed.');

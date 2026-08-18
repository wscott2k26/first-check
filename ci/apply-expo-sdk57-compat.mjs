import fs from 'node:fs';
import path from 'node:path';
const root=process.argv[2];
if(!root)throw new Error('usage: node apply-expo-sdk57-compat.mjs <source-root>');
const file=path.join(root,'apps/mobile/package.json');
const pkg=JSON.parse(fs.readFileSync(file,'utf8'));
if(pkg.dependencies?.['expo-router'] !== '~7.0.0' && pkg.dependencies?.['expo-router'] !== '~57.0.14') {
  throw new Error(`unexpected expo-router source version: ${pkg.dependencies?.['expo-router']}`);
}
pkg.dependencies['expo-router']='~57.0.14';
fs.writeFileSync(file, JSON.stringify(pkg,null,2)+'\n');
console.log('Aligned expo-router to SDK 57 package line.');

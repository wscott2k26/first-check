import fs from 'node:fs';
import path from 'node:path';
const root=process.argv[2];
if(!root) throw new Error('usage: node apply-typescript-sdk57-compat.mjs <source-root>');
for (const rel of ['package.json','apps/mobile/package.json']) {
  const file=path.join(root,rel);
  const pkg=JSON.parse(fs.readFileSync(file,'utf8'));
  pkg.devDependencies ??= {};
  pkg.devDependencies.typescript='~6.0.3';
  fs.writeFileSync(file,JSON.stringify(pkg,null,2)+'\n');
}
console.log('Pinned TypeScript to Expo SDK 57 template line.');

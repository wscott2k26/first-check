import fs from 'node:fs';
import path from 'node:path';
const root=process.argv[2];
if(!root)throw new Error('usage: node verify-workspace-config-contract.mjs <source-root>');
const base=path.join(root,'packages/config/tsconfig.base.json');
if(!fs.existsSync(base)) throw new Error('packages/config/tsconfig.base.json is missing');
const cfg=JSON.parse(fs.readFileSync(base,'utf8'));
if(cfg.compilerOptions?.module !== 'NodeNext' || cfg.compilerOptions?.strict !== true) throw new Error('base tsconfig contract is incomplete');
for (const name of ['schemas','domain','ui','api-client']) {
  const ts=JSON.parse(fs.readFileSync(path.join(root,`packages/${name}/tsconfig.json`),'utf8'));
  if(ts.extends !== '../config/tsconfig.base.json') throw new Error(`${name} tsconfig no longer extends shared config`);
}
console.log('Workspace config contract passed.');

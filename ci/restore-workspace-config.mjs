import fs from 'node:fs';
import path from 'node:path';
const root=process.argv[2];
if(!root)throw new Error('usage: node restore-workspace-config.mjs <source-root>');
const dir=path.join(root,'packages/config');
fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,'package.json'), JSON.stringify({
  name:'@first-check/config',version:'0.0.0',private:true,type:'module',exports:{'./tsconfig.base.json':'./tsconfig.base.json'}
},null,2)+'\n');
fs.writeFileSync(path.join(dir,'tsconfig.base.json'), JSON.stringify({compilerOptions:{
  target:'ES2023',module:'NodeNext',moduleResolution:'NodeNext',strict:true,noUncheckedIndexedAccess:true,exactOptionalPropertyTypes:true,noImplicitOverride:true,useUnknownInCatchVariables:true,skipLibCheck:true,resolveJsonModule:true
}},null,2)+'\n');
console.log('Restored shared workspace TypeScript config.');

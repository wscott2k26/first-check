import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
const root=process.argv[2]??'build-src';
const p=(rel)=>path.join(root,rel);
const here=path.dirname(new URL(import.meta.url).pathname);
const encoded=[1,2,3,4,5].map(i=>fs.readFileSync(path.join(here,`first-check-pro.payload.part${String(i).padStart(2,'0')}`),'utf8').trim()).join('');
const payload=JSON.parse(zlib.gunzipSync(Buffer.from(encoded,'base64')).toString('utf8'));
for(const [rel,content] of Object.entries(payload)){const file=p(rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,content);}
const config=JSON.parse(fs.readFileSync(p('apps/mobile/app.json'),'utf8')).expo;
if(config.version!=='1.1.0')throw new Error('First Check Pro version must be 1.1.0');
if(config.android?.versionCode!==3)throw new Error('First Check Pro Android versionCode must be 3');
if(config.ios?.buildNumber!=='2')throw new Error('First Check Pro iOS buildNumber must be 2');
if(config.android?.package!=='com.stormandme.firstcheck'||config.ios?.bundleIdentifier!=='com.stormandme.firstcheck')throw new Error('First Check package identity drifted');
const pkg=JSON.parse(fs.readFileSync(p('apps/mobile/package.json'),'utf8'));
if(pkg.dependencies?.['react-native-purchases']!=='10.5.0')throw new Error('RevenueCat SDK pin missing');
const entitlement=fs.readFileSync(p('apps/mobile/src/billing/entitlement-policy.ts'),'utf8');
if(!entitlement.includes("PRO_ENTITLEMENT_ID = 'pro'"))throw new Error('Pro entitlement contract missing');
console.log('First Check Pro V1.1 applied: RevenueCat entitlement + paywall + feature gates + store version 1.1.0/code3/build2.');

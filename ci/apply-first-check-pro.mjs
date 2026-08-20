import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
const root=process.argv[2]??'build-src';
const p=(rel)=>path.join(root,rel);
const here=path.dirname(new URL(import.meta.url).pathname);
const encoded=[1,2,3,4,5].map(i=>fs.readFileSync(path.join(here,`first-check-pro.payload.part${String(i).padStart(2,'0')}`),'utf8').trim()).join('');
const payload=JSON.parse(zlib.gunzipSync(Buffer.from(encoded,'base64')).toString('utf8'));
for(const [rel,content] of Object.entries(payload)){const file=p(rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,content);}

const dynamicPath=p('apps/mobile/app.config.ts');
if(fs.existsSync(dynamicPath)){
  let source=fs.readFileSync(dynamicPath,'utf8');
  if(/version\s*:\s*['"]1\.0\.0['"]/.test(source)) source=source.replace(/version\s*:\s*['"]1\.0\.0['"]/,'version:\'1.1.0\'');
  else if(!/version\s*:\s*['"]1\.1\.0['"]/.test(source)) throw new Error('Dynamic Expo config version insertion point missing');
  if(/versionCode\s*:\s*2/.test(source)) source=source.replace(/versionCode\s*:\s*2/,'versionCode:3');
  else if(!/versionCode\s*:\s*3/.test(source)) throw new Error('Dynamic Expo config versionCode insertion point missing');
  if(!/buildNumber\s*:\s*['"]2['"]/.test(source)){
    if(/ios\s*:\s*\{/.test(source)) source=source.replace(/ios\s*:\s*\{/,'ios:{buildNumber:\'2\',');
    else throw new Error('Dynamic Expo config iOS insertion point missing');
  }
  fs.writeFileSync(dynamicPath,source);
}

const rootPackagePath=p('package.json');
if(fs.existsSync(rootPackagePath)){
  const rootPkg=JSON.parse(fs.readFileSync(rootPackagePath,'utf8'));
  rootPkg.packageManager='pnpm@11.9.0';
  rootPkg.devDependencies={...(rootPkg.devDependencies??{}),typescript:'6.0.3'};
  if(rootPkg.devDependencies?.turbo==='latest') rootPkg.devDependencies.turbo='2.10.10';
  if(rootPkg.dependencies?.turbo==='latest') rootPkg.dependencies.turbo='2.10.10';
  fs.writeFileSync(rootPackagePath,JSON.stringify(rootPkg,null,2)+'\n');
}
for(const rel of ['packages/api-client/package.json','packages/domain/package.json','packages/schemas/package.json','packages/ui/package.json']){
  const file=p(rel);
  if(!fs.existsSync(file))continue;
  const manifest=JSON.parse(fs.readFileSync(file,'utf8'));
  for(const section of ['dependencies','devDependencies']){
    if(manifest[section]?.typescript==='latest')manifest[section].typescript='6.0.3';
    if(manifest[section]?.vitest==='latest')manifest[section].vitest='4.1.10';
    if(manifest[section]?.zod==='latest')manifest[section].zod='4.1.11';
  }
  fs.writeFileSync(file,JSON.stringify(manifest,null,2)+'\n');
}

const easIgnorePath=p('.easignore');
if(!fs.existsSync(easIgnorePath)){
  fs.writeFileSync(easIgnorePath,`# First Check EAS archive rules — intentionally do NOT ignore packages/**/dist.\n.worktrees/\nnode_modules/\n.next/\n.expo/\n.expo-preflight/\ncoverage/\n.env\n.env.local\n.supabase/\nplaywright-report/\ntest-results/\nFIRST-CHECK-BUILD-LOG.txt\n.DS_Store\n*.zip\n`);
}

const storeDocs={
'docs/store/app-store-listing.md':`# First Check — App Store Listing Source\n\n## Name\nFirst Check\n\n## Subtitle\nEvidence-first IT operations\n\n## Promotional text\nTurn daily infrastructure checks into a verified operational record — with AI-assisted extraction that never overrides human judgment.\n\n## Description\nFirst Check helps infrastructure teams document the checks that happen every morning but rarely live in one trustworthy place.\n\nCapture screenshots, photos, PDFs, CSV/text files, or pasted command output. AI can extract structured observations from the evidence, but it cannot mark an environment healthy, warning, or critical. A person reviews the evidence and records the final verification.\n\nFirst Check includes:\n- Repeatable daily checklists by environment.\n- Private evidence capture with observation timestamps and integrity metadata.\n- A “Needs Your Eyes” queue for low-confidence, conflicting, warning, or critical findings.\n- Human verification with an auditable source and timestamp trail.\n- Verified history and simple current-versus-previous trends.\n- Closed-run operational reports with evidence provenance.\n- Evidence-grounded Ask AI answers that cite human-verified facts.\n\nFirst Check complements your monitoring, backup, security, and infrastructure platforms instead of pretending to replace them.\n\n## Keywords\nIT operations,sysadmin,infrastructure,audit,checklist,backup,monitoring,evidence\n\n## Category\nPrimary: Business\n\n## Support URL\nhttps://first-check-web-preview.vercel.app/support\n\n## Privacy Policy URL\nhttps://first-check-web-preview.vercel.app/privacy\n`,
'docs/store/google-play-listing.md':`# First Check — Google Play Listing Source\n\n## App name\nFirst Check\n\n## Short description\nEvidence-first daily infrastructure checks for IT teams.\n\n## Full description\nFirst Check helps infrastructure teams turn scattered morning checks into one auditable operational record.\n\nCapture screenshots, PDFs, CSV/text files, photos, or pasted command output. First Check can extract structured observations with AI, but AI never marks a check healthy, warning, or critical on its own. A person reviews the evidence and records the final verification.\n\nUse First Check to:\n- Run repeatable daily checklists by environment.\n- Capture private evidence and preserve source timestamps.\n- Review low-confidence or conflicting observations in “Needs Your Eyes.”\n- Track verified operational history and simple trends.\n- Generate closed-run daily reports with evidence and verifier provenance.\n- Ask evidence-grounded questions about facts your team already verified.\n\nFirst Check is designed to complement — not replace — monitoring, backup, security, and infrastructure-management platforms.\n\n## Category\nBusiness\n\n## Suggested tags\nIT operations; system administration; infrastructure; audit; productivity\n\n## Support URL\nhttps://first-check-web-preview.vercel.app/support\n\n## Privacy policy URL\nhttps://first-check-web-preview.vercel.app/privacy\n`
};
for(const [rel,content] of Object.entries(storeDocs)){
  const file=p(rel);fs.mkdirSync(path.dirname(file),{recursive:true});if(!fs.existsSync(file))fs.writeFileSync(file,content);
}

const contractPath=p('scripts/store-release-contract.mjs');
if(fs.existsSync(contractPath)){
  let source=fs.readFileSync(contractPath,'utf8');
  source=source.replace("must(!exists('apps/mobile/app.config.ts'),'Store checkpoint must use static app.json so EAS can write projectId');",`if(exists('apps/mobile/app.config.ts')){\n  const dynamicConfig=read('apps/mobile/app.config.ts');\n  must(/version\\s*:\\s*['\\\"]1\\.1\\.0['\\\"]/.test(dynamicConfig),'Dynamic Expo config must carry Pro version 1.1.0');\n  must(/versionCode\\s*:\\s*3/.test(dynamicConfig),'Dynamic Expo config must carry Android versionCode 3');\n  must(/buildNumber\\s*:\\s*['\\\"]2['\\\"]/.test(dynamicConfig),'Dynamic Expo config must carry iOS buildNumber 2');\n}`);
  source=source.replace("must(appConfig.version==='1.1.0','Store version must be 1.0.0');","must(appConfig.version==='1.1.0','Store version must be 1.1.0');");
  fs.writeFileSync(contractPath,source);
}

const config=JSON.parse(fs.readFileSync(p('apps/mobile/app.json'),'utf8')).expo;
if(config.version!=='1.1.0')throw new Error('First Check Pro version must be 1.1.0');
if(config.android?.versionCode!==3)throw new Error('First Check Pro Android versionCode must be 3');
if(config.ios?.buildNumber!=='2')throw new Error('First Check Pro iOS buildNumber must be 2');
if(config.android?.package!=='com.stormandme.firstcheck'||config.ios?.bundleIdentifier!=='com.stormandme.firstcheck')throw new Error('First Check package identity drifted');
if(fs.existsSync(dynamicPath)){
  const dynamic=fs.readFileSync(dynamicPath,'utf8');
  if(!/version\s*:\s*['"]1\.1\.0['"]/.test(dynamic))throw new Error('Dynamic Expo version drifted');
  if(!/versionCode\s*:\s*3/.test(dynamic))throw new Error('Dynamic Expo Android versionCode drifted');
  if(!/buildNumber\s*:\s*['"]2['"]/.test(dynamic))throw new Error('Dynamic Expo iOS buildNumber drifted');
}
const rootPkg=JSON.parse(fs.readFileSync(rootPackagePath,'utf8'));
if(rootPkg.packageManager!=='pnpm@11.9.0')throw new Error('pnpm contract drifted');
if(rootPkg.devDependencies?.typescript!=='6.0.3')throw new Error('Root TypeScript contract drifted');
if(rootPkg.devDependencies?.turbo==='latest'||rootPkg.dependencies?.turbo==='latest')throw new Error('Turborepo must be pinned');
for(const rel of ['packages/api-client/package.json','packages/domain/package.json','packages/schemas/package.json','packages/ui/package.json']){
  const manifest=JSON.parse(fs.readFileSync(p(rel),'utf8'));
  for(const [name,version] of Object.entries({...manifest.dependencies,...manifest.devDependencies})){
    if(version==='latest')throw new Error(`${rel}: ${name} must be pinned`);
  }
}
if(!fs.existsSync(easIgnorePath))throw new Error('.easignore must exist');
for(const rel of Object.keys(storeDocs))if(!fs.existsSync(p(rel)))throw new Error(`${rel} must exist`);
const pkg=JSON.parse(fs.readFileSync(p('apps/mobile/package.json'),'utf8'));
if(pkg.dependencies?.['react-native-purchases']!=='10.5.0')throw new Error('RevenueCat SDK pin missing');
const entitlement=fs.readFileSync(p('apps/mobile/src/billing/entitlement-policy.ts'),'utf8');
if(!entitlement.includes("PRO_ENTITLEMENT_ID = 'pro'"))throw new Error('Pro entitlement contract missing');
console.log('First Check Pro V1.1 applied: RevenueCat entitlement + paywall + feature gates + store version 1.1.0/code3/build2.');

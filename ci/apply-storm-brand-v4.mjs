import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
const root=process.argv[2]??'build-src';
const p=(rel)=>path.join(root,rel);
const here=path.dirname(new URL(import.meta.url).pathname);
const encoded=[1,2,3,4,5].map(i=>fs.readFileSync(path.join(here,`storm-brand-v4.payload.part${String(i).padStart(2,'0')}`),'utf8').trim()).join('');
const payload=JSON.parse(zlib.gunzipSync(Buffer.from(encoded,'base64')).toString('utf8'));
for(const [rel,content] of Object.entries(payload)){const file=p(rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,content);}
{const f=p('packages/ui/src/tokens/colors.ts');let s=fs.readFileSync(f,'utf8');if(!s.includes('textOnAccent:'))s=s.replace("  onAccent: '#FFFFFF',\n","  onAccent: '#FFFFFF',\n  textOnAccent: '#FFFFFF',\n");fs.writeFileSync(f,s);}
const patchJson=(file)=>{const parsed=JSON.parse(fs.readFileSync(file,'utf8'));const expo=parsed.expo??parsed;expo.android??={};expo.android.versionCode=2;if(Array.isArray(expo.plugins))for(const plugin of expo.plugins)if(Array.isArray(plugin)&&plugin[0]==='expo-splash-screen'){plugin[1]??={};plugin[1].backgroundColor='#07111F';}fs.writeFileSync(file,JSON.stringify(parsed,null,2)+'\n');};
const patchTs=(file)=>{let source=fs.readFileSync(file,'utf8');if(/versionCode\s*:\s*\d+/.test(source))source=source.replace(/versionCode\s*:\s*\d+/,'versionCode: 2');else if(/android\s*:\s*{/.test(source))source=source.replace(/android\s*:\s*{/,'android:{versionCode: 2,');else throw new Error('apps/mobile/app.config.ts: android config block not found');source=source.replace(/backgroundColor\s*:\s*['\"]#F6F8FC['\"]/g,"backgroundColor:'#07111F'");fs.writeFileSync(file,source);};
const appTs=p('apps/mobile/app.config.ts'),appJson=p('apps/mobile/app.json');if(fs.existsSync(appTs))patchTs(appTs);if(fs.existsSync(appJson))patchJson(appJson);if(!fs.existsSync(appTs)&&!fs.existsSync(appJson))throw new Error('No Expo app config found');
const must=(rel,value)=>{const source=fs.readFileSync(p(rel),'utf8');if(!source.includes(value))throw new Error(`${rel} missing V4 marker: ${value}`);};
must('apps/mobile/src/brand/brand-intro.tsx','Storm And Me Studios');must('apps/mobile/src/brand/brand-intro.tsx','Vibration.vibrate');must('packages/ui/src/tokens/colors.ts',"brandNavy: '#07111F'");must('apps/mobile/app/sign-in.tsx','colors.glass');must('apps/mobile/app/(tabs)/today.tsx','colors.glass');must('apps/mobile/app/(tabs)/ask-ai.tsx','colors.glass');
// Google Play already received versionCode 1; this replacement is versionCode: 2.
const config=fs.existsSync(appTs)?fs.readFileSync(appTs,'utf8'):fs.readFileSync(appJson,'utf8');if(!/versionCode[\s\"':]*2/.test(config))throw new Error('Android versionCode 2 was not applied');if(!config.includes('#07111F'))throw new Error('Storm And Me dark launch splash was not applied');
console.log('First Check V4 brand polish applied: Storm And Me Studios intro + premium glass + versionCode 2.');

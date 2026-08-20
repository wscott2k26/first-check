import fs from 'node:fs';
import path from 'node:path';

const root=process.argv[2]??'build-src';
const p=(rel)=>path.join(root,rel);
const must=(condition,message)=>{if(!condition)throw new Error(message);};
const read=(rel)=>fs.readFileSync(p(rel),'utf8');

const index='apps/mobile/app/index.tsx';
must(fs.existsSync(p(index)),'Startup regression: apps/mobile/app/index.tsx is missing, so firstcheck:/// has no root route.');
const indexSource=read(index);
must(indexSource.includes("from 'expo-router'"),'Startup regression: root route must use Expo Router.');
must(indexSource.includes('useSession'),'Startup regression: root route must resolve auth state.');
must(indexSource.includes('<Redirect href="/sign-in"'),'Startup regression: signed-out launch must redirect to /sign-in.');
must(indexSource.includes('<Redirect href="/today"'),'Startup regression: signed-in launch must redirect to /today.');

const layout=read('apps/mobile/app/_layout.tsx');
must(layout.includes('<Stack.Screen name="index" />'),'Startup regression: root index route is not registered in the root Stack.');

const appJson=JSON.parse(read('apps/mobile/app.json'));
must(appJson.expo?.version==='1.0.1',`Startup regression: expected version 1.0.1, got ${appJson.expo?.version}`);
must(appJson.expo?.android?.versionCode===3,`Startup regression: expected Android versionCode 3, got ${appJson.expo?.android?.versionCode}`);

const signIn=read('apps/mobile/app/sign-in.tsx');
must(signIn.includes('Sign in to First Check'),'Startup regression: polished First Check sign-in destination is missing.');
must(!signIn.includes('Page could not be found'),'Startup regression: unmatched-route copy leaked into the sign-in experience.');

console.log('PASS: First Check emergency startup route contract is present (root -> sign-in/today, 1.0.1 code 3).');

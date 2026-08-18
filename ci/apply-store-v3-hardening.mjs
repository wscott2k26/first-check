import fs from 'node:fs';
import path from 'node:path';
const root=process.argv[2]??'build-src';
const p=(x)=>path.join(root,x);
const read=(x)=>fs.readFileSync(p(x),'utf8');
const write=(x,s)=>fs.writeFileSync(p(x),s);
const mustReplace=(x,a,b)=>{const s=read(x);if(!s.includes(a))throw new Error(`Missing expected text in ${x}: ${a.slice(0,80)}`);write(x,s.replace(a,b));};

// Lock mobile dependencies to the exact Expo SDK 57-compatible line proven by the release audit.
{
 const f='apps/mobile/package.json'; const j=JSON.parse(read(f));
 Object.assign(j.dependencies,{
  expo:'~57.0.14','expo-router':'~57.0.14','expo-status-bar':'~57.0.1',
  'react-native-safe-area-context':'~5.7.0','react-native-screens':'~4.26.0',
  'expo-image-picker':'~57.0.11','@supabase/supabase-js':'2.111.0','react-native-url-polyfill':'4.0.0',
  'expo-constants':'~57.0.12','expo-linking':'~57.0.4','expo-splash-screen':'~57.0.7','expo-system-ui':'~57.0.2'
 });
 delete j.dependencies['expo-sharing'];
 j.devDependencies={'@types/react':'~19.2.2',typescript:'6.0.3'};
 j.expo={doctor:{reactNativeDirectoryCheck:{exclude:['@first-check/api-client','@first-check/domain','@first-check/schemas','@first-check/ui'],listUnknownPackages:false}}};
 write(f,JSON.stringify(j,null,2)+'\n');
}

// Store identity/privacy/splash configuration.
{
 const f='apps/mobile/app.config.ts'; let s=read(f);
 s=s.replace("version:'0.1.0'","version:'1.0.0'");
 s=s.replace("privacyManifests:{","config:{usesNonExemptEncryption:false},\n    privacyManifests:{");
 s=s.replace("'expo-router',\n    'expo-secure-store',","'expo-router',\n    ['expo-splash-screen',{backgroundColor:'#F6F8FC',image:'./assets/icon.png',imageWidth:160,resizeMode:'contain'}],\n    'expo-secure-store',");
 write(f,s);
}

// Supabase React Native session serialization + safe public release fallback.
mustReplace('apps/mobile/src/supabase/client.ts',"import { createClient } from '@supabase/supabase-js';","import { createClient, processLock } from '@supabase/supabase-js';");
mustReplace('apps/mobile/src/supabase/client.ts',"const url=process.env.EXPO_PUBLIC_SUPABASE_URL;\nconst key=process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;\nif(!url||!key)throw new Error('Supabase mobile configuration is missing');","const url=process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://dedjopeislkywjgytolc.supabase.co';\nconst key=process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_26aW-dQfwaZzs7eCJuUMfQ_5Op3nn6X';");
mustReplace('apps/mobile/src/supabase/client.ts','auth:{autoRefreshToken:true,persistSession:false,detectSessionInUrl:false}','auth:{autoRefreshToken:true,persistSession:false,detectSessionInUrl:false,lock:processLock}');

// Closed-run report recovery uses the proven idempotent /close route; the old /reports POST does not exist.
mustReplace('apps/mobile/src/api/operations.ts',"export function generateReport(runId:string){return request<{report:{id:string;document:import('@first-check/schemas').DailyReportDocument;html:string}}>('POST',`/v1/check-runs/${runId}/reports`);","export async function generateReport(runId:string){const result=await closeCheckRun(runId);if(!result.report)throw new Error(result.reportError??'Report is unavailable.');return {report:result.report};}");

// Evidence pickers sometimes omit MIME on Android. Infer only the file types the API allows.
{
 const f='apps/mobile/features/evidence/capture-evidence.tsx'; let s=read(f);
 const marker="type PendingEvidence = { name: string; uri: string; mimeType: string };";
 if(!s.includes('const inferEvidenceMime=')){
  s=s.replace(marker,marker+`\n\nconst inferEvidenceMime=(name:string):string|null=>{\n  const lower=name.toLowerCase();\n  if(lower.endsWith('.pdf'))return 'application/pdf';\n  if(lower.endsWith('.csv'))return 'text/csv';\n  if(lower.endsWith('.txt')||lower.endsWith('.log'))return 'text/plain';\n  if(lower.endsWith('.png'))return 'image/png';\n  if(lower.endsWith('.jpg')||lower.endsWith('.jpeg'))return 'image/jpeg';\n  return null;\n};`);
 }
 s=s.replace("setPending({name:asset.name,uri:asset.uri,mimeType:asset.mimeType??'application/octet-stream'});","const mimeType=asset.mimeType??inferEvidenceMime(asset.name);if(!mimeType){setMessage('Could not determine this file type. Choose a PDF, CSV, TXT, PNG, JPG, or JPEG file.');return;}setPending({name:asset.name,uri:asset.uri,mimeType});");
 s=s.replace("if(!permission.granted)return;","if(!permission.granted){setMessage('Camera permission is required to capture evidence.');return;}");
 write(f,s);
}

// Remove stale pre-Air naming if it survived an older payload.
for(const f of ['apps/mobile/app/workspace.tsx','apps/mobile/app/(tabs)/today.tsx']){
 if(fs.existsSync(p(f))) write(f,read(f).replaceAll('MISSION CONTROL','WORKSPACE').replaceAll('Loading Mission Control…','Loading First Check…'));
}

console.log('First Check V3 store hardening applied.');

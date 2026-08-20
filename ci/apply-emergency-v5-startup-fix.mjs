import fs from 'node:fs';
import path from 'node:path';

const root=process.argv[2]??'build-src';
const p=(rel)=>path.join(root,rel);
const read=(rel)=>fs.readFileSync(p(rel),'utf8');
const write=(rel,content)=>{const file=p(rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,content);};

// Root launcher route. Google Play launches firstcheck:/// on a clean install; without app/index.tsx
// Expo Router renders its unmatched-route screen instead of the product sign-in experience.
write('apps/mobile/app/index.tsx',`import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { colors } from '@first-check/ui';
import { useSession } from '../src/auth/session-provider';

export default function IndexScreen() {
  const { session, loading } = useSession();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}>
        <ActivityIndicator color={colors.accentCyan} />
      </View>
    );
  }

  if (session) return <Redirect href="/today" />;
  return <Redirect href="/sign-in" />;
}
`);

// Register the root route explicitly so auth-protected route groups cannot shadow clean-launch routing.
{
  const rel='apps/mobile/app/_layout.tsx';
  let source=read(rel);
  if(!source.includes('<Stack.Screen name="index" />')){
    const marker='<Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>';
    if(!source.includes(marker))throw new Error('Emergency startup fix: root Stack insertion point not found.');
    source=source.replace(marker,`${marker}\n        <Stack.Screen name="index" />`);
  }
  write(rel,source);
}

let identityPatched=false;

// app.config.ts is the source of truth in the CI lineage that produced the Play AAB.
{
  const rel='apps/mobile/app.config.ts';
  if(fs.existsSync(p(rel))){
    let source=read(rel);
    if(/version\s*:\s*['"][^'"]+['"]/.test(source)) source=source.replace(/version\s*:\s*['"][^'"]+['"]/,'version:\'1.0.1\'');
    else throw new Error('Emergency startup fix: app.config.ts version field not found.');
    if(/versionCode\s*:\s*\d+/.test(source)) source=source.replace(/versionCode\s*:\s*\d+/,'versionCode: 3');
    else if(/android\s*:\s*{/.test(source)) source=source.replace(/android\s*:\s*{/,'android:{versionCode: 3,');
    else throw new Error('Emergency startup fix: app.config.ts android block not found.');
    write(rel,source);
    identityPatched=true;
  }
}

// Keep app.json aligned when a source backup carries one, without requiring it in the CI reconstruction.
{
  const rel='apps/mobile/app.json';
  if(fs.existsSync(p(rel))){
    const parsed=JSON.parse(read(rel));
    if(!parsed.expo)throw new Error('Emergency startup fix: app.json expo object missing.');
    parsed.expo.version='1.0.1';
    parsed.expo.android??={};
    parsed.expo.android.versionCode=3;
    write(rel,JSON.stringify(parsed,null,2)+'\n');
    identityPatched=true;
  }
}
if(!identityPatched)throw new Error('Emergency startup fix: no Expo app config found.');

// Keep the visible version receipt honest on the polished sign-in screen.
{
  const rel='apps/mobile/app/sign-in.tsx';
  let source=read(rel);
  source=source.replace('Storm And Me Studios · First Check 1.0</Text>','Storm And Me Studios · First Check 1.0.1</Text>');
  write(rel,source);
}

console.log('First Check emergency V5 startup recovery applied: deterministic / route + 1.0.1 / Android code 3.');

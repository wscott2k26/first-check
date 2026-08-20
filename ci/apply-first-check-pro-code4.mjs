import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2] ?? 'build-src';
const p = (rel) => path.join(root, rel);
const read = (rel) => fs.readFileSync(p(rel), 'utf8');
const write = (rel, content) => {
  const file = p(rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};

// Carry the Google Play clean-launch recovery forward into Pro.
write('apps/mobile/app/index.tsx', `import { Redirect } from 'expo-router';
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

{
  const rel = 'apps/mobile/app/_layout.tsx';
  let source = read(rel);
  if (!source.includes('<Stack.Screen name="index" />')) {
    const marker = '<Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>';
    if (!source.includes(marker)) throw new Error('Pro code4: root Stack insertion point not found');
    source = source.replace(marker, `${marker}\n        <Stack.Screen name="index" />`);
  }
  write(rel, source);
}

// Android code 3 is occupied by the crash-recovery submission.
// Pro remains 1.1.0 but advances to code 4. iOS build stays 2.
{
  const rel = 'apps/mobile/app.config.ts';
  let source = read(rel);
  if (/version\s*:\s*['"][^'"]+['"]/.test(source)) {
    source = source.replace(/version\s*:\s*['"][^'"]+['"]/, "version:'1.1.0'");
  } else throw new Error('Pro code4: dynamic version field missing');
  if (/versionCode\s*:\s*\d+/.test(source)) {
    source = source.replace(/versionCode\s*:\s*\d+/, 'versionCode:4');
  } else throw new Error('Pro code4: dynamic Android versionCode field missing');
  if (/buildNumber\s*:\s*['"][^'"]+['"]/.test(source)) {
    source = source.replace(/buildNumber\s*:\s*['"][^'"]+['"]/, "buildNumber:'2'");
  }
  write(rel, source);
}

{
  const rel = 'apps/mobile/app.json';
  const parsed = JSON.parse(read(rel));
  parsed.expo.version = '1.1.0';
  parsed.expo.android ??= {};
  parsed.expo.android.versionCode = 4;
  parsed.expo.ios ??= {};
  parsed.expo.ios.buildNumber = '2';
  write(rel, JSON.stringify(parsed, null, 2) + '\n');
}

// Expo's compatibility checker is a release gate. Pin the exact SDK 57 patch line it requires.
{
  const rel = 'apps/mobile/package.json';
  const pkg = JSON.parse(read(rel));
  pkg.dependencies ??= {};
  const required = {
    expo: '~57.0.15',
    'expo-router': '~57.0.15',
    'expo-image-picker': '~57.0.12',
    'expo-file-system': '~57.0.5',
    'expo-constants': '~57.0.13',
    'expo-linking': '~57.0.7',
  };
  for (const [name, version] of Object.entries(required)) pkg.dependencies[name] = version;
  write(rel, JSON.stringify(pkg, null, 2) + '\n');
}

// Keep release-contract tests synchronized with the new immutable Play version code.
for (const rel of [
  'scripts/store-release-contract.mjs',
  'scripts/pro-release-contract.test.mjs',
  'scripts/brand-polish.test.mjs',
]) {
  if (!fs.existsSync(p(rel))) continue;
  let source = read(rel);
  source = source
    .replace(/versionCode\\s\*:\\s\*3/g, 'versionCode\\s*:\\s*4')
    .replace(/versionCode\s*:\s*3\b/g, 'versionCode: 4')
    .replace(/versionCode\s*,\s*3\b/g, 'versionCode, 4')
    .replace(/versionCode\s*===\s*3\b/g, 'versionCode === 4')
    .replace(/versionCode\s*!==\s*3\b/g, 'versionCode !== 4')
    .replace(/versionCode\s+3\b/g, 'versionCode 4')
    .replace(/Android versionCode 3/g, 'Android versionCode 4')
    .replace(/code3/g, 'code4')
    .replace(/code 3/g, 'code 4');
  write(rel, source);
}

// Synchronize the deterministic store contract with Expo's current SDK 57 patch set.
{
  const rel = 'scripts/store-release-contract.mjs';
  if (fs.existsSync(p(rel))) {
    let source = read(rel);
    const replacements = new Map([
      ['~57.0.9', '~57.0.15'],
      ['~57.0.14', '~57.0.15'],
      ['~57.0.11', '~57.0.12'],
      ['~57.0.4', '~57.0.5'],
      ['~57.0.12', '~57.0.13'],
      ['~57.0.6', '~57.0.7'],
    ]);
    for (const [oldVersion, newVersion] of replacements) source = source.split(oldVersion).join(newVersion);
    write(rel, source);
  }
}

// Visible receipt on the sign-in experience.
{
  const rel = 'apps/mobile/app/sign-in.tsx';
  if (fs.existsSync(p(rel))) {
    let source = read(rel);
    source = source
      .replace('Storm And Me Studios · First Check 1.0.1</Text>', 'Storm And Me Studios · First Check 1.1</Text>')
      .replace('Storm And Me Studios · First Check 1.0</Text>', 'Storm And Me Studios · First Check 1.1</Text>');
    write(rel, source);
  }
}

console.log('First Check Pro preparation applied: 1.1.0 / Android code 4 / iOS build 2 + clean-launch recovery + Expo 57 patch alignment.');

import fs from 'node:fs';
import path from 'node:path';
const root = process.argv[2];
if (!root) throw new Error('usage: node apply-premium-mobile-theme.mjs <source-root>');
const p = rel => path.join(root, rel);
const replaceExact = (rel, from, to) => {
  const file = p(rel);
  const before = fs.readFileSync(file,'utf8');
  if (!before.includes(from)) throw new Error(`${rel}: expected source pattern not found: ${from}`);
  fs.writeFileSync(file, before.replaceAll(from,to));
};
const tokens = `export const colors = {
  canvas: '#F6F8FC',
  surface900: '#FFFFFF',
  surface850: '#F0F4F9',
  surface800: '#E3E8EF',
  textPrimary: '#111827',
  textSecondary: '#526071',
  textMuted: '#7D8998',
  textOnAccent: '#FFFFFF',
  accentIndigo: '#5B67F1',
  accentCyan: '#36C5F0',
  status: {
    healthy: '#1F9D72',
    warning: '#B7791F',
    critical: '#DC3E52'
  }
} as const;
`;
fs.writeFileSync(p('packages/ui/src/tokens/colors.ts'), tokens);
const tokenTest = `import { describe, expect, it } from 'vitest';
import { colors, motion, radii, spacing } from '../src/index.js';

describe('First Check Air tokens', () => {
  it('keeps the premium light semantic palette exact', () => {
    expect(colors.canvas).toBe('#F6F8FC');
    expect(colors.surface900).toBe('#FFFFFF');
    expect(colors.surface850).toBe('#F0F4F9');
    expect(colors.surface800).toBe('#E3E8EF');
    expect(colors.textPrimary).toBe('#111827');
    expect(colors.textSecondary).toBe('#526071');
    expect(colors.textMuted).toBe('#7D8998');
    expect(colors.textOnAccent).toBe('#FFFFFF');
    expect(colors.accentIndigo).toBe('#5B67F1');
    expect(colors.accentCyan).toBe('#36C5F0');
    expect(colors.status).toEqual({ healthy: '#1F9D72', warning: '#B7791F', critical: '#DC3E52' });
  });
  it('never reuses accent colors for operational status', () => {
    const accents = new Set([colors.accentIndigo, colors.accentCyan]);
    expect(accents.has(colors.status.healthy)).toBe(false);
    expect(accents.has(colors.status.warning)).toBe(false);
    expect(accents.has(colors.status.critical)).toBe(false);
  });
  it('uses the frozen spacing, radius and motion scales', () => {
    expect(spacing).toEqual({ half: 4, xs: 8, sm: 16, md: 24, lg: 32, xl: 40, xxl: 48 });
    expect(radii).toEqual({ sm: 10, md: 14, lg: 20, xl: 28 });
    expect(motion.duration).toEqual({ fast: 120, standard: 180, deliberate: 280 });
  });
});
`;
fs.writeFileSync(p('packages/ui/test/tokens.test.ts'), tokenTest);
replaceExact('apps/mobile/app/_layout.tsx','<StatusBar style="light"/>','<StatusBar style="dark"/>');
replaceExact('apps/mobile/app/sign-in.tsx','<Text style={s.title}>Mission Control</Text><Text style={s.copy}>Sign in to your Storm And Me workspace.</Text>','<Text style={s.title}>Know what’s healthy.</Text><Text style={s.copy}>Evidence-first daily checks, verified by people and backed by the proof.</Text>');
replaceExact('apps/mobile/app/(tabs)/today.tsx','Loading Mission Control…','Loading First Check…');
for (const rel of [
  'apps/mobile/features/evidence/capture-evidence.tsx',
  'apps/mobile/app/(tabs)/ask-ai.tsx',
  'apps/mobile/app/(tabs)/today.tsx',
  'apps/mobile/app/workspace.tsx',
  'apps/mobile/app/report/[reportId].tsx',
  'apps/mobile/app/sign-in.tsx',
]) {
  const file = p(rel);
  const before = fs.readFileSync(file,'utf8');
  const after = before
    .replaceAll('primaryText:{color:colors.textPrimary','primaryText:{color:colors.textOnAccent')
    .replaceAll('uploadText:{color:colors.textPrimary','uploadText:{color:colors.textOnAccent')
    .replaceAll('shareText:{color:colors.textPrimary','shareText:{color:colors.textOnAccent');
  if (after === before && /(primary|upload|share)Text:\{color:colors\.textPrimary/.test(before)) throw new Error(`${rel}: failed to migrate accent button text`);
  fs.writeFileSync(file, after);
}
console.log('Applied First Check Air mobile theme.');

const loadedFonts = new Set<string>();

/** listAvailableFontsAsync 结果缓存：按 family 归一化名聚合 */
let availableFontsByFamily: Map<string, FontName[]> | null = null;

async function ensureAvailableFonts(): Promise<Map<string, FontName[]>> {
  if (availableFontsByFamily) return availableFontsByFamily;
  const list = await figma.listAvailableFontsAsync();
  const byFamily = new Map<string, FontName[]>();
  for (const { fontName } of list) {
    const key = fontName.family.trim().toLowerCase();
    if (!byFamily.has(key)) byFamily.set(key, []);
    byFamily.get(key)!.push(fontName);
  }
  availableFontsByFamily = byFamily;
  return byFamily;
}

function fontKey(family: string, style: string): string {
  return `${family}::${style}`;
}

/** 数字字重 → 字重枚举（PingFang SC 合法命名：Ultralight / Thin / Light / Regular / Medium / Semibold；700+ 用 Semibold，Bold/Extra Bold/Black 在 PingFang 中不合法） */
function figmaFontStyle(weight?: number, italic?: boolean): string {
  const w = weight ?? 400;
  const base = (() => {
    if (w <= 100) return 'Thin';
    if (w <= 200) return 'Ultralight';
    if (w <= 300) return 'Light';
    if (w <= 400) return 'Regular';
    if (w <= 500) return 'Medium';
    if (w >= 600) return 'Semibold';
    return 'Regular';
  })();

  if (italic && base === 'Regular') return 'Italic';
  if (italic) return base + ' Italic';
  return base;
}

async function tryLoadFont(family: string, style: string): Promise<FontName | null> {
  const key = fontKey(family, style);
  if (loadedFonts.has(key)) return { family, style };
  try {
    await figma.loadFontAsync({ family, style });
    loadedFonts.add(key);
    return { family, style };
  } catch {
    return null;
  }
}

const SYSTEM_OR_GENERIC_FONTS = /^(-apple-system|blinkmacsystemfont|system-ui|arial|helvetica\s*neue|helvetica|sans-serif|serif|monospace)$/i;
const SF_UI_TEXT = /^SF\s+UI\s+Text$/i;
const SEGOE_OR_ROBOTO = /^(Segoe\s+UI|Roboto)$/i;

function resolveFamilyForFigma(family?: string): string {
  const raw = (family ?? '').trim();
  if (!raw) return 'PingFang SC';
  if (SYSTEM_OR_GENERIC_FONTS.test(raw)) return 'PingFang SC';
  if (SF_UI_TEXT.test(raw)) return 'PingFang SC';
  if (SEGOE_OR_ROBOTO.test(raw)) return 'PingFang SC';
  return raw;
}

/** 从「可用字体」里按字重/斜体选最合适的 style，再 load；找不到则返回 null */
async function tryMatchAndLoadFromAvailable(
  available: Map<string, FontName[]>,
  family: string,
  weight: number,
  italic: boolean
): Promise<FontName | null> {
  const key = family.trim().toLowerCase();
  const list = available.get(key);
  if (!list || list.length === 0) return null;

  const desiredStyle = figmaFontStyle(weight, italic);
  const sameFamilyFallbacks: string[] = [
    desiredStyle,
    figmaFontStyle(weight, false),
    ...(italic ? ['Italic'] : []),
    'Regular',
  ];

  for (const s of sameFamilyFallbacks) {
    const found = list.find((fn) => fn.style === s);
    if (found) {
      const loaded = await tryLoadFont(found.family, found.style);
      if (loaded) return loaded;
    }
  }
  // 任意该 family 的 style 能 load 即可
  for (const fn of list) {
    const loaded = await tryLoadFont(fn.family, fn.style);
    if (loaded) return loaded;
  }
  return null;
}

export async function loadFont(
  family?: string,
  weight?: number,
  italic?: boolean,
  familyStack?: string[]
): Promise<FontName> {
  const normalizedWeight = weight != null ? Number(weight) : 400;
  const isItalic = italic === true;

  const candidateFamilies: string[] = [];
  if (familyStack && familyStack.length > 0) {
    const seen = new Set<string>();
    for (const raw of familyStack) {
      const resolved = resolveFamilyForFigma(raw);
      if (resolved && !seen.has(resolved)) {
        seen.add(resolved);
        candidateFamilies.push(resolved);
      }
    }
  }
  if (candidateFamilies.length === 0) {
    const fam = resolveFamilyForFigma(family);
    if (fam) candidateFamilies.push(fam);
  }

  const available = await ensureAvailableFonts();

  for (const fam of candidateFamilies) {
    const matched = await tryMatchAndLoadFromAvailable(available, fam, normalizedWeight, isItalic);
    if (matched) return matched;
  }

  // 未在可用列表中找到：按原逻辑按名字尝试加载 + 回退
  const fam = candidateFamilies[0] ?? resolveFamilyForFigma(family);
  const style = figmaFontStyle(normalizedWeight, isItalic);

  const exact = await tryLoadFont(fam, style);
  if (exact) return exact;

  const sameFamilyFallbacks: string[] = [];
  if (normalizedWeight !== 400) sameFamilyFallbacks.push(figmaFontStyle(normalizedWeight, false));
  if (isItalic) sameFamilyFallbacks.push('Italic');
  sameFamilyFallbacks.push('Regular');
  for (const s of sameFamilyFallbacks) {
    const loaded = await tryLoadFont(fam, s);
    if (loaded) return loaded;
  }

  const interWeightStyle = figmaFontStyle(normalizedWeight, false);
  const interLoaded = await tryLoadFont('Inter', interWeightStyle);
  if (interLoaded) return interLoaded;
  const interRegularLoaded = await tryLoadFont('Inter', 'Regular');
  if (interRegularLoaded) return interRegularLoaded;

  const pingFang = await tryLoadFont('PingFang SC', 'Regular');
  if (pingFang) return pingFang;
  const interRegular: FontName = { family: 'Inter', style: 'Regular' };
  await tryLoadFont('Inter', 'Regular');
  return interRegular;
}

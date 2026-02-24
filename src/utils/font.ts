const loadedFonts = new Set<string>();

function fontKey(family: string, style: string): string {
  return `${family}::${style}`;
}

function figmaFontStyle(weight?: number, italic?: boolean): string {
  const w = weight ?? 400;
  const base = (() => {
    if (w <= 100) return 'Thin';
    if (w <= 200) return 'ExtraLight';
    if (w <= 300) return 'Light';
    if (w <= 400) return 'Regular';
    if (w <= 500) return 'Medium';
    if (w <= 600) return 'SemiBold';
    if (w <= 700) return 'Bold';
    if (w <= 800) return 'ExtraBold';
    return 'Black';
  })();

  if (italic && base === 'Regular') return 'Italic';
  if (italic) return base + ' Italic';
  return base;
}

export async function loadFont(
  family?: string,
  weight?: number,
  italic?: boolean
): Promise<FontName> {
  const fam = family ?? 'Inter';
  const style = figmaFontStyle(weight, italic === true);
  const key = fontKey(fam, style);

  if (!loadedFonts.has(key)) {
    try {
      await figma.loadFontAsync({ family: fam, style });
      loadedFonts.add(key);
    } catch (_e) {
      // Fallback: try Inter Regular
      const fallback: FontName = { family: 'Inter', style: 'Regular' };
      await figma.loadFontAsync(fallback);
      loadedFonts.add(fontKey('Inter', 'Regular'));
      return fallback;
    }
  }

  return { family: fam, style };
}

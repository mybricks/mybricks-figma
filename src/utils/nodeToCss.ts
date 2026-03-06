/**
 * Converts a Figma node's visual/layout properties to a CSS string for Dev Mode display.
 */

function rgbToCss(color: RGB, opacity?: number): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  const a = opacity ?? 1;
  if (a < 1) {
    return `rgba(${r}, ${g}, ${b}, ${Math.round(a * 100) / 100})`;
  }
  return `rgb(${r}, ${g}, ${b})`;
}

function paintToCss(paint: SolidPaint): string | null {
  if (paint.type !== 'SOLID') return null;
  return rgbToCss(paint.color, paint.opacity);
}

const lines: string[] = [];
const cssObj: Record<string, string> = {};

function add(key: string, value: string): void {
  if (value) {
    lines.push(`  ${key}: ${value};`);
    cssObj[key] = value;
  }
}

function beginCssCollect(): void {
  lines.length = 0;
  for (const k of Object.keys(cssObj)) delete cssObj[k];
}

/** Returns CSS properties object (key = property name, value = CSS value) for sync styles. */
export function nodeToCssObject(node: SceneNode): Record<string, string> {
  beginCssCollect();
  collectCss(node);
  return { ...cssObj };
}

function collectCss(node: SceneNode): void {
  // LayoutMixin: width, height
  if ('width' in node && 'height' in node) {
    const n = node as LayoutMixin;
    add('width', `${n.width}px`);
    add('height', `${n.height}px`);
  }

  // BlendMixin: opacity
  if ('opacity' in node) {
    const n = node as BlendMixin;
    if (n.opacity < 1) add('opacity', String(n.opacity));
  }

  // GeometryMixin: fills → background (skip TEXT: its fills are text color, handled below)
  if ('fills' in node && node.type !== 'TEXT') {
    const n = node as GeometryMixin;
    const fills = n.fills;
    if (fills !== figma.mixed && Array.isArray(fills) && fills.length > 0) {
      const first = fills[0];
      const css = first && 'color' in first ? paintToCss(first as SolidPaint) : null;
      if (css) add('background', css);
    }
  }
  if ('strokes' in node) {
    const n = node as GeometryMixin;
    const strokes = n.strokes;
    if (strokes !== figma.mixed && Array.isArray(strokes) && strokes.length > 0) {
      const first = strokes[0];
      const color = first && 'color' in first ? paintToCss(first as SolidPaint) : null;
      const weight = 'strokeWeight' in n && typeof n.strokeWeight === 'number' ? n.strokeWeight : 1;
      if (color) add('border', `${weight}px solid ${color}`);
    }
  }
  if ('cornerRadius' in node) {
    const n = node as RectangleNode | FrameNode | ComponentNode;
    if (typeof n.cornerRadius === 'number' && n.cornerRadius > 0) {
      add('border-radius', `${n.cornerRadius}px`);
    }
  }

  // Effects (shadow)
  if ('effects' in node) {
    const n = node as BlendMixin;
    const effects = n.effects;
    if (Array.isArray(effects)) {
      const shadows = effects
        .filter((e): e is DropShadowEffect => e.type === 'DROP_SHADOW' && e.visible)
        .map((e) => {
          const c = e.color;
          const color = rgbToCss({ r: c.r, g: c.g, b: c.b }, c.a);
          const spread = 'spread' in e ? (e as DropShadowEffect).spread ?? 0 : 0;
          return `${e.offset.x}px ${e.offset.y}px ${e.radius}px ${spread}px ${color}`;
        });
      if (shadows.length > 0) add('box-shadow', shadows.join(', '));
    }
  }

  // Auto-layout (FrameNode / ComponentNode)
  if ('layoutMode' in node) {
    const n = node as FrameNode | ComponentNode;
    if (n.layoutMode !== 'NONE') {
      add('display', 'flex');
      add('flex-direction', n.layoutMode === 'VERTICAL' ? 'column' : 'row');
      if (n.itemSpacing > 0) add('gap', `${n.itemSpacing}px`);
      const pt = n.paddingTop ?? 0;
      const pr = n.paddingRight ?? 0;
      const pb = n.paddingBottom ?? 0;
      const pl = n.paddingLeft ?? 0;
      if (pt || pr || pb || pl) {
        add('padding', `${pt}px ${pr}px ${pb}px ${pl}px`);
      }
      const alignMap: Record<string, string> = {
        MIN: 'flex-start',
        CENTER: 'center',
        MAX: 'flex-end',
        SPACE_BETWEEN: 'space-between',
      };
      if (n.layoutMode === 'VERTICAL') {
        const v = alignMap[n.primaryAxisAlignItems] ?? n.primaryAxisAlignItems;
        const h = alignMap[n.counterAxisAlignItems] ?? n.counterAxisAlignItems;
        if (v) add('justify-content', v);
        if (h) add('align-items', h);
      } else {
        const h = alignMap[n.primaryAxisAlignItems] ?? n.primaryAxisAlignItems;
        const v = alignMap[n.counterAxisAlignItems] ?? n.counterAxisAlignItems;
        if (h) add('justify-content', h);
        if (v) add('align-items', v);
      }
    }
  }

  // TextNode
  if (node.type === 'TEXT') {
    const t = node as TextNode;
    const fontSize = t.fontSize !== figma.mixed ? t.fontSize : 14;
    add('font-size', `${fontSize}px`);
    if (t.fills !== figma.mixed && Array.isArray(t.fills) && t.fills.length > 0) {
      const first = t.fills[0];
      const css = first && 'color' in first ? paintToCss(first as SolidPaint) : null;
      if (css) add('color', css);
    }
    if (t.fontName !== figma.mixed) {
      const font = t.fontName as FontName;
      const family = font.family + (font.style !== 'Regular' ? ` ${font.style}` : '');
      add('font-family', family);
    }
  }
}

export function nodeToCss(node: SceneNode): string {
  beginCssCollect();
  collectCss(node);
  return lines.join('\n');
}

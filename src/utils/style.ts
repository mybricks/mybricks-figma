import type { StyleJSON, FillObject, ShadowEffect, BlurEffect } from '../types';
import { parseColorWithOpacity } from './color';

export function applyBaseStyle(node: SceneNode, style?: StyleJSON, skipResizeForText?: boolean): void {
  if (!style) return;

  if (style.x !== undefined) node.x = style.x;
  if (style.y !== undefined) node.y = style.y;
  if (style.rotation !== undefined && 'rotation' in node) {
    (node as SceneNode & { rotation: number }).rotation = style.rotation;
  }

  const isText = node.type === 'TEXT';
  if ('resize' in node && !(skipResizeForText && isText)) {
    const w = style.width;
    const h = style.height;
    if (w !== undefined && h !== undefined) {
      (node as GeometryMixin & LayoutMixin).resize(w, h);
    } else if (w !== undefined) {
      (node as GeometryMixin & LayoutMixin).resize(w, (node as any).height ?? 100);
    } else if (h !== undefined) {
      (node as GeometryMixin & LayoutMixin).resize((node as any).width ?? 100, h);
    }
    if (isText) {
      console.log('[applyBaseStyle] TEXT was resized! w:', style.width, 'h:', style.height, 'textAutoResize after:', (node as any).textAutoResize);
    }
  } else if (isText) {
    console.log('[applyBaseStyle] TEXT skip resize (skipResizeForText=', skipResizeForText, ') textAutoResize:', (node as any).textAutoResize, '| w:', style.width, 'h:', style.height);
  }

  if (style.opacity !== undefined && 'opacity' in node) {
    (node as BlendMixin).opacity = style.opacity;
  }

  if (style.constraints && 'constraints' in node) {
    const c = style.constraints;
    (node as ConstraintMixin).constraints = {
      horizontal: c.horizontal ?? 'MIN',
      vertical: c.vertical ?? 'MIN',
    };
  }
}

/**
 * 线性渐变角度 → Figma gradientTransform（2x3）。
 * 使 0%/100% 色标正好落在图层边界上（渐变线从一边拉到对边，不超出画布）。
 * Figma 渐变空间：(0,0.5) 为起点、(1,0.5) 为终点；需映射到图层归一化空间 [0,1] 的边界两点。
 * 中心 (0.5,0.5)，方向 (cos,sin)，半长 D = 0.5/max(|cos|,|sin|)，起点/终点 = 中心 ± D*(cos,sin)。
 */
function gradientTransformFromAngle(angleDeg: number): Transform {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const D = 0.5 / Math.max(Math.abs(cos), Math.abs(sin), 1e-6);
  const startX = 0.5 - D * cos;
  const startY = 0.5 - D * sin;
  const endX = 0.5 + D * cos;
  const endY = 0.5 + D * sin;
  const a = endX - startX;
  const c = endY - startY;
  return [
    [a, 0, startX],
    [c, 0, startY],
  ];
}

/** CSS linear-gradient 角度（0deg=上，90deg=右）→ Figma 用的角度（0°=左→右） */
function cssAngleToFigma(cssAngleDeg: number): number {
  return (270 + cssAngleDeg) % 360;
}

/** data URL 或纯 base64 转为 Uint8Array，供 figma.createImage 使用 */
function dataUrlToBytes(content: string): Uint8Array | null {
  if (!content || typeof content !== 'string') return null;
  let base64: string;
  const dataUrlMatch = content.match(/^data:image\/[^;]+;base64\s*,/i);
  if (dataUrlMatch) {
    base64 = content.slice(dataUrlMatch[0].length);
  } else {
    base64 = content;
  }
  base64 = base64.replace(/\s/g, '');
  if (!base64.length) return null;

  // Figma 沙盒环境无 atob，手动实现 base64 解码
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;

  const n = base64.length;
  let pad = 0;
  if (n > 0 && base64[n - 1] === '=') pad++;
  if (n > 1 && base64[n - 2] === '=') pad++;
  const bytes = new Uint8Array((n * 3) / 4 - pad);
  let p = 0;
  for (let i = 0; i < n; i += 4) {
    const a = lookup[base64.charCodeAt(i)];
    const b = lookup[base64.charCodeAt(i + 1)];
    const c = lookup[base64.charCodeAt(i + 2)];
    const d = lookup[base64.charCodeAt(i + 3)];
    bytes[p++] = (a << 2) | (b >> 4);
    if (p < bytes.length) bytes[p++] = ((b & 0xf) << 4) | (c >> 2);
    if (p < bytes.length) bytes[p++] = ((c & 0x3) << 6) | d;
  }
  return bytes;
}

export function applyFills(node: GeometryMixin, fills?: (string | FillObject)[]): void {
  if (!fills || fills.length === 0) return;

  const paintArray: Paint[] = [];
  for (const f of fills) {
    if (typeof f === 'string') {
      const { color, opacity } = parseColorWithOpacity(f);
      paintArray.push({ type: 'SOLID', color, opacity } as SolidPaint);
      continue;
    }

    if (f.type === 'IMAGE' && (f.content || f.url)) {
      const content = f.content;
      if (content) {
        const bytes = dataUrlToBytes(content);
        if (bytes && bytes.length > 0) {
          try {
            const image = figma.createImage(bytes);
            paintArray.push({ type: 'IMAGE', imageHash: image.hash, scaleMode: 'FILL' } as ImagePaint);
          } catch (e) {
            console.warn('[image fill] createImage 失败', (e as Error)?.message);
          }
        }
      }
      continue;
    }

    if (f.type === 'GRADIENT_LINEAR' && f.gradientStops && f.gradientStops.length >= 2) {
      const gradientStops: { position: number; color: RGBA }[] = f.gradientStops.map((s) => {
        const { color, opacity: o } = parseColorWithOpacity(s.color);
        return { position: s.position, color: { ...color, a: o } };
      });
      const cssAngle = f.angle ?? 0;
      const figmaAngle = cssAngleToFigma(cssAngle);
      paintArray.push({
        type: 'GRADIENT_LINEAR',
        gradientTransform: gradientTransformFromAngle(figmaAngle),
        gradientStops,
      } as GradientPaint);
      continue;
    }

    if (f.type === 'SOLID' && f.color) {
      const { color, opacity: parsedOpacity } = parseColorWithOpacity(f.color);
      paintArray.push({
        type: 'SOLID',
        color,
        opacity: f.opacity ?? parsedOpacity,
      } as SolidPaint);
      continue;
    }

    if (f.color) {
      const { color, opacity: parsedOpacity } = parseColorWithOpacity(f.color);
      paintArray.push({ type: 'SOLID', color, opacity: f.opacity ?? parsedOpacity } as SolidPaint);
      continue;
    }

    paintArray.push({ type: 'SOLID', color: { r: 0, g: 0, b: 0 }, opacity: 1 } as SolidPaint);
  }

  if (paintArray.length > 0) {
    node.fills = paintArray;
  }
}

export function applyStrokes(node: GeometryMixin, style?: StyleJSON): void {
  if (!style) return;

  if (style.strokeColor) {
    const { color, opacity } = parseColorWithOpacity(style.strokeColor);
    node.strokes = [{ type: 'SOLID', color, opacity }];
  }

  if (style.strokeWeight !== undefined) {
    node.strokeWeight = style.strokeWeight;
  }

  if (style.strokeAlign && 'strokeAlign' in node) {
    (node as GeometryMixin).strokeAlign = style.strokeAlign;
  }
}

export function applyBorderRadius(node: RectangleNode | FrameNode | ComponentNode, style?: StyleJSON): void {
  if (!style || style.borderRadius === undefined) return;

  if (typeof style.borderRadius === 'number') {
    node.cornerRadius = style.borderRadius;
  } else if (Array.isArray(style.borderRadius)) {
    node.topLeftRadius = style.borderRadius[0];
    node.topRightRadius = style.borderRadius[1];
    node.bottomRightRadius = style.borderRadius[2];
    node.bottomLeftRadius = style.borderRadius[3];
  }
}

export function applyEffects(node: BlendMixin, style?: StyleJSON): void {
  if (!style) return;

  const effects: Effect[] = [];

  if (style.shadows) {
    for (const s of style.shadows) {
      const { color, opacity } = parseColorWithOpacity(s.color);
      effects.push({
        type: 'DROP_SHADOW',
        color: { ...color, a: opacity },
        offset: { x: s.offsetX, y: s.offsetY },
        radius: s.blur,
        spread: s.spread ?? 0,
        visible: true,
        blendMode: 'NORMAL',
      });
    }
  }

  if (style.blurs) {
    for (const b of style.blurs) {
      const blurEffect: BlurEffectNormal = {
        type: b.type === 'BACKGROUND_BLUR' ? 'BACKGROUND_BLUR' : 'LAYER_BLUR',
        radius: b.blur,
        visible: true,
        blurType: 'NORMAL',
      };
      effects.push(blurEffect);
    }
  }

  if (effects.length > 0) {
    node.effects = effects;
  }
}

export function applyAutoLayout(node: FrameNode | ComponentNode, style?: StyleJSON): void {
  if (!style) return;

  const useGrid = style.layoutGridColumns != null && style.layoutGridColumns > 0;
  const layoutMode = useGrid ? 'GRID' : style.layoutMode;

  if (layoutMode && layoutMode !== 'NONE') {
    // GRID 只能在无子节点时设置，否则 Figma 会报 "Cannot delete occupied row/column"
    const canSetGrid = !useGrid || node.children.length === 0;
    if (canSetGrid) {
      node.layoutMode = layoutMode;
      if (useGrid && style.layoutGridColumns != null) {
        node.gridColumnCount = style.layoutGridColumns;
        node.gridColumnSizes = Array.from({ length: style.layoutGridColumns }, () => ({ type: 'FLEX' as const }));
      }
    }
    if (style.layoutWrap !== undefined && node.layoutMode === 'HORIZONTAL') {
      node.layoutWrap = style.layoutWrap;
    }
    if (style.itemSpacing !== undefined) node.itemSpacing = style.itemSpacing;
    if (style.counterAxisSpacing !== undefined) node.counterAxisSpacing = style.counterAxisSpacing;
    if (style.paddingTop !== undefined) node.paddingTop = style.paddingTop;
    if (style.paddingRight !== undefined) node.paddingRight = style.paddingRight;
    if (style.paddingBottom !== undefined) node.paddingBottom = style.paddingBottom;
    if (style.paddingLeft !== undefined) node.paddingLeft = style.paddingLeft;
    if (style.primaryAxisAlignItems !== undefined) node.primaryAxisAlignItems = style.primaryAxisAlignItems;
    if (style.counterAxisAlignItems !== undefined) node.counterAxisAlignItems = style.counterAxisAlignItems;
    if (style.layoutSizingHorizontal !== undefined) node.layoutSizingHorizontal = style.layoutSizingHorizontal;
    if (style.layoutSizingVertical !== undefined) node.layoutSizingVertical = style.layoutSizingVertical;
  }
}

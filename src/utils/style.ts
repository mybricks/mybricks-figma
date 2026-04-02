import { KEY_CODE } from '@tarojs/runtime';
import type { StyleJSON, FillObject, ShadowEffect, BlurEffect } from '../types';
import { parseColorWithOpacity } from './color';

export function applyBaseStyle(node: SceneNode, style?: StyleJSON, skipResizeForText?: boolean): void {
  if (!style) return;

  // 若父节点是 Auto Layout，不能直接赋值 x/y，否则 Figma 会将该节点切换为 ABSOLUTE positioning
  // 脱离自动布局，导致 counterAxisAlignItems: CENTER 等对齐失效
  // 例外：positionType: 'absolute' 的节点需要主动设置 ABSOLUTE positioning 并保留 x/y
  const parentNode = (node as any).parent;
  const parentHasAutoLayout = parentNode && 'layoutMode' in parentNode && parentNode.layoutMode !== 'NONE';

  if (style.positionType === 'absolute' && 'layoutPositioning' in node && parentHasAutoLayout) {
    (node as any).layoutPositioning = 'ABSOLUTE';
  }

  // resize 必须在 x/y 和 rotation 之前执行：
  // figma.createRectangle() 默认 100×100，若先设 x/y 再 rotation，旋转中心是基于 100×100 计算的，
  // 最后 resize 改变尺寸会导致中心偏移，伪元素箭头等旋转图形位置完全错误。
  // 正确顺序：resize（确定实际尺寸）→ x/y（基于正确尺寸定位）→ rotation（绕正确中心旋转）
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
  }

  const skipXY = parentHasAutoLayout && style.positionType !== 'absolute';
  if (!skipXY) {
    if (style.x !== undefined && style.x !== null && isFinite(style.x as number)) node.x = style.x as number;
    if (style.y !== undefined && style.y !== null && isFinite(style.y as number)) node.y = style.y as number;
  }
  if (style.rotation !== undefined && 'rotation' in node) {
    (node as SceneNode & { rotation: number }).rotation = style.rotation;
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
 * 线性渐变角度 → Figma gradientTransform（2x3 仿射矩阵）。
 *
 * Figma gradientTransform 格式：[[a, b, tx], [c, d, ty]]
 *   第一列 [a, c]：渐变方向向量（从起点到终点，归一化到图层空间）
 *   第二列 [b, d]：垂直方向向量（必须非零，否则矩阵奇异，Figma 无法渲染渐变）
 *   第三列 [tx, ty]：渐变起点坐标（图层归一化空间）
 *
 * 算法：
 *   中心 (0.5,0.5)，方向 (cos,sin)，半长 D = 0.5/max(|cos|,|sin|)
 *   起点 = 中心 - D*(cos,sin)，终点 = 中心 + D*(cos,sin)
 *   第一列 = 终点 - 起点 = (2D*cos, 2D*sin)
 *   第二列 = 垂直方向 = (-sin, cos)（旋转矩阵的正交列）
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
  const transform: Transform = [
    [a, -sin, startX],
    [c,  cos, startY],
  ];
  return transform;
}

/**
 * CSS linear-gradient 角度 → Figma 渐变角度。
 * CSS：0deg=to top（终点朝上），顺时针递增（90deg=to right）
 * Figma：0deg=水平向右，顺时针递增
 * 映射关系：CSS 90deg=右 → Figma 0deg；CSS 0deg=上 → Figma 90deg；CSS 180deg=下 → Figma 270deg
 * 公式：figma = (450 - css) % 360
 */
function cssAngleToFigma(cssAngleDeg: number): number {
  return (450 - cssAngleDeg) % 360;
}

/**
 * 径向渐变圆心/半径 → Figma gradientTransform（2x3 仿射矩阵）。
 *
 * Figma GRADIENT_RADIAL 的 canonical 渐变空间中：
 *   圆心       = (0.5, 0)     ← 注意：y=0，不是 y=0.5
 *   end handle = (1.0, 0)     ← 定义 x 方向半径
 *   width handle = (0.5, 0.5) ← 定义 y 方向半径（圆形时与 x 半径相等）
 *
 * 由 canonical 圆心 (0.5, 0) 推导：
 *   Row 0: a = 2r,  b = 0, tx = cx - r  （canonical x=0.5 → layer cx）
 *   Row 1: c = 0,   d = 2r, ty = cy     （canonical y=0 → layer cy，直接平移）
 *
 * 验证（cx=0.5, cy=0.5, r=0.5）：
 *   [[1, 0, 0], [0, 1, 0.5]]
 *   center (0.5, 0)   → layer (0.5, 0.5)   ✓ 居中
 *   end    (1.0, 0)   → layer (1.0, 0.5)   ✓ 右中边
 *   width  (0.5, 0.5) → layer (0.5, 1.0)   ✓ 下中边，圆形半径相等
 */
function gradientTransformFromRadial(cx: number, cy: number, r: number): Transform {
  return [
    [2 * r, 0,     cx - r],
    [0,     2 * r, cy    ],
  ];
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

export async function applyFills(node: GeometryMixin, fills?: (string | FillObject)[]): Promise<void> {
  if (!fills) return;
  // fills 为空数组时，明确清除 Figma 默认白色填充（让矩形透明）
  if (fills.length === 0) {
    node.fills = [];
    return;
  }

  const paintArray: Paint[] = [];
  for (const f of fills) {
    if (typeof f === 'string') {
      // radial-gradient / linear-gradient 等 CSS 渐变字符串无法直接解析为纯色，跳过避免 NaN fill
      if (f.includes('gradient')) {
        continue;
      }  
      const { color, opacity } = parseColorWithOpacity(f);
      paintArray.push({ type: 'SOLID', color, opacity } as SolidPaint);
      continue;
    }

    if (f.type === 'IMAGE' && (f.content || f.url)) {
      const scaleMode: ImagePaint['scaleMode'] =
        f.scaleMode === 'TILE' || f.scaleMode === 'FIT' || f.scaleMode === 'CROP'
          ? f.scaleMode
          : 'FILL';
      const extraProps = scaleMode === 'TILE' ? { scalingFactor: f.scalingFactor ?? 0.5 } : {};
      if (f.content) {
        const bytes = dataUrlToBytes(f.content);
        if (bytes && bytes.length > 0) {
          try {
            const image = figma.createImage(bytes);
            paintArray.push({ type: 'IMAGE', imageHash: image.hash, scaleMode, ...extraProps } as ImagePaint);
          } catch (e) {
            console.warn('[image fill] createImage 失败', (e as Error)?.message);
          }
        }
      } else if (f.url) {
        try {
          const image = await figma.createImageAsync(f.url);
          paintArray.push({ type: 'IMAGE', imageHash: image.hash, scaleMode, ...extraProps } as ImagePaint);
        } catch (e) {
          console.warn('[image fill] createImageAsync url 失败', (e as Error)?.message);
        }
      }
      continue;
    }

    if (f.type === 'GRADIENT_LINEAR' && f.gradientStops && f.gradientStops.length >= 2) {
      const rawLinearStops: { position: number; color: RGBA }[] = f.gradientStops.map((s) => {
        const { color, opacity: o } = parseColorWithOpacity(s.color);
        return { position: s.position, color: { ...color, a: o } };
      });
      // 修复透明色标：同 GRADIENT_RADIAL，避免经过黑色插值
      const coloredLinearStops = rawLinearStops.filter(s => s.color.a > 0);
      const gradientStops = rawLinearStops.map(s => {
        if (s.color.a === 0 && coloredLinearStops.length > 0) {
          return { ...s, color: { ...coloredLinearStops[0].color, a: 0 } };
        }
        return s;
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

    if (f.type === 'GRADIENT_RADIAL' && f.gradientStops && f.gradientStops.length >= 2) {

      const rawStops: { position: number; color: RGBA }[] = f.gradientStops.map((s) => {
        const { color, opacity: o } = parseColorWithOpacity(s.color);
        return { position: s.position, color: { ...color, a: o } };
      });
      // 修复透明色标：CSS transparent = rgba(0,0,0,0)，Figma 插值时会经过黑色
      // 将 a=0 的色标颜色替换为最近有色色标的 RGB + alpha=0，保持色调淡出效果
      const coloredStops = rawStops.filter(s => s.color.a > 0);
      const gradientStops = rawStops.map(s => {
        if (s.color.a === 0 && coloredStops.length > 0) {
          return { ...s, color: { ...coloredStops[0].color, a: 0 } };
        }
        return s;
      });
      const cx = f.centerX ?? 0.5;
      const cy = f.centerY ?? 0.5;
      const r = f.radius ?? 0.5;
      const transform = gradientTransformFromRadial(cx, cy, r);
      paintArray.push({
        type: 'GRADIENT_RADIAL',
        gradientTransform: transform,
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

  const hasIndividual =
    style.strokeTopWeight !== undefined ||
    style.strokeRightWeight !== undefined ||
    style.strokeBottomWeight !== undefined ||
    style.strokeLeftWeight !== undefined;

  if (hasIndividual) {
    // 四边独立描边：直接设置各边属性（individualStrokeWeights 是只读 getter，不能赋值）
    if ('strokeTopWeight' in node) {
      (node as any).strokeTopWeight = style.strokeTopWeight ?? 0;
      (node as any).strokeRightWeight = style.strokeRightWeight ?? 0;
      (node as any).strokeBottomWeight = style.strokeBottomWeight ?? 0;
      (node as any).strokeLeftWeight = style.strokeLeftWeight ?? 0;
    }
  } else if (style.strokeWeight !== undefined) {
    node.strokeWeight = style.strokeWeight;
  }

  if (style.strokeAlign && 'strokeAlign' in node) {
    (node as GeometryMixin).strokeAlign = style.strokeAlign;
  } else if ((node as any).strokes?.length > 0 && 'strokeAlign' in node) {
    // DOM 的 getBoundingClientRect 返回尺寸始终包含 border 宽度，
    // 对应 Figma 永远是 INSIDE，否则描边向外扩展会导致元素视觉尺寸偏大、相邻元素错位。
    (node as GeometryMixin).strokeAlign = 'INSIDE';
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

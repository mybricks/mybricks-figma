import type { StyleJSON, FillObject, ShadowEffect, BlurEffect } from '../types';
import { parseColor, parseColorWithOpacity } from './color';

export function applyBaseStyle(node: SceneNode, style?: StyleJSON): void {
  if (!style) return;

  if (style.x !== undefined) node.x = style.x;
  if (style.y !== undefined) node.y = style.y;
  if (style.rotation !== undefined && 'rotation' in node) {
    (node as SceneNode & { rotation: number }).rotation = style.rotation;
  }

  if ('resize' in node) {
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

export function applyFills(node: GeometryMixin, fills?: (string | FillObject)[]): void {
  if (!fills || fills.length === 0) return;

  const paintArray: Paint[] = fills.map((f) => {
    if (typeof f === 'string') {
      const { color, opacity } = parseColorWithOpacity(f);
      return { type: 'SOLID', color, opacity } as SolidPaint;
    }

    if (f.type === 'SOLID' && f.color) {
      const { color, opacity: parsedOpacity } = parseColorWithOpacity(f.color);
      return {
        type: 'SOLID',
        color,
        opacity: f.opacity ?? parsedOpacity,
      } as SolidPaint;
    }

    if (f.color) {
      const { color, opacity: parsedOpacity } = parseColorWithOpacity(f.color);
      return { type: 'SOLID', color, opacity: f.opacity ?? parsedOpacity } as SolidPaint;
    }

    return { type: 'SOLID', color: { r: 0, g: 0, b: 0 }, opacity: 1 } as SolidPaint;
  });

  node.fills = paintArray;
}

export function applyStrokes(node: GeometryMixin, style?: StyleJSON): void {
  if (!style) return;

  if (style.strokeColor) {
    const color = parseColor(style.strokeColor);
    node.strokes = [{ type: 'SOLID', color }];
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

  if (style.layoutMode && style.layoutMode !== 'NONE') {
    node.layoutMode = style.layoutMode;

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

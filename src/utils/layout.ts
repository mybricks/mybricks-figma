import type { StyleJSON } from '../types';

/**
 * Applies auto-layout, sizing mode, and dimensions in the correct order for Figma.
 *
 * Figma resets frame size to HUG when layoutMode is first set, so the order must be:
 *   1. layoutMode
 *   2. layout properties (padding, spacing, alignment)
 *   3. layoutSizing → FIXED (so resize sticks)
 *   4. resize (width / height)
 *   5. position (x / y / rotation)
 *
 * This function is idempotent and safe to call both before and after children are added.
 */
export function applyLayoutAndSize(
  node: FrameNode | ComponentNode,
  style?: StyleJSON
): void {
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

    if (style.width !== undefined) {
      node.layoutSizingHorizontal = 'FIXED';
    }
    if (style.height !== undefined) {
      node.layoutSizingVertical = 'FIXED';
    }

    if (style.layoutSizingHorizontal !== undefined) {
      node.layoutSizingHorizontal = style.layoutSizingHorizontal;
    }
    if (style.layoutSizingVertical !== undefined) {
      node.layoutSizingVertical = style.layoutSizingVertical;
    }
  }

  // 无 layoutMode 的 frame 作为 auto-layout 父节点的子节点时，Figma 默认为 HUG，空 frame 会变成 0x0 不可见。
  // 有明确 width/height 时设为 FIXED，保证尺寸保留（如 bannerArea 等空容器能正确显示）。
  if (style.width !== undefined) {
    node.layoutSizingHorizontal = style.layoutSizingHorizontal ?? 'FIXED';
  }
  if (style.height !== undefined) {
    node.layoutSizingVertical = style.layoutSizingVertical ?? 'FIXED';
  }

  const w = style.width;
  const h = style.height;
  if (w !== undefined && h !== undefined) {
    node.resize(w, h);
  } else if (w !== undefined) {
    node.resize(w, node.height);
  } else if (h !== undefined) {
    node.resize(node.width, h);
  }

  if (style.x !== undefined) node.x = style.x;
  if (style.y !== undefined) node.y = style.y;
  if (style.rotation !== undefined) node.rotation = style.rotation;

  if (style.opacity !== undefined) node.opacity = style.opacity;

  if (style.constraints && 'constraints' in node) {
    (node as ConstraintMixin).constraints = {
      horizontal: style.constraints.horizontal ?? 'MIN',
      vertical: style.constraints.vertical ?? 'MIN',
    };
  }
}

import type { NodeJSON, StyleJSON } from '../types';

/**
 * 直接子节点在主轴上的 margin 明显大于父级 itemSpacing 时，视为 flex 里 margin:auto / 换行后顶到行尾等场景，
 * Figma Auto Layout 无法还原，应改用 JSON 中的 x/y（与 dom-to-json 保留「超大」主轴 margin 的约定一致）。
 */
export function directChildHasOversizedMainAxisMargin(json: NodeJSON): boolean {
  const st = json.style;
  if (!st?.layoutMode || st.layoutMode === 'GRID') return false;
  const spacing = st.itemSpacing ?? 0;
  // 仅拦截 margin:auto 等"远超 itemSpacing"场景（通常几百 px），
  // 正常 margin（如 4px 间距）不应触发降级，阈值设为 spacing + 40。
  const thresh = spacing + 40;
  const lm = st.layoutMode;
  const ch = json.children;
  if (!ch || ch.length === 0) return false;
  for (const c of ch) {
    const s = c.style;
    if (!s || s.positionType === 'absolute') continue;
    if (lm === 'HORIZONTAL') {
      if (s.marginLeft != null && s.marginLeft > thresh) return true;
      if (s.marginRight != null && s.marginRight > thresh) return true;
    } else if (lm === 'VERTICAL') {
      if (s.marginTop != null && s.marginTop > thresh) return true;
      if (s.marginBottom != null && s.marginBottom > thresh) return true;
    }
  }
  return false;
}

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
  style?: StyleJSON,
  frameJson?: NodeJSON
): void {
  if (!style) return;

  const useGrid = style.layoutGridColumns != null && style.layoutGridColumns > 0;
  let layoutMode = useGrid ? 'GRID' : style.layoutMode;

  const wouldUseAutoLayout = !!(
    frameJson &&
    layoutMode &&
    layoutMode !== 'NONE' &&
    !useGrid
  );
  const oversizedMainAxisMargin = wouldUseAutoLayout
    ? directChildHasOversizedMainAxisMargin(frameJson!)
    : false;

  // 子项主轴 margin 远大于 itemSpacing（典型 margin:auto 的解析像素）时，Auto Layout 会覆盖子 x/y，换行第二行会贴左（GRID 不参与此判断）
  if (oversizedMainAxisMargin) {
    layoutMode = 'NONE';
  }

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
    // Figma：SPACE_BETWEEN + 仅 1 个流内子节点会居中，与 CSS flex 单子项 space-between（贴主轴起点）不一致；兜底旧 JSON
    let primaryAxisAlign = style.primaryAxisAlignItems;
    if (
      primaryAxisAlign === 'SPACE_BETWEEN' &&
      frameJson?.children &&
      !useGrid &&
      (layoutMode === 'HORIZONTAL' || layoutMode === 'VERTICAL')
    ) {
      const inFlow = frameJson.children.filter((c) => c.style?.positionType !== 'absolute');
      if (inFlow.length <= 1) {
        primaryAxisAlign = 'MIN';
      }
    }
    if (primaryAxisAlign !== undefined) node.primaryAxisAlignItems = primaryAxisAlign;
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

  // position: absolute/fixed → 脱离 Auto Layout 流式排布，保留 x/y（等价 CSS position: absolute）
  // Figma 要求父节点 layoutMode !== NONE 才能设置 ABSOLUTE，否则会报错
  if (style.positionType === 'absolute' && 'layoutPositioning' in node) {
    const parentNode = (node as any).parent;
    if (parentNode && 'layoutMode' in parentNode && parentNode.layoutMode !== 'NONE') {
      (node as any).layoutPositioning = 'ABSOLUTE';
    }
  }

  // 在 Auto Layout 父容器内设置 x/y 会触发 Figma 将子节点隐式切换为 ABSOLUTE positioning，
  // 导致 layoutAlign（alignSelf）等流式对齐属性失效（与 applyBaseStyle 中 text 节点的防御逻辑一致）。
  // 只有明确标记 positionType:'absolute' 的节点才需要设置 x/y；流式子节点的位置由 Auto Layout 管理。
  const _parentNodeXY = (node as any).parent;
  const _parentHasAutoLayoutXY = _parentNodeXY && 'layoutMode' in _parentNodeXY && _parentNodeXY.layoutMode !== 'NONE';
  if (!_parentHasAutoLayoutXY || style.positionType === 'absolute') {
    if (style.x !== undefined && style.x !== null && isFinite(style.x as number)) node.x = style.x as number;
    if (style.y !== undefined && style.y !== null && isFinite(style.y as number)) node.y = style.y as number;
  }
  if (style.rotation !== undefined) node.rotation = style.rotation;

  if (style.opacity !== undefined) node.opacity = style.opacity;

  // Auto Layout 子节点的 margin（对应 CSS margin-inline-start/end）
  // Figma 要求父节点 layoutMode !== NONE 才能设置子节点 margin
  if ('layoutPositioning' in node) {
    const parentNode = (node as any).parent;
    const parentHasLayout = parentNode && 'layoutMode' in parentNode && parentNode.layoutMode !== 'NONE';
    if (parentHasLayout) {
      try {
        if (style.marginLeft !== undefined && isFinite(style.marginLeft as number)) (node as any).marginLeft = style.marginLeft;
        if (style.marginRight !== undefined && isFinite(style.marginRight as number)) (node as any).marginRight = style.marginRight;
        if (style.marginTop !== undefined && isFinite(style.marginTop as number)) (node as any).marginTop = style.marginTop;
        if (style.marginBottom !== undefined && isFinite(style.marginBottom as number)) (node as any).marginBottom = style.marginBottom;
        // alignSelf: 'MIN' → layoutAlign = 'MIN'（等价 align-self: flex-start）
        if (style.alignSelf !== undefined && 'layoutAlign' in node) {
          try { (node as any).layoutAlign = style.alignSelf; } catch (_e) {}
          // Figma 限制：layoutSizingHorizontal='FIXED' 时，layoutAlign 无法设为 CENTER/MIN/MAX（静默忽略）。
          // 回退方案：当 layoutAlign 未能生效且目标是 CENTER，改为将父节点的 counterAxisAlignItems 设为 CENTER。
          // 对于全宽兄弟节点（宽度 = 父容器宽度），counterAxisAlignItems 改为 CENTER 无视觉影响。
          if ((node as any).layoutAlign !== style.alignSelf && style.alignSelf === 'CENTER' && 'counterAxisAlignItems' in parentNode) {
            try {
              (parentNode as any).counterAxisAlignItems = 'CENTER';
            } catch (e2: any) {
              console.warn('[mb-figma:alignSelf:fallback:error]', e2?.message, node.name);
            }
          }
        }
      } catch (e: any) {
        console.warn('[applyLayoutAndSize] margin error:', e?.message, '| node.type:', node.type, '| node.name:', node.name);
      }
    }
  }

  if (style.constraints && 'constraints' in node) {
    (node as ConstraintMixin).constraints = {
      horizontal: style.constraints.horizontal ?? 'MIN',
      vertical: style.constraints.vertical ?? 'MIN',
    };
  }
}

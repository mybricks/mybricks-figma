import type { NodeJSON } from '../types';

export async function buildSvg(
  json: NodeJSON,
  parent: BaseNode & ChildrenMixin
): Promise<FrameNode> {
  const svgContent = (json.style as any)?.svgContent as string | undefined;
  if (!svgContent) throw new Error(`[buildSvg] missing svgContent for node: ${json.name}`);

  const frame = figma.createNodeFromSvg(svgContent);
  frame.name = json.className ?? json.name ?? 'SVG';

  parent.appendChild(frame);

  const w = json.style?.width;
  const h = json.style?.height;
  if (w !== undefined && w >= 1 && h !== undefined && h >= 1) {
    frame.resize(Math.ceil(w), Math.ceil(h));
  }

  // 当父节点是 Auto Layout 时，SVG 子节点的 x/y 会被 Figma 忽略（Auto Layout 自动排布），
  // 需要：① 设为 FIXED 尺寸避免收缩，② 设为 ABSOLUTE 定位以保留 x/y 坐标。
  const parentNode = frame.parent as any;
  const parentIsAutoLayout = parentNode && 'layoutMode' in parentNode && parentNode.layoutMode !== 'NONE';
  if (parentIsAutoLayout) {
    frame.layoutSizingHorizontal = 'FIXED';
    frame.layoutSizingVertical = 'FIXED';
    (frame as any).layoutPositioning = 'ABSOLUTE';
  }

  if (json.style?.x !== undefined) frame.x = json.style.x;
  if (json.style?.y !== undefined) frame.y = json.style.y;

  // CSS transform rotation → Figma rotation
  // style-builder.js 已做符号转换（CSS 顺时针为正 → Figma 逆时针为正），直接赋值即可
  if (json.style?.rotation !== undefined && json.style.rotation !== 0) {
    frame.rotation = json.style.rotation as number;
  }

  return frame;
}

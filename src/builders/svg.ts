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

  if (json.style?.x !== undefined) frame.x = json.style.x;
  if (json.style?.y !== undefined) frame.y = json.style.y;

  const w = json.style?.width;
  const h = json.style?.height;
  if (w !== undefined && w >= 1 && h !== undefined && h >= 1) {
    frame.resize(Math.ceil(w), Math.ceil(h));
  }

  return frame;
}

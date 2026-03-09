import type { NodeJSON, ComponentDefMap, DefaultFontJSON } from '../types';
import { applyFills, applyStrokes, applyBorderRadius, applyEffects } from '../utils/style';
import { applyLayoutAndSize } from '../utils/layout';
import { buildChildren } from './index';

export async function buildFrame(
  json: NodeJSON,
  parent: BaseNode & ChildrenMixin,
  defMap: ComponentDefMap,
  errors?: string[],
  defaultFont?: DefaultFontJSON
): Promise<FrameNode> {
  const frame = figma.createFrame();
  frame.name = json.className ?? json.name ?? 'Frame';
  parent.appendChild(frame);

  if (!json.style?.fills) {
    frame.fills = [];
  }

  // overflow: visible → 不裁切内容（Figma 默认 clipsContent = true）
  if (json.style?.clipsContent === false) {
    frame.clipsContent = false;
  }

  applyFills(frame, json.style?.fills);
  applyStrokes(frame, json.style);
  applyBorderRadius(frame, json.style);
  applyEffects(frame, json.style);

  applyLayoutAndSize(frame, json.style);

  if (json.children && json.children.length > 0) {
    await buildChildren(json.children, frame, defMap, errors, defaultFont);
  }

  applyLayoutAndSize(frame, json.style);

  return frame;
}

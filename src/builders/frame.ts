import type { NodeJSON, ComponentDefMap } from '../types';
import { applyFills, applyStrokes, applyBorderRadius, applyEffects } from '../utils/style';
import { applyLayoutAndSize } from '../utils/layout';
import { buildChildren } from './index';

export async function buildFrame(
  json: NodeJSON,
  parent: BaseNode & ChildrenMixin,
  defMap: ComponentDefMap
): Promise<FrameNode> {
  const frame = figma.createFrame();
  frame.name = json.className ?? json.name ?? 'Frame';
  parent.appendChild(frame);

  if (!json.style?.fills) {
    frame.fills = [];
  }

  applyFills(frame, json.style?.fills);
  applyStrokes(frame, json.style);
  applyBorderRadius(frame, json.style);
  applyEffects(frame, json.style);

  applyLayoutAndSize(frame, json.style);

  if (json.children && json.children.length > 0) {
    await buildChildren(json.children, frame, defMap);
  }

  applyLayoutAndSize(frame, json.style);

  return frame;
}

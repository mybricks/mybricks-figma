import type { NodeJSON } from '../types';
import { applyBaseStyle, applyFills, applyStrokes, applyBorderRadius, applyEffects } from '../utils/style';

export function buildRectangle(
  json: NodeJSON,
  parent: BaseNode & ChildrenMixin
): RectangleNode {
  const rect = figma.createRectangle();
  rect.name = json.className ?? json.name ?? 'Rectangle';

  parent.appendChild(rect);

  applyBaseStyle(rect, json.style);
  applyFills(rect, json.style?.fills);
  applyStrokes(rect, json.style);
  applyBorderRadius(rect, json.style);
  applyEffects(rect, json.style);

  return rect;
}

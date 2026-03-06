import type { NodeJSON } from '../types';
import { applyBaseStyle, applyStrokes, applyEffects } from '../utils/style';

export function buildLine(
  json: NodeJSON,
  parent: BaseNode & ChildrenMixin
): LineNode {
  const line = figma.createLine();
  line.name = json.className ?? json.name ?? 'Line';

  parent.appendChild(line);

  applyBaseStyle(line, json.style);
  applyStrokes(line, json.style);
  applyEffects(line, json.style);

  if (!json.style?.strokeColor) {
    line.strokes = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 }, opacity: 1 }];
  }

  return line;
}

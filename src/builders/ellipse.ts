import type { NodeJSON } from '../types';
import { applyBaseStyle, applyFills, applyStrokes, applyEffects } from '../utils/style';

export function buildEllipse(
  json: NodeJSON,
  parent: BaseNode & ChildrenMixin
): EllipseNode {
  const ellipse = figma.createEllipse();
  ellipse.name = json.className ?? json.name ?? 'Ellipse';

  parent.appendChild(ellipse);

  applyBaseStyle(ellipse, json.style);
  applyFills(ellipse, json.style?.fills);
  applyStrokes(ellipse, json.style);
  applyEffects(ellipse, json.style);

  return ellipse;
}

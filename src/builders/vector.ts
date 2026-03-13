import type { NodeJSON } from '../types';
import { applyBaseStyle, applyFills, applyStrokes, applyEffects } from '../utils/style';

export async function buildVector(
  json: NodeJSON,
  parent: BaseNode & ChildrenMixin
): Promise<VectorNode> {
  const vector = figma.createVector();
  vector.name = json.className ?? json.name ?? 'Vector';

  parent.appendChild(vector);

  applyBaseStyle(vector, json.style);
  await applyFills(vector, json.style?.fills);
  applyStrokes(vector, json.style);
  applyEffects(vector, json.style);

  if (json.style?.vectorPaths && json.style.vectorPaths.length > 0) {
    vector.vectorPaths = json.style.vectorPaths.map((vp) => ({
      data: vp.data,
      windingRule: vp.windingRule ?? 'NONZERO',
    }));
  }

  return vector;
}

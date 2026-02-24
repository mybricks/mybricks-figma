import type { NodeJSON, ComponentDefMap } from '../types';
import { buildFrame } from './frame';
import { buildRectangle } from './rectangle';
import { buildEllipse } from './ellipse';
import { buildLine } from './line';
import { buildVector } from './vector';
import { buildText } from './text';
import { buildImage } from './image';
import { buildGroup } from './group';
import { buildComponentInline } from './component';

export async function buildNode(
  json: NodeJSON,
  parent: BaseNode & ChildrenMixin,
  defMap: ComponentDefMap
): Promise<SceneNode> {
  let node: SceneNode;
  switch (json.type) {
    case 'frame':
      node = await buildFrame(json, parent, defMap);
      break;
    case 'rectangle':
      node = buildRectangle(json, parent);
      break;
    case 'ellipse':
      node = await buildEllipse(json, parent);
      break;
    case 'line':
      node = buildLine(json, parent);
      break;
    case 'vector':
      node = buildVector(json, parent);
      break;
    case 'text':
      node = await buildText(json, parent);
      break;
    case 'image':
      node = await buildImage(json, parent);
      break;
    case 'group':
      node = await buildGroup(json, parent, defMap);
      break;
    case 'component':
      node = await buildComponentInline(json, parent, defMap);
      break;
    default:
      throw new Error(`Unsupported node type: ${(json as any).type}`);
  }
  if (json.className && 'setPluginData' in node) {
    (node as BaseNode).setPluginData('className', json.className);
  }
  return node;
}

export async function buildChildren(
  children: NodeJSON[],
  parent: BaseNode & ChildrenMixin,
  defMap: ComponentDefMap
): Promise<SceneNode[]> {
  const nodes: SceneNode[] = [];
  for (const child of children) {
    const node = await buildNode(child, parent, defMap);
    nodes.push(node);
  }
  return nodes;
}

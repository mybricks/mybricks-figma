import type { NodeJSON, ComponentDefMap, DefaultFontJSON } from '../types';
import { buildFrame } from './frame';
import { buildRectangle } from './rectangle';
import { buildEllipse } from './ellipse';
import { buildLine } from './line';
import { buildVector } from './vector';
import { buildText } from './text';
import { buildImage } from './image';
import { buildGroup } from './group';
import { buildComponentInline } from './component';
import { buildSvg } from './svg';
import { nodeToCssObject } from '../utils/nodeToCss';

export async function buildNode(
  json: NodeJSON,
  parent: BaseNode & ChildrenMixin,
  defMap: ComponentDefMap,
  errors?: string[],
  defaultFont?: DefaultFontJSON
): Promise<SceneNode> {
  let node: SceneNode;
  switch (json.type) {
    case 'frame':
      node = await buildFrame(json, parent, defMap, errors, defaultFont);
      break;
    case 'rectangle':
      node = await buildRectangle(json, parent);
      break;
    case 'ellipse':
      node = await buildEllipse(json, parent);
      break;
    case 'line':
      node = buildLine(json, parent);
      break;
    case 'vector':
      node = await buildVector(json, parent);
      break;
    case 'text':
      node = await buildText(json, parent, defaultFont);
      break;
    case 'svg':
      node = await buildSvg(json, parent);
      break;
    case 'image':
      node = await buildImage(json, parent);
      break;
    case 'group':
      node = await buildGroup(json, parent, defMap, errors, defaultFont);
      break;
    case 'component':
      node = await buildComponentInline(json, parent, defMap, errors);
      break;
    default:
      throw new Error(`Unsupported node type: ${(json as any).type}`);
  }
  if ('setPluginData' in node) {
    const base = node as BaseNode;
    if (json.className) base.setPluginData('className', json.className);
    if (json.selectors && Array.isArray(json.selectors) && json.selectors.length > 0) {
      base.setPluginData('selectors', JSON.stringify(json.selectors));
    }
    // Store initial style snapshot for sync diff (nodes with className or selectors)
    if (json.className || (json.selectors && json.selectors.length > 0)) {
      try {
        const snapshot = nodeToCssObject(node as SceneNode);
        base.setPluginData('originalStyle', JSON.stringify(snapshot));
      } catch (_e) {
        // ignore
      }
    }
  }
  return node;
}

export async function buildChildren(
  children: NodeJSON[],
  parent: BaseNode & ChildrenMixin,
  defMap: ComponentDefMap,
  errors?: string[],
  defaultFont?: DefaultFontJSON
): Promise<SceneNode[]> {
  const nodes: SceneNode[] = [];
  const errs = errors ?? [];
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const lengthBefore = parent.children.length;
    try {
      const node = await buildNode(child, parent, defMap, errs, defaultFont);
      nodes.push(node);
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      errs.push(msg);
      // 仅当本次 buildNode 已向 parent 追加了节点时才移除（否则会误删前一个成功构建的兄弟节点）
      if (parent.children.length > lengthBefore) {
        const last = parent.children[parent.children.length - 1];
        if (last) last.remove();
      }
    }
  }
  return nodes;
}

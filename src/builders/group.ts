import type { NodeJSON, ComponentDefMap, DefaultFontJSON } from '../types';
import { buildChildren } from './index';

export async function buildGroup(
  json: NodeJSON,
  parent: BaseNode & ChildrenMixin,
  defMap: ComponentDefMap,
  errors?: string[],
  defaultFont?: DefaultFontJSON
): Promise<GroupNode> {
  const tempFrame = figma.createFrame();
  tempFrame.name = '__temp_group_container__';
  tempFrame.fills = [];
  parent.appendChild(tempFrame);

  if (json.children && json.children.length > 0) {
    await buildChildren(json.children, tempFrame, defMap, errors, defaultFont);
  }

  const childNodes = [...tempFrame.children];

  if (childNodes.length === 0) {
    const placeholder = figma.createRectangle();
    placeholder.resize(1, 1);
    placeholder.opacity = 0;
    tempFrame.appendChild(placeholder);
    childNodes.push(placeholder);
  }

  const group = figma.group(childNodes, parent);
  group.name = json.className ?? json.name ?? 'Group';

  if (json.style?.x !== undefined) group.x = json.style.x;
  if (json.style?.y !== undefined) group.y = json.style.y;

  tempFrame.remove();

  return group;
}

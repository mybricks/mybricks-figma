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

  // 在 append 之前设置偏移，使子节点在构建时就处于正确的绝对位置。
  // Figma Group 的子节点坐标是相对最近 frame 祖先的，不会因 group 本身的 x/y 自动偏移，
  // 因此借助 tempFrame 的位置将 JSON 中的相对坐标转换为相对 frame 祖先的正确坐标。
  if (json.style?.x !== undefined) tempFrame.x = json.style.x;
  if (json.style?.y !== undefined) tempFrame.y = json.style.y;

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

  tempFrame.remove();

  return group;
}

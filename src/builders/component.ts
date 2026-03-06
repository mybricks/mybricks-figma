import type { NodeJSON, ComponentDefJSON, ComponentDefMap } from '../types';
import { buildFrame } from './frame';
import { buildChildren } from './index';
import { loadFont } from '../utils/font';
import { nodeToCssObject } from '../utils/nodeToCss';

export async function buildComponentInline(
  json: NodeJSON,
  parent: BaseNode & ChildrenMixin,
  defMap: ComponentDefMap,
  errors?: string[]
): Promise<FrameNode> {
  const def = defMap.get(json.ref!);
  if (!def) {
    throw new Error(`Component "${json.ref}" not found. Ensure it is defined in component-def.`);
  }

  const frameJson: NodeJSON = {
    type: 'frame',
    name: def.className ?? def.name ?? def.type,
    className: def.className,
    style: def.style,
    children: def.children,
  };
  const frame = await buildFrame(frameJson, parent, defMap, errors);

  frame.name = json.className ?? json.name ?? `${json.ref} Instance`;
  const className = json.className ?? def.className;
  if (className) frame.setPluginData('className', className);
  if (json.selectors && Array.isArray(json.selectors) && json.selectors.length > 0) {
    frame.setPluginData('selectors', JSON.stringify(json.selectors));
  }

  if (json.style) {
    if (json.style.x !== undefined) frame.x = json.style.x;
    if (json.style.y !== undefined) frame.y = json.style.y;
    if (json.style.layoutSizingHorizontal !== undefined) {
      frame.layoutSizingHorizontal = json.style.layoutSizingHorizontal;
    }
    if (json.style.layoutSizingVertical !== undefined) {
      frame.layoutSizingVertical = json.style.layoutSizingVertical;
    }
    if (json.style.width !== undefined || json.style.height !== undefined) {
      const w = json.style.width ?? frame.width;
      const h = json.style.height ?? frame.height;
      frame.resize(w, h);
    }
  }

  if (json.overrides) {
    await applyOverrides(frame, json.overrides);
  }

  if (json.locked === true) {
    frame.locked = true;
  }

  if (className) {
    try {
      const snapshot = nodeToCssObject(frame);
      frame.setPluginData('originalStyle', JSON.stringify(snapshot));
    } catch (_e) {
      // ignore
    }
  }

  return frame;
}

async function applyOverrides(
  node: SceneNode,
  overrides: Record<string, string>
): Promise<void> {
  if (overrides.content) {
    const textNodes = node.findAll((n) => n.type === 'TEXT') as TextNode[];
    for (const textNode of textNodes) {
      await loadFont(
        textNode.fontName !== figma.mixed ? (textNode.fontName as FontName).family : undefined,
        undefined,
        false
      );
      textNode.characters = overrides.content;
    }
  }
}

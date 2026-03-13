import type { NodeJSON } from '../types';
import { applyBaseStyle, applyEffects, applyBorderRadius } from '../utils/style';

export async function buildImage(
  json: NodeJSON,
  parent: BaseNode & ChildrenMixin
): Promise<RectangleNode> {
  const rect = figma.createRectangle();
  rect.name = json.className ?? json.name ?? 'Image';

  parent.appendChild(rect);

  const width = json.style?.width ?? 200;
  const height = json.style?.height ?? 200;
  rect.resize(width, height);

  try {
    const image = await figma.createImageAsync(json.content!);
    rect.fills = [
      {
        type: 'IMAGE',
        scaleMode: 'FILL',
        imageHash: image.hash,
      },
    ];
  } catch (e) {
    rect.fills = [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 } }];
    console.error(`Failed to load image: ${json.content}`, e);
  }

  applyBaseStyle(rect, json.style);
  applyBorderRadius(rect, json.style);
  applyEffects(rect, json.style);

  return rect;
}

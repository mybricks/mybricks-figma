import type { NodeJSON } from '../types';
import { applyBaseStyle, applyEffects } from '../utils/style';
import { parseColorWithOpacity } from '../utils/color';
import { loadFont } from '../utils/font';

export async function buildText(
  json: NodeJSON,
  parent: BaseNode & ChildrenMixin
): Promise<TextNode> {
  const text = figma.createText();
  text.name = json.className ?? json.name ?? 'Text';

  parent.appendChild(text);

  const fontName = await loadFont(
    json.style?.fontFamily,
    json.style?.fontWeight,
    json.style?.fontStyle === 'italic'
  );
  text.fontName = fontName;

  text.characters = json.content ?? '';

  applyBaseStyle(text, json.style);

  if (json.style?.color) {
    const { color, opacity } = parseColorWithOpacity(json.style.color);
    text.fills = [{ type: 'SOLID', color, opacity }];
  } else if (json.style?.fills && json.style.fills.length > 0 && typeof json.style.fills[0] === 'string') {
    const { color, opacity } = parseColorWithOpacity(json.style.fills[0]);
    text.fills = [{ type: 'SOLID', color, opacity }];
  }
  applyEffects(text, json.style);

  if (json.style?.fontSize !== undefined) text.fontSize = json.style.fontSize;

  if (json.style?.textAlignHorizontal !== undefined) {
    text.textAlignHorizontal = json.style.textAlignHorizontal;
  }
  if (json.style?.textAlignVertical !== undefined) {
    text.textAlignVertical = json.style.textAlignVertical;
  }

  if (json.style?.lineHeight !== undefined) {
    if (typeof json.style.lineHeight === 'number') {
      text.lineHeight = { value: json.style.lineHeight, unit: 'PIXELS' };
    } else if (json.style.lineHeight.unit === 'AUTO') {
      text.lineHeight = { unit: 'AUTO' };
    } else {
      text.lineHeight = {
        value: json.style.lineHeight.value,
        unit: json.style.lineHeight.unit,
      };
    }
  }

  if (json.style?.letterSpacing !== undefined) {
    if (typeof json.style.letterSpacing === 'number') {
      text.letterSpacing = { value: json.style.letterSpacing, unit: 'PIXELS' };
    } else {
      text.letterSpacing = {
        value: json.style.letterSpacing.value,
        unit: json.style.letterSpacing.unit,
      };
    }
  }

  if (json.style?.textDecoration !== undefined) {
    text.textDecoration = json.style.textDecoration;
  }

  return text;
}

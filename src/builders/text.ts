import type { NodeJSON, DefaultFontJSON } from '../types';
import { applyBaseStyle, applyEffects } from '../utils/style';
import { parseColorWithOpacity } from '../utils/color';
import { loadFont } from '../utils/font';

export async function buildText(
  json: NodeJSON,
  parent: BaseNode & ChildrenMixin,
  defaultFont?: DefaultFontJSON
): Promise<TextNode> {
  const text = figma.createText();
  text.name = json.className ?? json.name ?? 'Text';

  parent.appendChild(text);

  const family = json.style?.fontFamily ?? defaultFont?.fontFamily;
  const fontFamilyStack = json.style?.fontFamilyStack ?? defaultFont?.fontFamilyStack;
  const rawWeight = json.style?.fontWeight ?? defaultFont?.fontWeight;
  // 字重按每个文本节点单独设置，通过加载对应 style 的字体并设置 fontName 实现
  const weight = typeof rawWeight === 'number' && rawWeight >= 1 && rawWeight <= 1000 ? rawWeight : undefined;
  const italic = json.style?.fontStyle === 'italic' || defaultFont?.fontStyle === 'italic';
  const fontName = await loadFont(family, weight, italic, fontFamilyStack);
  text.fontName = fontName;

  text.characters = json.content ?? '';

  const rawWidth = json.style?.width;
  const rawHeight = json.style?.height;
  // 对文本宽度向上取整，避免浮点误差（如 83.9999 → 84）导致 Figma 认为文字超出宽度而换行
  const textWidth = rawWidth !== undefined ? Math.ceil(rawWidth) : undefined;
  // 生产端标记：DOM 里该文字是单行（height <= lineHeight * 1.2），或未设置（undefined）时兜底按单行处理
  const singleLine = (json.style as any)?.singleLine === true;

  console.log('[buildText] content:', json.content,
    '| rawWidth:', rawWidth, '→ textWidth:', textWidth,
    '| rawHeight:', rawHeight,
    '| fontSize:', json.style?.fontSize,
    '| singleLine:', singleLine,
    '| textAutoResize before:', text.textAutoResize,
  );

  applyBaseStyle(text, json.style, true);

  if (textWidth !== undefined && textWidth >= 1) {
    text.resize(textWidth, text.height);
    if (singleLine !== false) {
      // DOM 里是单行，或 singleLine 未知（undefined）→ 宽高都跟内容走，Figma 不折行
      text.textAutoResize = 'WIDTH_AND_HEIGHT';
    } else {
      // DOM 里已经是多行 → 固定宽度，高度随内容自动撑开
      text.textAutoResize = 'HEIGHT';
    }
    console.log('[buildText] after resize | textAutoResize:', text.textAutoResize, '| actual node size:', text.width, 'x', text.height, '| content:', json.content);
  }

  if (json.style?.color) {
    const { color, opacity } = parseColorWithOpacity(json.style.color);
    text.fills = [{ type: 'SOLID', color, opacity }];
  } else if (json.style?.fills && json.style.fills.length > 0 && typeof json.style.fills[0] === 'string') {
    const { color, opacity } = parseColorWithOpacity(json.style.fills[0]);
    text.fills = [{ type: 'SOLID', color, opacity }];
  }
  applyEffects(text, json.style);

  if (json.style?.fontSize !== undefined && json.style.fontSize >= 1) text.fontSize = json.style.fontSize;

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

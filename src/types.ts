export type NodeType =
  | 'frame'
  | 'group'
  | 'text'
  | 'image'
  | 'rectangle'
  | 'ellipse'
  | 'line'
  | 'vector'
  | 'component';

export interface ShadowEffect {
  color: string;
  offsetX: number;
  offsetY: number;
  blur: number;
  spread?: number;
}

export interface BlurEffect {
  type?: 'LAYER_BLUR' | 'BACKGROUND_BLUR';
  blur: number;
}

export interface StyleJSON {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;

  fills?: (string | FillObject)[];
  opacity?: number;
  clipsContent?: boolean;

  strokeColor?: string;
  strokeWeight?: number;
  strokeAlign?: 'INSIDE' | 'OUTSIDE' | 'CENTER';

  borderRadius?: number | [number, number, number, number];

  shadows?: ShadowEffect[];
  blurs?: BlurEffect[];

  // Text properties (use color for text color, NOT fills)
  color?: string;
  fontSize?: number;
  fontFamily?: string;
  /** 完整 font-family 栈（DOM 顺序），供插件与 listAvailableFontsAsync 匹配 */
  fontFamilyStack?: string[];
  fontWeight?: number;
  fontStyle?: 'normal' | 'italic';
  textAlignHorizontal?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
  textAlignVertical?: 'TOP' | 'CENTER' | 'BOTTOM';
  lineHeight?: number | { value: number; unit: 'PIXELS' | 'PERCENT' | 'AUTO' };
  letterSpacing?: number | { value: number; unit: 'PIXELS' | 'PERCENT' };
  textDecoration?: 'NONE' | 'UNDERLINE' | 'STRIKETHROUGH';

  // Auto-layout properties
  layoutMode?: 'NONE' | 'HORIZONTAL' | 'VERTICAL' | 'GRID';
  layoutWrap?: 'NO_WRAP' | 'WRAP';
  itemSpacing?: number;
  counterAxisSpacing?: number;
  /** 网格列数，设置后使用 layoutMode='GRID' 并生成等分 FLEX 列 */
  layoutGridColumns?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  primaryAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  counterAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'BASELINE';
  layoutSizingHorizontal?: 'FIXED' | 'HUG' | 'FILL';
  layoutSizingVertical?: 'FIXED' | 'HUG' | 'FILL';

  // CSS position: absolute / fixed 的元素在 Figma 中需脱离 Auto Layout 流式排布
  positionType?: 'absolute';

  // Constraints
  constraints?: {
    horizontal?: 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'SCALE';
    vertical?: 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'SCALE';
  };

  // Vector-specific
  vectorPaths?: VectorPathJSON[];
}

export interface FillObject {
  type: 'SOLID' | 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'IMAGE';
  color?: string;
  opacity?: number;
  /** 线性渐变色标 */
  gradientStops?: { position: number; color: string }[];
  /** 线性渐变角度（度），0=上→下，90=左→右 */
  angle?: number;
  /** 图片 fill：data URL（data:image/...;base64,...）或纯 base64，由 dom-to-json 内联后传入 */
  content?: string;
  /** 图片 URL（当 content 未内联时可选，插件尝试拉取） */
  url?: string;
}

export interface VectorPathJSON {
  data: string;
  windingRule?: 'NONZERO' | 'EVENODD';
}

export interface NodeJSON {
  type: NodeType;
  name?: string;
  className?: string;
  /** Selector path from root, e.g. [".column .listItem .val"]. Written at build time, read back when syncing styles. */
  selectors?: string[];
  content?: string;
  ref?: string;
  overrides?: Record<string, string>;
  locked?: boolean;
  style?: StyleJSON;
  children?: NodeJSON[];
}

export interface ComponentDefJSON {
  type: string;
  name?: string;
  className?: string;
  selectors?: string[];
  style?: StyleJSON;
  children?: NodeJSON[];
}

export interface DefaultFontJSON {
  fontFamily: string;
  fontFamilyStack?: string[];
  fontWeight?: number;
  fontStyle?: 'normal' | 'italic';
}

export interface PageJSON {
  name?: string;
  'component-def'?: ComponentDefJSON[];
  defaultFont?: DefaultFontJSON;
  content: NodeJSON[];
}

export interface RootJSON {
  page: PageJSON;
}

export type ComponentMap = Map<string, ComponentNode>;
export type ComponentDefMap = Map<string, ComponentDefJSON>;

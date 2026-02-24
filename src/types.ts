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
  fontWeight?: number;
  fontStyle?: 'normal' | 'italic';
  textAlignHorizontal?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
  textAlignVertical?: 'TOP' | 'CENTER' | 'BOTTOM';
  lineHeight?: number | { value: number; unit: 'PIXELS' | 'PERCENT' | 'AUTO' };
  letterSpacing?: number | { value: number; unit: 'PIXELS' | 'PERCENT' };
  textDecoration?: 'NONE' | 'UNDERLINE' | 'STRIKETHROUGH';

  // Auto-layout properties
  layoutMode?: 'NONE' | 'HORIZONTAL' | 'VERTICAL';
  itemSpacing?: number;
  counterAxisSpacing?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  primaryAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  counterAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'BASELINE';
  layoutSizingHorizontal?: 'FIXED' | 'HUG' | 'FILL';
  layoutSizingVertical?: 'FIXED' | 'HUG' | 'FILL';

  // Constraints
  constraints?: {
    horizontal?: 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'SCALE';
    vertical?: 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'SCALE';
  };

  // Vector-specific
  vectorPaths?: VectorPathJSON[];
}

export interface FillObject {
  type: 'SOLID' | 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL';
  color?: string;
  opacity?: number;
  gradientStops?: { position: number; color: string }[];
}

export interface VectorPathJSON {
  data: string;
  windingRule?: 'NONZERO' | 'EVENODD';
}

export interface NodeJSON {
  type: NodeType;
  name?: string;
  className?: string;
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
  style?: StyleJSON;
  children?: NodeJSON[];
}

export interface PageJSON {
  name?: string;
  'component-def'?: ComponentDefJSON[];
  content: NodeJSON[];
}

export interface RootJSON {
  page: PageJSON;
}

export type ComponentMap = Map<string, ComponentNode>;
export type ComponentDefMap = Map<string, ComponentDefJSON>;

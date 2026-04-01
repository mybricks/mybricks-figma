export type NodeType =
  | 'frame'
  | 'group'
  | 'text'
  | 'image'
  | 'rectangle'
  | 'ellipse'
  | 'line'
  | 'vector'
  | 'svg'
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

// ---------------------------------------------------------------------------
// StyleJSON — 生产侧（dom-to-json）→ 消费侧（VibeUI 插件）的样式契约
//
// 排查思路：
//   JSON 字段不符合预期 → 定位生产侧（dom-to-json.js）
//   JSON 字段正确但 Figma 呈现错误 → 定位消费侧（builders/ utils/）
// ---------------------------------------------------------------------------
export interface StyleJSON {
  // ── 几何 ──────────────────────────────────────────────────────────────────

  /** 节点 x 坐标（设计稿坐标系，像素）。绝对定位节点相对父框左上角；普通 Auto Layout 子节点由父布局决定，忽略此值。 */
  x?: number;
  /** 节点 y 坐标（设计稿坐标系，像素）。 */
  y?: number;
  /** 节点宽度（像素）。text 节点由消费侧按 textAutoResize 策略决定是否使用。 */
  width?: number;
  /** 节点高度（像素）。text 节点由消费侧按 textAutoResize 策略决定是否使用。 */
  height?: number;
  /** 旋转角度（度，逆时针为正，与 Figma API 约定一致；生产端已将 CSS 顺时针转为逆时针）。 */
  rotation?: number;

  // ── 外观 ──────────────────────────────────────────────────────────────────

  /**
   * 填充列表。每项为 CSS color 字符串（纯色）或 FillObject（渐变/图片）。
   * text 节点颜色优先使用 `color` 字段；`fills` 作为 text 颜色的兜底回退，
   * 仅在 `color` 缺失且 fills[0] 为字符串时生效。
   */
  fills?: (string | FillObject)[];
  /** 节点整体透明度，0–1。 */
  opacity?: number;
  /**
   * 是否裁剪溢出内容，对应 CSS `overflow: hidden/visible`。
   * 缺省时消费侧沿用 Figma 默认（Frame = 裁剪，等同 true）。
   * 仅当 CSS `overflow: visible` 时生产侧显式写入 `false`。
   * 生产侧从不写入 `true`。
   */
  clipsContent?: boolean;

  /** 描边颜色（CSS color 字符串）。 */
  strokeColor?: string;
  /** 描边宽度（像素，四边相同时使用）。 */
  strokeWeight?: number;
  strokeAlign?: 'INSIDE' | 'OUTSIDE' | 'CENTER';
  /** 四边独立描边宽度（当四边不一致时输出，消费端使用 individualStrokeWeights）。 */
  strokeTopWeight?: number;
  strokeRightWeight?: number;
  strokeBottomWeight?: number;
  strokeLeftWeight?: number;

  /** 圆角半径（像素）。四角相同时为数字，各角不同时为 [topLeft, topRight, bottomRight, bottomLeft]。 */
  borderRadius?: number | [number, number, number, number];

  /** 阴影效果列表，对应 CSS `box-shadow`。 */
  shadows?: ShadowEffect[];
  /** 模糊效果列表，对应 CSS `filter: blur()` 或 `backdrop-filter: blur()`。 */
  blurs?: BlurEffect[];

  // ── 文本专有 ──────────────────────────────────────────────────────────────
  // 以下字段仅对 type='text' 节点有意义，frame 节点上即使存在也会被消费侧忽略。

  /**
   * 文本颜色（CSS color 字符串，含 rgba）。
   * text 节点颜色的主要来源，优先于 fills。
   */
  color?: string;
  /** 字号（像素）。 */
  fontSize?: number;
  /**
   * 字体族首选项（如 "Noto Sans"）。
   * 消费侧从 fontFamilyStack 逐项匹配 Figma 可用字体，找不到则降级。
   */
  fontFamily?: string;
  /** 完整 font-family 栈（DOM 顺序），供消费侧与 Figma listAvailableFontsAsync 结果逐项匹配。 */
  fontFamilyStack?: string[];
  /** 字重（100–900）。 */
  fontWeight?: number;
  fontStyle?: 'normal' | 'italic';
  /** 水平对齐，对应 CSS text-align。 */
  textAlignHorizontal?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
  /**
   * 垂直对齐。生产侧在以下两种场景写入：
   *
   * 1. input/textarea 的文本子节点（DOM 中 input 内容天然垂直居中）→ 固定写入 `'CENTER'`。
   *    此场景 height ≈ lineHeight，不满足 `height > fontSize × 2`，消费侧走普通 singleLine 分支。
   *
   * 2. `positionType='absolute'` 的文本叶子节点，且满足以下任一条件（shouldSetTextAlignVerticalCenterForAbsoluteTextLeaf）：
   *    a. `display:flex` + `align-items:center`（span 撑满容器 + flex 垂直居中，如 antd Pagination •••）
   *    b. `singleLine=true` + `height ≥ fontSize × 1.75`
   *    c. `singleLine=true` + `height > lineHeight × 1.25`
   *    → 消费侧检测 `positionType='absolute'` + `textAlignVertical='CENTER'` + `height > fontSize × 2`
   *      时（isAbsoluteCenteredBox），用两步 resize 固定全盒尺寸，让 Figma textAlignVertical 在全盒范围内生效。
   *
   * 不满足上述条件时生产侧不写入，消费侧不设置（Figma 默认 TOP）。
   */
  textAlignVertical?: 'TOP' | 'CENTER' | 'BOTTOM';
  /** 行高。数字为像素值；对象形式支持 PIXELS/PERCENT/AUTO 单位。 */
  lineHeight?: number | { value: number; unit: 'PIXELS' | 'PERCENT' | 'AUTO' };
  /** 字间距。数字为像素值；对象形式支持 PIXELS/PERCENT 单位。 */
  letterSpacing?: number | { value: number; unit: 'PIXELS' | 'PERCENT' };
  textDecoration?: 'NONE' | 'UNDERLINE' | 'STRIKETHROUGH';
  /**
   * 文本截断，对应 CSS `text-overflow: ellipsis`。
   * 仅当 `widthConstrained=true` 且 CSS 中确实设置了 ellipsis 时生产侧才写入。
   * 消费侧据此设置 Figma textTruncation='ENDING'。
   */
  textOverflow?: 'ellipsis';
  /**
   * 生产侧标记：DOM 计算后该文本为单行。
   * 判断条件（dom-to-json.js）：
   *   有 lineHeight 时：height ≤ lineHeight × 1.2
   *   否则：height < fontSize × 2
   *
   * 消费侧（buildText）据此决定 textAutoResize 策略：
   *   true  + widthConstrained=true  → textAutoResize='HEIGHT'（固定 DOM 宽度，内容有余量不换行）
   *   true  + widthConstrained=false → textAutoResize='WIDTH_AND_HEIGHT'（Figma 自动定宽）
   *   false → textAutoResize='HEIGHT'（多行，固定宽度，高度自动撑开）
   *
   * 缺省时消费侧按 true 处理（兜底按单行）。
   * 仅由 dom-to-json 写入，消费侧只读。
   */
  singleLine?: boolean;
  /**
   * 生产侧标记：容器 CSS 约束了文本宽度，内容未撑满。
   * 满足以下任一条件（且 singleLine=true）时写入 true：
   *   A. CSS text-overflow:ellipsis 且 overflow-x 非 visible
   *   B. 通过 Range API 测量：内容实际宽度 < 元素宽度 × 0.9
   *
   * 消费侧（buildText）在 singleLine=true 时据此决定是否固定 DOM 宽度：
   *   true  → textAutoResize='HEIGHT'，固定 width，内容留余量，不因 Figma 字体略宽而换行
   *   false/缺省 → textAutoResize='WIDTH_AND_HEIGHT'，让 Figma 自动定宽
   *
   * 仅由 dom-to-json 写入，消费侧只读。
   */
  widthConstrained?: boolean;

  // ── Auto Layout ───────────────────────────────────────────────────────────

  /**
   * Figma Auto Layout 方向，对应 CSS flex-direction / grid-auto-flow。
   * - HORIZONTAL：flex-direction:row 或 grid
   * - VERTICAL：flex-direction:column
   * - GRID：需同时提供 layoutGridColumns（dom-to-json 不输出，仅消费侧内部使用）
   * text 节点在生产侧构建完后会删除此字段（type='text' 不应有布局模式）。
   */
  layoutMode?: 'NONE' | 'HORIZONTAL' | 'VERTICAL' | 'GRID';
  /** flex-wrap:wrap 时设为 'WRAP'，仅对 HORIZONTAL 布局有效。 */
  layoutWrap?: 'NO_WRAP' | 'WRAP';
  /** 主轴子节点间距（像素），对应 CSS gap / column-gap。 */
  itemSpacing?: number;
  /** 交叉轴换行间距（像素），对应 CSS row-gap（仅 layoutWrap=WRAP 时有效）。 */
  counterAxisSpacing?: number;
  /** 网格列数，设置后使用 layoutMode='GRID' 并生成等分 FLEX 列。 */
  layoutGridColumns?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  /** 主轴对齐方式，对应 CSS justify-content。 */
  primaryAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  /** 交叉轴对齐方式，对应 CSS align-items。 */
  counterAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'BASELINE';
  /**
   * 节点在主轴方向上的尺寸模式，对应 Figma layoutSizingHorizontal。
   * 缺省时消费侧默认按 FIXED 处理（只要有 width 就设为 FIXED）。
   * 生产侧仅在需要 HUG 或 FILL 时显式写入；FIXED 场景不输出。
   * 目前生产侧仅在 text→frame 伪元素升级时不输出（保持消费侧 FIXED 默认即可）。
   */
  layoutSizingHorizontal?: 'FIXED' | 'HUG' | 'FILL';
  /**
   * 节点在交叉轴方向上的尺寸模式，对应 Figma layoutSizingVertical。
   * 缺省时消费侧默认按 FIXED 处理（只要有 height 就设为 FIXED）。
   * 生产侧仅在 text→frame 伪元素升级时写入 'HUG'（包裹文本高度）。
   */
  layoutSizingVertical?: 'FIXED' | 'HUG' | 'FILL';

  // ── 定位 & 子节点布局 ────────────────────────────────────────────────────

  /**
   * CSS position: absolute 或 fixed 均输出为 `'absolute'`（dom-to-json 中 fixed 统一映射）。
   * 消费侧据此设置 Figma layoutPositioning='ABSOLUTE'，使节点脱离父 Auto Layout 流式排布。
   * 消费侧代码中偶见 `=== 'fixed'` 判断，是对手写 JSON 的防御性兼容，正常导出不会出现 'fixed'。
   * 缺省（undefined）表示 position:static/relative，消费侧不做特殊处理。
   */
  positionType?: 'absolute';

  /** Auto Layout 子节点左外边距（像素），对应 CSS margin-left。可为负数（负 margin 会触发生产侧关闭 Auto Layout）。 */
  marginLeft?: number;
  /** Auto Layout 子节点右外边距（像素），对应 CSS margin-right。 */
  marginRight?: number;
  /** Auto Layout 子节点上外边距（像素），对应 CSS margin-top。 */
  marginTop?: number;
  /** Auto Layout 子节点下外边距（像素），对应 CSS margin-bottom。 */
  marginBottom?: number;

  /**
   * 覆盖父容器 counterAxisAlignItems 的单个子节点对齐，对应 CSS align-self。
   * 目前生产侧仅在 textarea→frame 场景写入 'MIN'（防止被父级垂直居中错位）。
   * 消费侧映射到 Figma layoutAlign。
   */
  alignSelf?: 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'BASELINE';

  // ── 约束 ──────────────────────────────────────────────────────────────────

  /**
   * Figma 约束（相对父框的锚定方式），对应 Figma Constraints 面板。
   * dom-to-json 不写入此字段（DOM 无对应概念）。
   * 仅供手写 JSON 或 component-def 中对特定节点设置固定比例/居中锚定时使用。
   */
  constraints?: {
    horizontal?: 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'SCALE';
    vertical?: 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'SCALE';
  };

  // ── 矢量 ──────────────────────────────────────────────────────────────────

  /** 矢量路径数据，仅 type='vector' 节点使用。 */
  vectorPaths?: VectorPathJSON[];
}

export interface FillObject {
  type: 'SOLID' | 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'IMAGE';
  color?: string;
  opacity?: number;
  /** 线性/径向渐变色标列表 */
  gradientStops?: { position: number; color: string }[];
  /** 线性渐变角度（度），0=上→下，90=左→右 */
  angle?: number;
  /** 径向渐变圆心 x 坐标（0-1，相对节点归一化空间），默认 0.5 */
  centerX?: number;
  /** 径向渐变圆心 y 坐标（0-1，相对节点归一化空间），默认 0.5 */
  centerY?: number;
  /** 径向渐变半径（0-1，相对节点归一化空间），默认 0.5（圆与边缘相切） */
  radius?: number;
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
  /** 节点类型，决定消费侧调用哪个 builder。 */
  type: NodeType;
  /** Figma 图层名称（展示用）。缺省时取 className。 */
  name?: string;
  /** DOM class 名称（取第一个有意义的 class），同时作为 Figma 图层名。 */
  className?: string;
  /** Selector path from root, e.g. [".column .listItem .val"]. Written at build time, read back when syncing styles. */
  selectors?: string[];
  /** 文本内容（仅 type='text' 使用）。 */
  content?: string;
  /** 组件引用 ID（仅 type='component' 使用）。 */
  ref?: string;
  overrides?: Record<string, string>;
  /** 是否锁定节点（Figma 图层面板锁定）。 */
  locked?: boolean;
  /** 节点样式，见 StyleJSON。 */
  style?: StyleJSON;
  /** 子节点列表（frame/group/component 等容器节点使用）。 */
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

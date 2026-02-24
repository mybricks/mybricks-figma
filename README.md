# MyBricks-Figma

MyBricks连接Figma的插件

## 功能特性

- **JSON 驱动**：使用结构化 JSON 描述页面布局与样式，快速生成设计稿
- **多种节点类型**：支持 frame、group、text、image、rectangle、ellipse、line、vector、component
- **组件系统**：通过 `component-def` 定义可复用组件，使用 `ref` 引用并支持 `overrides` 覆盖
- **Auto Layout**：完整支持 Figma 自动布局（layoutMode、padding、itemSpacing 等）
- **样式丰富**：填充、描边、圆角、阴影、模糊、字体、约束等
- **className → CSS**：生成后可将节点上的 `className` 导出为 CSS 选择器，便于设计与代码同步

## 安装

### 从源码安装（开发模式）

1. 克隆或下载本仓库
2. 安装依赖并构建：

```bash
npm install
npm run build
```

3. 在 Figma 中导入插件：
   - 打开 Figma → 菜单 **Plugins** → **Development** → **Import plugin from manifest...**
   - 选择项目根目录下的 `manifest.json`

### 开发模式（监听文件变化）

```bash
npm run dev
```

修改 `src/` 下代码后会自动重新构建，在 Figma 中重新运行插件即可看到更新。

## 使用方法

1. 在 Figma 中运行 **MyBricks** 插件
2. 在插件面板中粘贴 JSON（`Cmd+V` / `Ctrl+V`）或手动输入
3. 点击 **Generate** 按钮，或使用 `Cmd+Enter` / `Ctrl+Enter` 快捷键
4. 生成的节点会出现在当前页面的画布上

### 快捷入口

插件支持 **Relaunch**：在已生成的节点上右键，选择 **Plugins** → **Paste JSON and generate** 可快速再次打开插件。

## JSON 结构

### 根结构

```json
{
  "page": {
    "component-def": [ /* 可选：组件定义 */ ],
    "content": [ /* 必填：页面根节点数组 */ ]
  }
}
```

- `page.content`：必填，页面顶层节点数组
- `page.component-def`：可选，可复用组件的定义，通过 `type` 作为唯一标识

### 节点类型

| 类型 | 说明 | 必填字段 |
|------|------|----------|
| `frame` | 帧/容器 | - |
| `group` | 分组 | - |
| `text` | 文本 | `content` |
| `image` | 图片 | `content`（图片 URL） |
| `rectangle` | 矩形 | - |
| `ellipse` | 椭圆 | - |
| `line` | 直线 | - |
| `vector` | 矢量路径 | - |
| `component` | 组件实例 | `ref`（引用 component-def 的 type） |

### 通用节点属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `type` | string | 节点类型，必填 |
| `name` | string | 节点名称 |
| `className` | string | 类名，用于导出 CSS |
| `style` | object | 样式对象 |
| `children` | array | 子节点数组 |
| `locked` | boolean | 是否锁定节点 |

### 组件相关

- **定义组件**：在 `page.component-def` 中定义，`type` 作为组件 ID
- **引用组件**：`{ "type": "component", "ref": "button" }`
- **覆盖属性**：`overrides` 可覆盖子节点内容，如 `{ "content": "提交" }` 覆盖文本

## 样式属性 (style)

### 布局与尺寸

| 属性 | 类型 | 说明 |
|------|------|------|
| `x`, `y` | number | 位置 |
| `width`, `height` | number | 宽高 |
| `rotation` | number | 旋转角度（度） |

### 填充与描边

| 属性 | 类型 | 说明 |
|------|------|------|
| `fills` | string[] \| FillObject[] | 填充色，支持 `#hex`、`rgb()` 或渐变对象 |
| `opacity` | number | 不透明度 0–1 |
| `strokeColor` | string | 描边颜色 |
| `strokeWeight` | number | 描边宽度 |
| `strokeAlign` | string | `INSIDE` \| `OUTSIDE` \| `CENTER` |
| `borderRadius` | number \| [number, number, number, number] | 圆角 |

### 效果

| 属性 | 类型 | 说明 |
|------|------|------|
| `shadows` | ShadowEffect[] | 阴影 |
| `blurs` | BlurEffect[] | 模糊（`LAYER_BLUR` / `BACKGROUND_BLUR`） |

### 文本

| 属性 | 类型 | 说明 |
|------|------|------|
| `color` | string | 文本颜色（勿用 fills） |
| `fontSize` | number | 字号 |
| `fontFamily` | string | 字体，如 `Inter` |
| `fontWeight` | number | 字重 |
| `fontStyle` | string | `normal` \| `italic` |
| `textAlignHorizontal` | string | `LEFT` \| `CENTER` \| `RIGHT` \| `JUSTIFIED` |
| `textAlignVertical` | string | `TOP` \| `CENTER` \| `BOTTOM` |
| `lineHeight` | number \| object | 行高 |
| `letterSpacing` | number \| object | 字间距 |
| `textDecoration` | string | `NONE` \| `UNDERLINE` \| `STRIKETHROUGH` |

### Auto Layout

| 属性 | 类型 | 说明 |
|------|------|------|
| `layoutMode` | string | `NONE` \| `HORIZONTAL` \| `VERTICAL` |
| `itemSpacing` | number | 子项间距 |
| `counterAxisSpacing` | number | 交叉轴间距 |
| `paddingTop/Right/Bottom/Left` | number | 内边距 |
| `primaryAxisAlignItems` | string | `MIN` \| `CENTER` \| `MAX` \| `SPACE_BETWEEN` |
| `counterAxisAlignItems` | string | `MIN` \| `CENTER` \| `MAX` \| `BASELINE` |
| `layoutSizingHorizontal` | string | `FIXED` \| `HUG` \| `FILL` |
| `layoutSizingVertical` | string | `FIXED` \| `HUG` \| `FILL` |

### 约束

```json
"constraints": {
  "horizontal": "MIN" | "CENTER" | "MAX" | "STRETCH" | "SCALE",
  "vertical": "MIN" | "CENTER" | "MAX" | "STRETCH" | "SCALE"
}
```

## 示例

### 基础示例

```json
{
  "page": {
    "content": [
      {
        "type": "frame",
        "name": "卡片",
        "style": {
          "width": 300,
          "height": 200,
          "fills": ["#F9FAFB"],
          "borderRadius": 12,
          "layoutMode": "VERTICAL",
          "itemSpacing": 12,
          "paddingTop": 24,
          "paddingLeft": 24,
          "paddingRight": 24,
          "paddingBottom": 24
        },
        "children": [
          {
            "type": "text",
            "content": "标题",
            "style": { "fontSize": 18, "fontWeight": 600, "color": "#111827" }
          },
          {
            "type": "text",
            "content": "这是一段描述文字。",
            "style": { "fontSize": 14, "color": "#6B7280" }
          }
        ]
      }
    ]
  }
}
```

### 组件定义与引用

```json
{
  "page": {
    "component-def": [
      {
        "type": "button",
        "style": {
          "width": 120,
          "height": 40,
          "fills": ["#3B82F6"],
          "borderRadius": 8,
          "layoutMode": "VERTICAL",
          "primaryAxisAlignItems": "CENTER",
          "counterAxisAlignItems": "CENTER"
        },
        "children": [
          {
            "type": "text",
            "content": "按钮",
            "style": { "fontSize": 12, "fontWeight": 600, "color": "#FFFFFF" }
          }
        ]
      }
    ],
    "content": [
      {
        "type": "frame",
        "style": { "layoutMode": "VERTICAL", "itemSpacing": 8 },
        "children": [
          { "type": "component", "ref": "button" },
          { "type": "component", "ref": "button", "overrides": { "content": "提交" } }
        ]
      }
    ]
  }
}
```

更多示例见项目中的 `example.json` 和 `student-archive-example.json`。

## 项目结构

```
mybricks-figma/
├── manifest.json          # Figma 插件清单
├── src/
│   ├── code.ts            # 插件主逻辑
│   ├── ui.html            # 插件 UI
│   ├── parser.ts          # JSON 解析与校验
│   ├── types.ts           # TypeScript 类型定义
│   ├── builders/          # 各节点类型的构建器
│   │   ├── index.ts
│   │   ├── frame.ts
│   │   ├── group.ts
│   │   ├── text.ts
│   │   ├── image.ts
│   │   ├── rectangle.ts
│   │   ├── ellipse.ts
│   │   ├── line.ts
│   │   ├── vector.ts
│   │   └── component.ts
│   └── utils/
│       ├── color.ts
│       ├── font.ts
│       ├── layout.ts
│       ├── nodeToCss.ts
│       └── style.ts
├── dist/                  # 构建输出（code.js, ui.html）
├── example.json
├── student-archive-example.json
├── esbuild.config.mjs
├── package.json
└── tsconfig.json
```

## 技术栈

- **TypeScript**：类型安全
- **esbuild**：快速构建
- **Figma Plugin API**：与 Figma 交互

## 网络权限

插件在 `manifest.json` 中声明了 `networkAccess`，用于从 JSON 中指定的 URL 加载图片。若 JSON 中无 `image` 节点或图片 URL 均为本地/内网，可考虑移除该权限以提升安全性。

## 常见问题

**Q: 文本不显示或样式异常？**  
A: 确保使用 `color` 设置文本颜色，不要用 `fills`。字体需为 Figma 已安装字体（如 Inter）。

**Q: 图片加载失败？**  
A: 图片 URL 需为可公网访问的地址，且支持 CORS。

**Q: 组件引用报错？**  
A: 确保 `ref` 与 `component-def` 中某条定义的 `type` 完全一致。

## License

MIT

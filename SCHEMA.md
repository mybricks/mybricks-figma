# NodeJSON / StyleJSON 字段契约

> 生产侧：`comlib-pc-normal-lite/src/mix/utils/dom-to-json.js`
> 消费侧：`VibeUI/src/builders/` + `VibeUI/src/utils/`
>
> **排查思路**
> - JSON 字段不符合预期 → 定位**生产侧**
> - JSON 字段正确但 Figma 呈现错误 → 定位**消费侧**

---

## NodeJSON 顶层字段

| 字段 | 类型 | 必填 | 生产侧来源 | 消费侧用途 |
|---|---|---|---|---|
| `type` | `NodeType` | ✓ | DOM 标签 / 结构推断 | 路由到对应 builder |
| `name` | `string` | — | DOM 属性 / 推断 | Figma 图层名（次选） |
| `className` | `string` | — | DOM `.classList[0]` | Figma 图层名（首选） |
| `selectors` | `string[]` | — | build 阶段写入 | 样式同步时回读 |
| `content` | `string` | — | `textContent` | TEXT 节点内容 |
| `ref` | `string` | — | component 引用 | component builder |
| `locked` | `boolean` | — | 手写 JSON | Figma 图层锁定 |
| `style` | `StyleJSON` | — | 见下节 | 见下节 |
| `children` | `NodeJSON[]` | — | DOM 子树递归 | 递归构建子节点 |

---

## StyleJSON 字段

### 几何

| 字段 | 类型 | 值域 | 生产侧写入条件 | 消费侧行为 |
|---|---|---|---|---|
| `x` | `number` | 任意（像素） | 所有节点 | 绝对定位节点设 x；Auto Layout 普通子节点跳过 |
| `y` | `number` | 任意（像素） | 所有节点 | 同上 |
| `width` | `number` | ≥ 0（像素） | 所有节点 | frame 用于 resize；text 节点视 textAutoResize 策略决定 |
| `height` | `number` | ≥ 0（像素） | 所有节点 | 同上 |
| `rotation` | `number` | 度，顺时针为正 | 有 CSS transform:rotate | Figma node.rotation |

### 外观

| 字段 | 类型 | 值域 | 生产侧写入条件 | 消费侧行为 |
|---|---|---|---|---|
| `fills` | `(string \| FillObject)[]` | CSS color 字符串 或 FillObject | 背景色/渐变/图片 | frame 的填充；text 的颜色兜底（`color` 优先） |
| `opacity` | `number` | 0–1 | CSS opacity < 1 | Figma node.opacity |
| `clipsContent` | `boolean` | 仅写入 `false` | CSS `overflow:visible` | `false`=不裁剪；**缺省=Figma默认裁剪** |
| `strokeColor` | `string` | CSS color | CSS border / outline | Figma stroke |
| `strokeWeight` | `number` | ≥ 0（像素） | 四边相同时 | Figma strokeWeight |
| `strokeAlign` | `'INSIDE' \| 'OUTSIDE' \| 'CENTER'` | — | 对应 box-sizing | Figma strokeAlign |
| `strokeTopWeight` | `number` | ≥ 0（像素） | 四边不同时 | Figma individualStrokeWeights |
| `strokeRightWeight` | `number` | 同上 | 同上 | 同上 |
| `strokeBottomWeight` | `number` | 同上 | 同上 | 同上 |
| `strokeLeftWeight` | `number` | 同上 | 同上 | 同上 |
| `borderRadius` | `number \| [number,number,number,number]` | ≥ 0（像素） | CSS border-radius | Figma cornerRadius / cornerRadii |
| `shadows` | `ShadowEffect[]` | — | CSS box-shadow | Figma DROP_SHADOW effects |
| `blurs` | `BlurEffect[]` | — | CSS filter:blur / backdrop-filter:blur | Figma blur effects |

### 文本专有（仅 `type='text'` 有效）

| 字段 | 类型 | 值域 | 生产侧写入条件 | 消费侧行为 |
|---|---|---|---|---|
| `color` | `string` | CSS color（含 rgba） | 有 CSS color | Figma text.fills（优先于 fills） |
| `fontSize` | `number` | ≥ 1（像素） | 所有文本 | Figma text.fontSize（须在 resize 前设置以避免自然宽计算错误，见 isAbsoluteCenteredBox） |
| `fontFamily` | `string` | 字体名 | 所有文本 | 从 fontFamilyStack 匹配首选 |
| `fontFamilyStack` | `string[]` | — | 所有文本 | 逐项与 Figma 可用字体匹配，降级 |
| `fontWeight` | `number` | 100–900 | 所有文本 | Figma fontName.style |
| `fontStyle` | `'normal' \| 'italic'` | — | CSS font-style:italic | Figma fontName.style |
| `textAlignHorizontal` | `'LEFT' \| 'CENTER' \| 'RIGHT' \| 'JUSTIFIED'` | — | CSS text-align | Figma text.textAlignHorizontal |
| `textAlignVertical` | `'TOP' \| 'CENTER' \| 'BOTTOM'` | — | 见下方详述 | Figma text.textAlignVertical（须配合固定盒才生效） |
| `lineHeight` | `number \| {value,unit}` | — | CSS line-height | Figma text.lineHeight |
| `letterSpacing` | `number \| {value,unit}` | — | CSS letter-spacing | Figma text.letterSpacing |
| `textDecoration` | `'NONE' \| 'UNDERLINE' \| 'STRIKETHROUGH'` | — | CSS text-decoration | Figma text.textDecoration |
| `textOverflow` | `'ellipsis'` | — | CSS text-overflow:ellipsis + overflow-x≠visible | Figma textTruncation='ENDING'（同时 widthConstrained=true） |
| `singleLine` | `boolean` | — | 所有文本（见下方详述） | 决定 textAutoResize 策略 |
| `widthConstrained` | `boolean` | 仅写 `true` | singleLine=true 且内容宽 < 元素宽×0.9 或 ellipsis | 决定是否固定 DOM 宽度 |

#### `textAlignVertical` 写入路径

| 场景 | 值 | 消费侧分支 |
|---|---|---|
| `input` / `textarea` 文本子节点 | `'CENTER'` | 普通 singleLine 分支（height≈lineHeight，不满足 height>fontSize×2） |
| 绝对定位叶子文本，`display:flex + align-items:center` | `'CENTER'` | `isAbsoluteCenteredBox`（height>fontSize×2，两步resize固定全盒） |
| 绝对定位叶子文本，`singleLine=true + height≥fontSize×1.75` | `'CENTER'` | 同上 |
| textarea 内联文本子节点 | `'TOP'` | 普通 HEIGHT 模式 |
| 其他文本 | **不写入** | Figma 默认 TOP |

#### `singleLine` + `widthConstrained` 消费侧决策矩阵

| `singleLine` | `widthConstrained` | `textOverflow` | `isAbsoluteCenteredBox` | textAutoResize | 说明 |
|---|---|---|---|---|---|
| `true` | `true` | `'ellipsis'` | `false` | `HEIGHT` + textTruncation | 截断单行 |
| `true` | `true` | 无 | `false` | `HEIGHT` | 固定宽，内容有余量 |
| `true` | `false` | 无 | `false` | `WIDTH_AND_HEIGHT` | 内容撑满，Figma自动定宽 |
| `false` | — | — | `false` | `HEIGHT` | 多行，固定宽 |
| 任意 | 任意 | 任意 | `true` | `NONE`（两步resize） | 绝对定位全盒垂直居中 |

### Auto Layout

| 字段 | 类型 | 值域 | 生产侧写入条件 | 消费侧行为 |
|---|---|---|---|---|
| `layoutMode` | `'HORIZONTAL' \| 'VERTICAL'` | — | CSS flex / grid / block 推断 | Figma node.layoutMode（text节点生产侧构建后删除） |
| `layoutWrap` | `'WRAP'` | 仅此值 | CSS flex-wrap:wrap（HORIZONTAL布局） | Figma node.layoutWrap |
| `itemSpacing` | `number` | ≥ 0（像素） | CSS gap / column-gap | Figma node.itemSpacing |
| `counterAxisSpacing` | `number` | ≥ 0（像素） | CSS row-gap（layoutWrap=WRAP） | Figma node.counterAxisSpacing |
| `layoutGridColumns` | `number` | 正整数 | CSS grid-template-columns | Figma gridColumnCount + gridColumnSizes |
| `paddingTop` | `number` | ≥ 0（像素） | CSS padding-top | Figma node.paddingTop |
| `paddingRight` | `number` | ≥ 0（像素） | CSS padding-right | Figma node.paddingRight |
| `paddingBottom` | `number` | ≥ 0（像素） | CSS padding-bottom | Figma node.paddingBottom |
| `paddingLeft` | `number` | ≥ 0（像素） | CSS padding-left | Figma node.paddingLeft |
| `primaryAxisAlignItems` | `'MIN' \| 'CENTER' \| 'MAX' \| 'SPACE_BETWEEN'` | — | CSS justify-content 映射；**`justify-content: space-between` 且仅 1 个流内 flex 子项时**，生产侧输出 `MIN`/`MAX`（主轴起点），因 Figma 单子项 `SPACE_BETWEEN` 会居中 | Figma node.primaryAxisAlignItems |
| `counterAxisAlignItems` | `'MIN' \| 'CENTER' \| 'MAX' \| 'BASELINE'` | — | CSS align-items 映射 | Figma node.counterAxisAlignItems |
| `layoutSizingHorizontal` | `'FIXED' \| 'HUG' \| 'FILL'` | — | 需要 HUG/FILL 时写入；**缺省=FIXED** | Figma node.layoutSizingHorizontal |
| `layoutSizingVertical` | `'FIXED' \| 'HUG' \| 'FILL'` | — | text→frame伪元素升级时写 `'HUG'`；**缺省=FIXED** | Figma node.layoutSizingVertical |

### 定位 & 子节点布局

| 字段 | 类型 | 值域 | 生产侧写入条件 | 消费侧行为 |
|---|---|---|---|---|
| `positionType` | `'absolute'` | 仅此值 | CSS position:absolute **或** fixed（统一输出为 `'absolute'`） | Figma layoutPositioning='ABSOLUTE'，脱离Auto Layout流 |
| `marginLeft` | `number` | 任意（含负，像素） | CSS margin-left；负margin触发生产侧关闭Auto Layout | Figma child.marginLeft |
| `marginRight` | `number` | 同上 | CSS margin-right | Figma child.marginRight |
| `marginTop` | `number` | 同上 | CSS margin-top | Figma child.marginTop |
| `marginBottom` | `number` | 同上 | CSS margin-bottom | Figma child.marginBottom |
| `alignSelf` | `'MIN' \| 'CENTER' \| 'MAX' \| 'STRETCH' \| 'BASELINE'` | — | textarea→frame场景写 `'MIN'` | Figma child.layoutAlign |
| `constraints` | `{horizontal?,vertical?}` | 见类型 | **生产侧不写入**，仅供手写JSON/component-def | Figma node.constraints |

### FillObject

| 字段 | 类型 | 值域 | 说明 |
|---|---|---|---|
| `type` | `'SOLID' \| 'GRADIENT_LINEAR' \| 'GRADIENT_RADIAL' \| 'IMAGE'` | — | 填充类型 |
| `color` | `string` | CSS color | SOLID 类型的颜色 |
| `opacity` | `number` | 0–1 | 填充透明度 |
| `gradientStops` | `{position:number, color:string}[]` | position 0–1 | 渐变色标 |
| `angle` | `number` | 度，0=上→下，90=左→右 | 线性渐变角度 |
| `content` | `string` | data URL 或 base64 | IMAGE 类型内联图片 |
| `url` | `string` | URL | IMAGE 类型远程图片（content 缺失时回退） |

---

## 典型示例 JSON

### 普通单行文本（按钮标签）

```json
{
  "type": "text",
  "className": "btn-label",
  "content": "立即购买",
  "style": {
    "x": 16, "y": 12,
    "width": 56, "height": 20,
    "fontSize": 14,
    "color": "rgba(255,255,255,1)",
    "fontFamily": "Noto Sans",
    "fontFamilyStack": ["-apple-system", "Noto Sans", "sans-serif"],
    "fontWeight": 400,
    "textAlignHorizontal": "CENTER",
    "singleLine": true,
    "widthConstrained": true
  }
}
```

> `widthConstrained=true`：内容宽 < 元素宽×0.9，消费侧用 `textAutoResize='HEIGHT'` 固定 56px 宽。

---

### 内容撑满的单行文本（商品标题）

```json
{
  "type": "text",
  "className": "product-title",
  "content": "2024新款连衣裙",
  "style": {
    "x": 0, "y": 0,
    "width": 120, "height": 20,
    "fontSize": 14,
    "color": "rgba(0,0,0,0.85)",
    "singleLine": true
  }
}
```

> `widthConstrained` 缺省（未写入），消费侧用 `textAutoResize='WIDTH_AND_HEIGHT'` 让 Figma 自动定宽，避免字体略宽时换行。

---

### 截断文本（ellipsis）

```json
{
  "type": "text",
  "className": "shop-name",
  "content": "超级长的店铺名称会被截断显示",
  "style": {
    "x": 0, "y": 0,
    "width": 100, "height": 20,
    "fontSize": 12,
    "color": "rgba(0,0,0,0.65)",
    "singleLine": true,
    "widthConstrained": true,
    "textOverflow": "ellipsis"
  }
}
```

> `textOverflow='ellipsis'` + `widthConstrained=true`，消费侧设 `textTruncation='ENDING'`。

---

### 多行文本（商品描述）

```json
{
  "type": "text",
  "className": "product-desc",
  "content": "这是一段很长的商品描述文字，会自动换行显示多行内容。",
  "style": {
    "x": 0, "y": 0,
    "width": 200, "height": 60,
    "fontSize": 13,
    "color": "rgba(0,0,0,0.65)",
    "singleLine": false,
    "lineHeight": 20
  }
}
```

> `singleLine=false`，消费侧用 `textAutoResize='HEIGHT'`，固定宽度，高度自动撑开。

---

### 绝对定位 flex 居中文本（antd Pagination •••）

```json
{
  "type": "text",
  "className": "ant-pagination-item-ellipsis",
  "content": "•••",
  "style": {
    "x": 0, "y": 0,
    "width": 32, "height": 32,
    "fontSize": 14,
    "color": "rgba(0,0,0,0.25)",
    "fontFamily": "Noto Sans",
    "textAlignHorizontal": "CENTER",
    "textAlignVertical": "CENTER",
    "positionType": "absolute",
    "singleLine": true,
    "widthConstrained": true
  }
}
```

> `positionType='absolute'` + `textAlignVertical='CENTER'` + `height(32) > fontSize×2(28)` → 消费侧走 `isAbsoluteCenteredBox` 分支：先设 fontSize，再两步 resize（HEIGHT→NONE）固定 32×32 全盒，`textAlignVertical='CENTER'` 在全盒范围内生效。

---

### input 文本子节点

```json
{
  "type": "text",
  "className": "input-text",
  "content": "请输入店铺名称",
  "style": {
    "x": 11, "y": 0,
    "width": 178,
    "fontSize": 14,
    "color": "rgba(0,0,0,0.25)",
    "textAlignHorizontal": "LEFT",
    "textAlignVertical": "CENTER",
    "singleLine": true,
    "widthConstrained": true
  }
}
```

> `textAlignVertical='CENTER'` 但 `height` 未设置（或 ≈ lineHeight ≈ 20px），不满足 `height > fontSize×2`，**不走** `isAbsoluteCenteredBox`。

---

### 水平 Auto Layout 容器

```json
{
  "type": "frame",
  "className": "product-card",
  "style": {
    "x": 0, "y": 0,
    "width": 320, "height": 120,
    "layoutMode": "HORIZONTAL",
    "itemSpacing": 12,
    "paddingTop": 16, "paddingRight": 16,
    "paddingBottom": 16, "paddingLeft": 16,
    "primaryAxisAlignItems": "MIN",
    "counterAxisAlignItems": "CENTER",
    "fills": ["rgba(255,255,255,1)"],
    "borderRadius": 8,
    "clipsContent": false
  },
  "children": []
}
```

> `clipsContent=false` 对应 CSS `overflow:visible`；缺省则 Figma 默认裁剪。

---

### 绝对定位节点（悬浮徽标）

```json
{
  "type": "frame",
  "className": "badge",
  "style": {
    "x": 24, "y": -6,
    "width": 18, "height": 18,
    "positionType": "absolute",
    "fills": ["rgba(255,77,79,1)"],
    "borderRadius": 9
  }
}
```

> `positionType='absolute'`（CSS `position:fixed` 也输出为此值），消费侧设 `layoutPositioning='ABSOLUTE'`。

---

### 渐变填充

```json
{
  "type": "frame",
  "className": "gradient-banner",
  "style": {
    "width": 375, "height": 200,
    "fills": [
      {
        "type": "GRADIENT_LINEAR",
        "angle": 90,
        "gradientStops": [
          { "position": 0, "color": "rgba(255,107,53,1)" },
          { "position": 1, "color": "rgba(255,59,48,1)" }
        ]
      }
    ]
  }
}
```

---

### 图片节点

```json
{
  "type": "image",
  "className": "product-img",
  "style": {
    "x": 0, "y": 0,
    "width": 80, "height": 80,
    "borderRadius": 4,
    "fills": [
      {
        "type": "IMAGE",
        "content": "data:image/jpeg;base64,/9j/4AAQSkZJRgAB..."
      }
    ]
  }
}
```

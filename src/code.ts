import { parseJSON } from './parser';
import type { RootJSON, ComponentDefMap } from './types';
import { buildChildren } from './builders/index';
import { nodeToCss, nodeToCssObject } from './utils/nodeToCss';

/** Sync styles list: each item = { selectors, value: CSS props }. value 为空时可能带 debug 便于排查。 */
export type SyncStyleItem = {
  selectors: string[];
  value: Record<string, string>;
  /** 仅当 value 为空时附带：导入时的快照 vs 当前样式，便于排查为何未检测到变更 */
  debug?: { original: Record<string, string>; current: Record<string, string> };
};
export type SyncStyleList = SyncStyleItem[];

/** 1:1 可同步的 CSS 属性（字体、背景、边框、阴影、内间距等），不包含 width/height/gap 等需转换的布局属性 */
const SYNCABLE_CSS_KEYS = new Set([
  'opacity',
  'background',
  'border',
  'border-radius',
  'box-shadow',
  'padding',
  'font-size',
  'color',
  'font-family',
]);

/** 获取当前选中节点所在的根容器（Frame 或 Group），用于同步样式时遍历子节点 */
function getFocusedFrameOrGroup(): (FrameNode | GroupNode) | null {
  const sel = figma.currentPage.selection;
  if (sel.length === 0) return null;
  const node = sel[0];
  if (node.type === 'FRAME' || node.type === 'GROUP') return node as FrameNode | GroupNode;
  let n: BaseNode | null = node.parent;
  while (n && n.type !== 'DOCUMENT' && n.type !== 'PAGE') {
    if (n.type === 'FRAME' || n.type === 'GROUP') return n as FrameNode | GroupNode;
    n = n.parent;
  }
  return null;
}

function collectFocusedFrameSyncStyles(): SyncStyleList | null {
  const root = getFocusedFrameOrGroup();
  if (!root) return null;
  const list: SyncStyleList = [];
  function walk(n: SceneNode) {
    if ('getPluginData' in n && n.type !== 'DOCUMENT' && n.type !== 'PAGE') {
      const className = (n as BaseNode).getPluginData('className') as string | undefined;
      let selectors: string[] = [];
      const stored = (n as BaseNode).getPluginData('selectors');
      if (stored && typeof stored === 'string') {
        try {
          const parsed = JSON.parse(stored) as unknown;
          if (Array.isArray(parsed) && parsed.length > 0) selectors = parsed;
        } catch (_e) {}
      }
      if (selectors.length === 0 && className) selectors = ['.' + className];

      if (selectors.length > 0) {
        let originalStyle: Record<string, string> = {};
        const originalStr = (n as BaseNode).getPluginData('originalStyle');
        if (originalStr && typeof originalStr === 'string') {
          try {
            originalStyle = JSON.parse(originalStr) as Record<string, string>;
          } catch (_e) {}
        }

        try {
          const currentStyle = nodeToCssObject(n);
          const changedStyle: Record<string, string> = {};
          for (const key of Object.keys(currentStyle)) {
            if (!SYNCABLE_CSS_KEYS.has(key)) continue;
            if (currentStyle[key] !== originalStyle[key]) {
              changedStyle[key] = currentStyle[key];
            }
          }
          const item: SyncStyleItem = { selectors, value: changedStyle };
          if (Object.keys(changedStyle).length === 0) {
            item.debug = { original: originalStyle, current: currentStyle };
          }
          list.push(item);
        } catch (_e) {
          // skip node on error
        }
      }
    }
    if ('children' in n) {
      for (const c of (n as ChildrenMixin).children as SceneNode[]) walk(c);
    }
  }
  walk(root);
  return list.length > 0 ? list : null;
}

function collectClassNameCss(page: PageNode): { className: string; css: string }[] {
  const seen = new Set<string>();
  const result: { className: string; css: string }[] = [];
  function walk(n: BaseNode) {
    if ('getPluginData' in n) {
      const className = (n as BaseNode).getPluginData('className');
      if (className && n.type !== 'DOCUMENT' && n.type !== 'PAGE' && !seen.has(className)) {
        seen.add(className);
        try {
          result.push({ className, css: nodeToCss(n as SceneNode) });
        } catch (_e) {
          result.push({ className, css: '/* error reading node */' });
        }
      }
    }
    if ('children' in n) {
      for (const c of (n as ChildrenMixin).children) walk(c);
    }
  }
  for (const c of page.children) walk(c);
  return result;
}

figma.currentPage.setRelaunchData({ pasteAndGenerate: 'Paste JSON and generate' });

figma.showUI(__html__, {
  visible: true,
  width: 400,
  height: 420,
  themeColors: true,
});

function sendClassNames() {
  const list = collectClassNameCss(figma.currentPage);
  figma.ui.postMessage({ type: 'classNames', list });
}

figma.ui.onmessage = async (msg: { type: string; data?: string }) => {
  if (msg.type === 'getClassNames') {
    sendClassNames();
    return;
  }
  if (msg.type === 'getSyncStyles') {
    const list = collectFocusedFrameSyncStyles();
    figma.ui.postMessage({ type: 'syncStyles', list });
    return;
  }
  if (msg.type !== 'clipboard-data' || !msg.data) {
    return;
  }

  try {
    const root = parseJSON(msg.data);
    const errors: string[] = [];
    await generateFromJSON(root, errors);
    figma.ui.postMessage({
      type: 'done',
      message: errors.length > 0 ? 'Generation completed with errors.' : 'Generation complete!',
      errors: errors.length > 0 ? errors : undefined,
    });
    if (errors.length > 0) {
      figma.notify(`MyBricks: completed with ${errors.length} error(s). See plugin for details.`, { error: true });
    } else {
      figma.notify('MyBricks: generation complete!');
    }
  } catch (e: any) {
    const errorMsg = e?.message ?? String(e);
    figma.ui.postMessage({ type: 'error', error: errorMsg });
    figma.notify(`Error: ${errorMsg}`, { error: true });
  }
};

setTimeout(sendClassNames, 300);

async function generateFromJSON(root: RootJSON, errors: string[]): Promise<void> {
  const page = figma.currentPage;
  const defMap: ComponentDefMap = new Map();

  const componentDefs = root.page['component-def'];
  if (componentDefs && componentDefs.length > 0) {
    for (const def of componentDefs) {
      defMap.set(def.type, def);
    }
  }

  const defaultFont = root.page.defaultFont;
  if (root.page.content.length > 0) {
    await buildChildren(root.page.content, page, defMap, errors, defaultFont);
  }

  const allNodes = page.children;
  if (allNodes.length > 0) {
    figma.viewport.scrollAndZoomIntoView(allNodes);
    allNodes[0].setRelaunchData({ pasteAndGenerate: 'Paste JSON and generate' });
  }
}

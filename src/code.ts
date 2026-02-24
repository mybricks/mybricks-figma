import { parseJSON } from './parser';
import type { RootJSON, ComponentDefMap } from './types';
import { buildChildren } from './builders/index';
import { nodeToCss } from './utils/nodeToCss';

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
  if (msg.type !== 'clipboard-data' || !msg.data) {
    return;
  }

  try {
    const root = parseJSON(msg.data);
    await generateFromJSON(root);
    figma.ui.postMessage({ type: 'done', message: 'Generation complete!' });
    figma.notify('MyBricks: generation complete!');
  } catch (e: any) {
    const errorMsg = e?.message ?? String(e);
    figma.ui.postMessage({ type: 'error', error: errorMsg });
    figma.notify(`Error: ${errorMsg}`, { error: true });
  }
};

setTimeout(sendClassNames, 300);

async function generateFromJSON(root: RootJSON): Promise<void> {
  const page = figma.currentPage;
  const defMap: ComponentDefMap = new Map();

  const componentDefs = root.page['component-def'];
  if (componentDefs && componentDefs.length > 0) {
    for (const def of componentDefs) {
      defMap.set(def.type, def);
    }
  }

  if (root.page.content.length > 0) {
    await buildChildren(root.page.content, page, defMap);
  }

  const allNodes = page.children;
  if (allNodes.length > 0) {
    figma.viewport.scrollAndZoomIntoView(allNodes);
    allNodes[0].setRelaunchData({ pasteAndGenerate: 'Paste JSON and generate' });
  }
}

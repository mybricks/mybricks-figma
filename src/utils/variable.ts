/**
 * Figma Variable 工具：把 CSS selector 映射到 Figma COLOR 变量。
 *
 * 相同 selector 的节点绑定同一个变量，设计师改一处颜色即可联动所有同名规则节点，
 * 与 MyBricks 平台「CSS 规则共享」语义完全对齐。
 */

import { parseColorWithOpacity } from './color';

const COLLECTION_NAME = 'MyBricks Selectors';

/**
 * 把 CSS selector 规范化为 Figma Variable 名（Figma 以 "/" 作分组层级）。
 *   ".u_VP0kg .todoSection .todoHeader .todoTitle"
 *   → "u_VP0kg/todoSection/todoHeader/todoTitle"
 */
export function selectorToVarName(selector: string): string {
  return selector
    .split(/\s+/)
    .map((seg) => seg.replace(/^\./, ''))
    .filter(Boolean)
    .join('/');
}

/** 单次导入共享的状态，由 initVariableSession / resetVariableSession 管理 */
let _collection: VariableCollection | null = null;

/** selector-based var name → Variable，跨节点复用 */
let _varCache: Map<string, Variable> = new Map();

/**
 * 在导入开始前调用：预加载已有变量，初始化 collection 引用。
 * 必须在任何 getOrCreateColorVariable 调用之前 await 此函数。
 */
export async function initVariableSession(): Promise<void> {
  _varCache = new Map();
  _collection = null;

  // 找已有的同名 collection，不重复创建
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const found = collections.find((c) => c.name === COLLECTION_NAME);
  if (found) {
    _collection = found;
    // 预热缓存：把已有变量加进来，避免重复导入时重建
    const vars = await figma.variables.getLocalVariablesAsync('COLOR');
    for (const v of vars) {
      if (v.variableCollectionId === _collection.id) {
        _varCache.set(v.name, v);
      }
    }
  }
}

/** 导入结束后清理，防止下次导入复用上次的内存状态 */
export function resetVariableSession(): void {
  _varCache = new Map();
  _collection = null;
}

function getCollection(): VariableCollection {
  if (!_collection) {
    _collection = figma.variables.createVariableCollection(COLLECTION_NAME);
  }
  return _collection;
}

/**
 * 取或创建与 selector 对应的 COLOR 变量。
 * - 已存在同名变量：直接复用，不覆盖设计师已改的值（Figma 侧为 source of truth）。
 * - 首次创建：用 initialRgba 初始化颜色值。
 *
 * @param selector   CSS 选择器字符串，用于生成变量名
 * @param initialRgba 首次创建时的初始颜色（rgba 字符串），已有变量时忽略
 */
export function getOrCreateColorVariable(
  selector: string,
  initialRgba: string
): Variable {
  const varName = selectorToVarName(selector);

  // 1. 内存缓存命中
  const cached = _varCache.get(varName);
  if (cached) return cached;

  // 2. 创建新变量（initVariableSession 已预热，走到这里说明确实没有）
  const col = getCollection();
  const variable = figma.variables.createVariable(varName, col, 'COLOR');
  const modeId = col.modes[0].modeId;

  const { color, opacity } = parseColorWithOpacity(initialRgba);
  variable.setValueForMode(modeId, { r: color.r, g: color.g, b: color.b, a: opacity });

  _varCache.set(varName, variable);
  return variable;
}

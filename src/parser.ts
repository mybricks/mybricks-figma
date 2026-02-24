import type { RootJSON, NodeJSON, NodeType } from './types';

const VALID_NODE_TYPES: NodeType[] = [
  'frame', 'group', 'text', 'image', 'rectangle',
  'ellipse', 'line', 'vector', 'component',
];

export function parseJSON(raw: string): RootJSON {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (_e) {
    throw new Error('Invalid JSON: failed to parse input');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid JSON: root must be an object');
  }

  const root = parsed as Record<string, unknown>;

  if (!root.page || typeof root.page !== 'object') {
    throw new Error('Invalid JSON: missing "page" object');
  }

  const page = root.page as Record<string, unknown>;

  if (!Array.isArray(page.content)) {
    throw new Error('Invalid JSON: page.content must be an array');
  }

  if (page['component-def'] !== undefined && !Array.isArray(page['component-def'])) {
    throw new Error('Invalid JSON: page.component-def must be an array if present');
  }

  validateNodeArray(page.content as unknown[], 'page.content');

  if (Array.isArray(page['component-def'])) {
    for (let i = 0; i < page['component-def'].length; i++) {
      const def = page['component-def'][i] as Record<string, unknown>;
      if (!def.type || typeof def.type !== 'string') {
        throw new Error(`Invalid component-def[${i}]: missing "type" string`);
      }
    }
  }

  return parsed as RootJSON;
}

function validateNodeArray(nodes: unknown[], path: string): void {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (!node || typeof node !== 'object') {
      throw new Error(`Invalid node at ${path}[${i}]: must be an object`);
    }

    const n = node as Record<string, unknown>;
    if (!n.type || typeof n.type !== 'string') {
      throw new Error(`Invalid node at ${path}[${i}]: missing "type" string`);
    }

    if (!VALID_NODE_TYPES.includes(n.type as NodeType)) {
      throw new Error(`Invalid node at ${path}[${i}]: unknown type "${n.type}"`);
    }

    if (n.type === 'text' && (n.content === undefined || typeof n.content !== 'string')) {
      throw new Error(`Invalid node at ${path}[${i}]: text node requires "content" string`);
    }

    if (n.type === 'image' && (n.content === undefined || typeof n.content !== 'string')) {
      throw new Error(`Invalid node at ${path}[${i}]: image node requires "content" URL string`);
    }

    if (n.type === 'component' && (n.ref === undefined || typeof n.ref !== 'string')) {
      throw new Error(`Invalid node at ${path}[${i}]: component reference requires "ref" string`);
    }

    if (Array.isArray(n.children)) {
      validateNodeArray(n.children as unknown[], `${path}[${i}].children`);
    }
  }
}

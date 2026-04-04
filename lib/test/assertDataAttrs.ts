import { expect } from 'vitest';

const SKIPPED_TAGS = new Set([
  'style', 'script', 'svg', 'path', 'circle', 'line', 'polygon', 'polyline', 'rect',
  'ellipse', 'g', 'defs', 'use', 'clippath', 'mask', 'pattern', 'gradient',
  'lineargradient', 'radialgradient', 'stop', 'symbol', 'textpath', 'tspan',
  'animate', 'animatetransform', 'set', 'fegaussianblur', 'fecolormatrix',
  'filter', 'foreignobject', 'image', 'marker', 'title', 'desc',
]);

function isInsideSvg(el: HTMLElement): boolean {
  let node: HTMLElement | null = el;
  while (node) {
    if (node.tagName === 'svg') return true;
    node = node.parentElement;
  }
  return false;
}

function isDecorativeIcon(el: HTMLElement): boolean {
  if (el.tagName !== 'svg') return false;
  return el.getAttribute('aria-hidden') === 'true' || el.classList.contains('lucide');
}

function hasSemanticDataAttr(el: HTMLElement): boolean {
  const attrs = el.attributes;
  for (let i = 0; i < attrs.length; i++) {
    const name = attrs[i].name;
    if (name.startsWith('data-') && name !== 'data-testid') {
      return true;
    }
  }
  return false;
}

export function findAllElementsWithoutDataAttr(container: HTMLElement): HTMLElement[] {
  const all = container.querySelectorAll('*');
  const missing: HTMLElement[] = [];

  all.forEach((node) => {
    const el = node as HTMLElement;
    const tag = el.tagName;

    if (SKIPPED_TAGS.has(tag)) return;
    if (isInsideSvg(el)) return;
    if (isDecorativeIcon(el)) return;
    if (hasSemanticDataAttr(el)) return;

    missing.push(el);
  });

  return missing;
}

export function findDuplicateDataAttrValues(container: HTMLElement): Map<string, string[]> {
  const children = Array.from(container.children) as HTMLElement[];
  const valueToTags = new Map<string, string[]>();

  for (const child of children) {
    const attrs = child.attributes;
    for (let i = 0; i < attrs.length; i++) {
      const name = attrs[i].name;
      if (!name.startsWith('data-') || name === 'data-testid') continue;

      const value = attrs[i].value;
      if (!value) continue;

      const existing = valueToTags.get(value);
      if (existing) {
        if (!existing.includes(child.tagName.toLowerCase())) {
          existing.push(child.tagName.toLowerCase());
        }
      } else {
        valueToTags.set(value, [child.tagName.toLowerCase()]);
      }
    }
  }

  const duplicates = new Map<string, string[]>();
  for (const [value, tags] of valueToTags) {
    if (tags.length > 1) {
      duplicates.set(value, tags);
    }
  }

  return duplicates;
}

function describeElement(el: HTMLElement): string {
  const tag = el.tagName.toLowerCase();
  const attrs = Array.from(el.attributes)
    .map((a) => `${a.name}="${a.value}"`)
    .join(' ');
  const text = el.textContent?.slice(0, 40).trim();
  const textSnippet = text ? ` text="${text}"` : '';
  return `<${tag} ${attrs}>${textSnippet}`;
}

export function expectAllElementsHaveDataAttr(container: HTMLElement): void {
  const missing = findAllElementsWithoutDataAttr(container);

  if (missing.length > 0) {
    const list = missing.map((el, i) => `  ${i + 1}. ${describeElement(el)}`).join('\n');
    expect.fail(
      `Found ${missing.length} element(s) without a semantic data-* attribute (data-testid is excluded):\n${list}`,
    );
  }
}

export function expectNoDuplicateDataAttrValues(container: HTMLElement): void {
  const duplicates = findDuplicateDataAttrValues(container);

  if (duplicates.size > 0) {
    const lines = Array.from(duplicates.entries())
      .map(([value, tags]) => `  value="${value}" used by: ${tags.join(', ')}`)
      .join('\n');
    expect.fail(
      `Found duplicate data-* attribute values among siblings:\n${lines}`,
    );
  }
}

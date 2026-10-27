/**
 * Test id of an inner element, derived from its component's root test id.
 * A unique root id keeps every inner id unique across the backoffice; without
 * a root id nothing is rendered, so existing callers keep their markup.
 */
export function childTestId(root: string | undefined, part: string): string | undefined {
  return root ? `${root}-${part}` : undefined;
}

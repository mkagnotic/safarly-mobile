export function formatRoute(route: string): string {
  return route.replaceAll("\u002d\u003e", "→");
}

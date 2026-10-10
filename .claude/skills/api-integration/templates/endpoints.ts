// One map of API paths — never inline URLs in hooks.
export const ENDPOINTS = {
  items: 'items',
  item: (id: string) => `items/${id}`,
} as const

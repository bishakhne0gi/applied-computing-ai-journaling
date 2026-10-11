// Separate from the component so fast refresh keeps working on AnimatedTabs.tsx.
export const tabId = (prefix: string, id: string) => `${prefix}-tab-${id}`
export const panelId = (prefix: string, id: string) => `${prefix}-panel-${id}`

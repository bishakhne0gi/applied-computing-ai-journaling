// Entity types live in src/types/ so hooks never import from features/. Rename to the real entity.
export interface Item {
  id: string
  title: string
}

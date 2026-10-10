import { useQuery } from '@tanstack/react-query'
import type { Item } from '@/types/item'
import { client } from '@/utils/client'
import { ENDPOINTS } from '@/utils/endpoints'
import { itemKeys } from './itemKeys'

// The hook IS the interface: features call this, never the client.
export function useGetItemsQuery() {
  return useQuery({ queryKey: itemKeys.all, queryFn: () => client.get(ENDPOINTS.items).json<Item[]>() })
}

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { itemKeys } from '@/hooks/queries/itemKeys'
import type { Item } from '@/types/item'
import { client } from '@/utils/client'
import { ENDPOINTS } from '@/utils/endpoints'

// Optimistic update with rollback; the server stays the source of truth (invalidate on settle).
export function useUpdateItemMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (item: Item) => client.patch(ENDPOINTS.item(item.id), { json: item }).json<Item>(),
    onMutate: async (item: Item) => {
      await queryClient.cancelQueries({ queryKey: itemKeys.all })
      const previous = queryClient.getQueryData<Item[]>(itemKeys.all)
      queryClient.setQueryData<Item[]>(itemKeys.all, (old = []) => old.map((i) => (i.id === item.id ? item : i)))
      return { previous }
    },
    onError: (_error, _item, context) => queryClient.setQueryData(itemKeys.all, context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: itemKeys.all }),
  })
}

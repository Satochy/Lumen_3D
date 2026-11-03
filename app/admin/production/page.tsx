import { requireAdmin } from '@/lib/auth'
import { getPendingProductionItems } from '@/app/actions/production_actions'
import Production_Queue_Client from '@/components/admin/Production_Queue_Client'

export default async function AdminProductionPage() {
  await requireAdmin()

  const result = await getPendingProductionItems()
  const items = result.success && result.data ? result.data : []

  return <Production_Queue_Client initialItems={items} />
}

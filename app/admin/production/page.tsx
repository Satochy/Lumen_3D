import { requireAdmin } from '@/lib/auth'
import { getPendingProductionItems } from '@/app/actions/production_actions'
import Production_Queue_Client from '@/components/admin/Production_Queue_Client'

interface AdminProductionPageProps {
  searchParams?: Promise<{ search?: string }>
}

export default async function AdminProductionPage(props: AdminProductionPageProps) {
  await requireAdmin()

  const searchParams = props.searchParams ? await props.searchParams : undefined
  const initialSearch = typeof searchParams?.search === 'string' ? searchParams.search : ''

  const result = await getPendingProductionItems()
  const items = result.success && result.data ? result.data : []

  return <Production_Queue_Client initialItems={items} initialSearch={initialSearch} />
}

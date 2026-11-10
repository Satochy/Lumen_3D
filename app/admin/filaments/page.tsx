import { requireAdmin } from '@/lib/auth'
import { getFilaments } from '@/app/actions/filaments'
import Filaments_Client, {
  type SerializedFilament,
} from '@/components/admin/Filaments_Client'

export default async function FilamentsPage() {
  await requireAdmin()

  const result = await getFilaments()
  const rawFilaments = result.success && result.data ? result.data : []

  const serializedFilaments: SerializedFilament[] = rawFilaments.map((f) => ({
    id: f.id,
    material: f.material,
    color: f.color,
    hexColor: f.hexColor,
    spoolWeightKg: f.spoolWeightKg,
    remainingGrams: f.remainingGrams,
    minThresholdGrams: f.minThresholdGrams,
    createdAt: f.createdAt.toISOString(),
  }))

  return <Filaments_Client initialFilaments={serializedFilaments} />
}

import { Suspense } from 'react'
import Auth_Card from '@/components/auth/Auth_Card'

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050811]" />}>
      <Auth_Card initialMode="register" />
    </Suspense>
  )
}

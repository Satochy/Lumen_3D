import { Suspense } from 'react'
import Auth_Card from '@/components/auth/Auth_Card'

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050811]" />}>
      <Auth_Card initialMode="login" />
    </Suspense>
  )
}

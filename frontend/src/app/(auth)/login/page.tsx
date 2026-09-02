'use client'
// Login/registration removed — this is now a guest-only public demo.
// Anyone who lands here is sent straight into the app.
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RemovedAuthPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/dashboard') }, [router])
  return null
}

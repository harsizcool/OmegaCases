"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function PlusDocsRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace("/developer/docs") }, [router])
  return null
}

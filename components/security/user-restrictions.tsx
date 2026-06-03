"use client"

import { useEffect } from "react"
import useSWR from "swr"
import { toast } from "sonner"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function UserRestrictions() {
  const { data } = useSWR<{ user: { role: "admin" | "user" } }>(
    "/api/auth/me",
    fetcher
  )
  const restricted = data?.user?.role === "user"

  useEffect(() => {
    if (!restricted) return

    function block(e: Event) {
      e.preventDefault()
      toast.error("This action is restricted for user accounts.")
    }

    function onKeyDown(e: KeyboardEvent) {
      const key = e.key.toLowerCase()
      const blocked =
        key === "printscreen" ||
        ((e.ctrlKey || e.metaKey) && ["p", "s", "c"].includes(key))
      if (!blocked) return
      e.preventDefault()
      toast.error("This action is restricted for user accounts.")
    }

    document.addEventListener("contextmenu", block)
    document.addEventListener("copy", block)
    document.addEventListener("cut", block)
    window.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("contextmenu", block)
      document.removeEventListener("copy", block)
      document.removeEventListener("cut", block)
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [restricted])

  return null
}

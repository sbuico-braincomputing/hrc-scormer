"use client"

import { ToastProvider } from "@/components/ui/global-toast"

export default function Providers({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>
}

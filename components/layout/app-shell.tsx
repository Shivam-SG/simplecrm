import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AppSidebar } from "./sidebar"
import { Header } from "./header"
import { UserRestrictions } from "@/components/security/user-restrictions"

export function AppShell({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <TooltipProvider delayDuration={0}>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="min-w-0 overflow-x-hidden">
          <Header title={title} />
          <UserRestrictions />
          <div className="min-w-0 overflow-x-hidden p-4 md:p-6">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}

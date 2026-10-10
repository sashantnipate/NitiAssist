"use client"

import { Landmark, LibraryBig, SquarePen } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { Conversations } from "@/features/side-layout/components/Conversations"
import { Logo } from "@/components/Logo"
import Link from "next/link"
import { usePathname } from "next/navigation"

export function AppSidebar() {
  const { state, setOpen } = useSidebar()
  const pathname = usePathname()

  if (pathname === "/user-onboard" || pathname === "/user-onboarding") {
    return null
  }

  return (
    <>
      {state === "expanded" && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-30 hidden bg-black/20 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      {state === "collapsed" && (
        <div className="fixed top-4 left-4 z-50 md:hidden">
          <SidebarTrigger />
        </div>
      )}
      <div className="fixed inset-y-0 left-0 z-40 hidden has-[aside[data-state=expanded]]:block md:static md:z-auto md:block">
        <Sidebar
          onClick={(event) => {
            const target = event.target as HTMLElement

            if (
              window.matchMedia("(max-width: 767px)").matches &&
              target.closest("a, button")
            ) {
              setOpen(false)
            }
          }}
        >
          <SidebarHeader className="border-b-0">
            {state === "collapsed" ? (
              <div className="relative flex size-8 shrink-0 items-center justify-center">
                <Logo
                  variant="icon"
                  className="size-7 shrink-0 transition-opacity group-focus-within/sidebar:opacity-0 group-hover/sidebar:opacity-0"
                />
              </div>
            ) : (
              <Link
                href="/"
                className="flex min-w-0 items-center overflow-hidden py-1"
                aria-label="NitiAssist home"
              >
                <Logo
                  variant="full"
                  className="h-8 w-auto max-w-[170px]"
                  priority
                />
              </Link>
            )}
            <SidebarTrigger
              className={
                state === "collapsed"
                  ? "absolute top-3 left-3 z-10 opacity-0 transition-opacity group-focus-within/sidebar:opacity-100 group-hover/sidebar:opacity-100"
                  : undefined
              }
            />
          </SidebarHeader>

          <SidebarContent className="overflow-hidden">
            <SidebarMenu className="shrink-0">
              <SidebarMenuItem>
                <SidebarMenuButton
                  type="button"
                  tooltip="New chat"
                  aria-label="New chat"
                  render={<Link href={`/`} />}
                >
                  <SquarePen />
                  <span
                    className={state === "collapsed" ? "sr-only" : undefined}
                  >
                    New chat
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Schemes"
                  aria-label="Schemes"
                  render={<Link href="/dashboard" />}
                >
                  <Landmark />
                  <span
                    className={state === "collapsed" ? "sr-only" : undefined}
                  >
                    Schemes
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  type="button"
                  tooltip="Library"
                  aria-label="Library"
                  render={<Link href="/library" />}
                >
                  <LibraryBig />
                  <span
                    className={state === "collapsed" ? "sr-only" : undefined}
                  >
                    Library
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
            <Conversations />
          </SidebarContent>
        </Sidebar>
      </div>
    </>
  )
}

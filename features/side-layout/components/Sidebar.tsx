"use client"

import { SquarePen } from "lucide-react"

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
import Link from "next/link"

export function AppSidebar() {
  const { state, setOpen } = useSidebar()

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
          <SidebarHeader>
            <span
              className={
                state === "collapsed"
                  ? "sr-only"
                  : "truncate text-sm font-semibold"
              }
            >
              NitiAssist
            </span>
            <SidebarTrigger />
          </SidebarHeader>

          <SidebarContent>
            <SidebarMenu>
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
                <Conversations />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>
      </div>
    </>
  )
}

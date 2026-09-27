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
  const { state } = useSidebar()

  return (
    <Sidebar>
      <SidebarHeader>
        <span
          className={
            state === "collapsed" ? "sr-only" : "truncate text-sm font-semibold"
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
              <span className={state === "collapsed" ? "sr-only" : undefined}>
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
  )
}

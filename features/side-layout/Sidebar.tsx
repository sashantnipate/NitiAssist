"use client"

import { MessageCircle, SquarePen } from "lucide-react"

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

export function AppSidebar() {
  const { state } = useSidebar()

  return (
    <Sidebar className="bg-white">
      <SidebarHeader>
        <span
          className={state === "collapsed" ? "sr-only" : "truncate text-sm font-semibold"}
        >
          NitiAssist
        </span>
        <SidebarTrigger />
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton type="button" tooltip="New chat" aria-label="New chat">
              <SquarePen />
              <span className={state === "collapsed" ? "sr-only" : undefined}>New chat</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton type="button" tooltip="Messages" aria-label="Messages">
              <MessageCircle />
              <span className={state === "collapsed" ? "sr-only" : undefined}>Messages</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  )
}

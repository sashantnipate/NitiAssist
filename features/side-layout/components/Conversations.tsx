"use client"

import Link from "next/link"
import { MessageCircle } from "lucide-react"

import { useConversations } from "@/hooks/useConversation"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useSidebar } from "@/components/ui/sidebar"

export function Conversations() {
  const { state } = useSidebar()
  const conversations = useConversations()

  const conversationItems = conversations ?? []

  if (state === "collapsed") {
    return (
      <Popover>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              aria-label="Recent conversations"
            />
          }
        >
          <MessageCircle />
        </PopoverTrigger>
        <PopoverContent side="right" align="start" sideOffset={8}>
          <PopoverHeader className="px-1">
            <PopoverTitle>Recent conversations</PopoverTitle>
          </PopoverHeader>
          <ConversationList conversations={conversationItems} scrollable />
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <div className="flex flex-col gap-1 px-2 pt-3">
      <p className="px-1 text-xs font-medium text-muted-foreground">
        Recent conversations
      </p>
      <ConversationList conversations={conversationItems} />
    </div>
  )
}

function ConversationList({
  conversations,
  scrollable = false,
}: {
  conversations: Array<{ _id: string; title: string }>
  scrollable?: boolean
}) {
  if (conversations.length === 0) {
    return (
      <p className="px-2 py-1.5 text-sm text-muted-foreground">
        No conversations yet.
      </p>
    )
  }

  return (
    <div
      className={
        scrollable
          ? "flex max-h-60 flex-col gap-1 overflow-y-auto pr-1"
          : "flex flex-col gap-1"
      }
    >
      {conversations.map((conversation) => (
        <Button
          key={conversation._id}
          type="button"
          variant="ghost"
          render={<Link href={`/${conversation._id}`} />}
          className="h-auto min-h-8 w-full justify-start px-2 py-1.5 text-left font-normal whitespace-normal"
        >
          {conversation.title}
        </Button>
      ))}
    </div>
  )
}

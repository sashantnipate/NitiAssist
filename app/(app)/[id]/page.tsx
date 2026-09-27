"use client"

import type { Id } from "@/convex/_generated/dataModel"
import { Chat } from "@/features/chat/components/Chat"
import { useParams } from "next/navigation"

const Page = () => {
  const params = useParams<{ id: string }>()

  return <Chat conversationId={params.id as Id<"conversations">} />
}

export default Page

"use client"

import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input"
import { useState } from "react"

type ChatPromptProps = {
  disabled?: boolean
  onSubmit: (text: string) => void | Promise<void>
}

export function ChatPrompt({ disabled = false, onSubmit }: ChatPromptProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async ({ text }: { text: string }) => {
    const value = text.trim()

    if (!value || disabled || isSubmitting) {
      return
    }

    setIsSubmitting(true)

    try {
      await onSubmit(value)
    } finally {
      setIsSubmitting(false)
    }
  }

  const status = isSubmitting ? "submitted" : undefined

  return (
    <PromptInput
      aria-label="Send a message"
      className="w-full text-base"
      onSubmit={handleSubmit}
    >
      <PromptInputBody>
        <PromptInputTextarea
          className="min-h-16 text-base"
          disabled={disabled || isSubmitting}
        />
      </PromptInputBody>
      <PromptInputFooter className="justify-end">
        <PromptInputSubmit
          className="size-9 [&>svg]:size-5"
          disabled={disabled || isSubmitting}
          status={status}
        />
      </PromptInputFooter>
    </PromptInput>
  )
}

"use client"

import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input"
import { Button } from "@/components/ui/button"
import { Square } from "lucide-react"
import { useEffect, useState } from "react"

type ChatPromptProps = {
  disabled?: boolean
  isRunning?: boolean
  onCancel?: () => void | Promise<void>
  onSubmit: (text: string) => void | Promise<void>
}

export function ChatPrompt({
  disabled = false,
  isRunning = false,
  onCancel,
  onSubmit,
}: ChatPromptProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [value, setValue] = useState("")

  const handleSubmit = async ({ text }: { text: string }) => {
    const value = text.trim()

    if (!value || disabled || isBusy || isCancelling) {
      return
    }

    setIsSubmitting(true)

    try {
      await onSubmit(value)
      setValue("")
    } finally {
      setIsSubmitting(false)
    }
  }

  const isBusy = isRunning || isSubmitting

  useEffect(() => {
    if (!isBusy) {
      setIsCancelling(false)
    }
  }, [isBusy])

  const handleCancel = async () => {
    if (!onCancel || isCancelling) {
      return
    }

    setIsCancelling(true)

    try {
      await onCancel()
    } catch {
      setIsCancelling(false)
    }
  }

  return (
    <PromptInput
      aria-label="Send a message"
      className="w-full text-base"
      onSubmit={handleSubmit}
    >
      <PromptInputBody>
        <PromptInputTextarea
          className="!min-h-12 max-h-32 text-base"
          onChange={(event) => setValue(event.target.value)}
          value={value}
        />
      </PromptInputBody>
      <PromptInputFooter className="justify-end">
        {isBusy ? (
          <Button
            aria-label="Stop"
            className="size-9 [&>svg]:size-5"
            disabled={disabled || !onCancel || isCancelling}
            onClick={() => void handleCancel()}
            size="icon"
            type="button"
            title="Stop generating"
          >
            <Square className="size-5" />
          </Button>
        ) : (
          <PromptInputSubmit
            aria-label="Submit prompt"
            className="size-9 [&>svg]:size-5"
            disabled={disabled || !value.trim()}
            title="Submit prompt"
          />
        )}
      </PromptInputFooter>
    </PromptInput>
  )
}

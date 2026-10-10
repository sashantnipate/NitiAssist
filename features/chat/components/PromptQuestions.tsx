"use client"

import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Check, CircleHelp } from "lucide-react"
import { useEffect, useState } from "react"

export type PromptQuestion = {
  id: string
  type: "yes-no" | "single-choice" | "text"
  question: string
  options?: string[]
}

type PromptQuestionsProps = {
  questions: PromptQuestion[]
  disabled?: boolean
  onUseAnswers: (answers: Array<{ question: string; answer: string }>) => void
}

export function PromptQuestions({
  questions,
  disabled = false,
  onUseAnswers,
}: PromptQuestionsProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const questionKey = questions.map(({ id, question }) => `${id}:${question}`).join("|")

  useEffect(() => {
    setAnswers({})
  }, [questionKey])

  if (questions.length === 0) return null

  const answeredCount = questions.filter((question) => answers[question.id]?.trim()).length
  const submitAnswers = (target: HTMLElement) => {
    const answeredQuestions = questions
      .filter((question) => answers[question.id]?.trim())
      .map((question) => ({
        question: question.question,
        answer: answers[question.id].trim(),
      }))

    if (answeredQuestions.length === 0) return

    onUseAnswers(answeredQuestions)
    window.requestAnimationFrame(() => {
      target.closest("form")?.requestSubmit()
    })
  }

  return (
    <section
      aria-label="Assistant follow-up questions"
      className="mb-2 max-h-64 w-full space-y-3 overflow-y-auto rounded-xl border bg-muted/40 p-3"
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <CircleHelp aria-hidden="true" className="size-4 text-primary" />
        A few details will help me answer
      </div>

      <div className="space-y-3">
        {questions.map((question, index) => {
          return (
            <fieldset className="min-w-0 space-y-2" key={question.id}>
              <legend className="text-sm">
                <span className="mr-1 text-muted-foreground">{index + 1}.</span>
                {question.question}
              </legend>
              {question.type === "text" ? (
                <Input
                  aria-label={question.question}
                  disabled={disabled}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" || event.nativeEvent.isComposing) return
                    event.preventDefault()
                    submitAnswers(event.currentTarget)
                  }}
                  onChange={(event) =>
                    setAnswers((current) => ({ ...current, [question.id]: event.target.value }))
                  }
                  placeholder="Type your answer"
                  value={answers[question.id] ?? ""}
                />
              ) : (
                <Suggestions className="flex-wrap">
                  {(question.type === "yes-no" ? ["Yes", "No"] : question.options ?? []).map((option) => (
                    <Suggestion
                      aria-pressed={answers[question.id] === option}
                      disabled={disabled}
                      key={option}
                      onClick={() =>
                        setAnswers((current) => ({ ...current, [question.id]: option }))
                      }
                      suggestion={option}
                      variant={answers[question.id] === option ? "default" : "outline"}
                    />
                  ))}
                </Suggestions>
              )}
            </fieldset>
          )
        })}
      </div>

      <div className="flex items-center justify-between gap-3">
        <span aria-live="polite" className="text-xs text-muted-foreground">
          {answeredCount} of {questions.length} answered
        </span>
        <Button
          disabled={disabled || answeredCount === 0}
          onClick={(event) => submitAnswers(event.currentTarget)}
          size="sm"
          type="button"
          variant="secondary"
        >
          <Check aria-hidden="true" className="size-4" />
          Add answers &amp; send
        </Button>
      </div>
    </section>
  )
}

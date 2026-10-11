import type { PromptQuestion } from "./components/PromptQuestions"

function getClarifyingQuestionHeaderIndex(lines: string[]) {
  return lines.findIndex((line) =>
    /(?:specifically.*following|information regarding the following|following details|could you please let me know)\s*:?$/i.test(line)
  )
}

function getInlineClarifyingQuestions(content: string): PromptQuestion[] {
  const clarification = content.match(
    /(?:please share|please provide|i need to know|i need information regarding)\s+(.+?)(?:[.!?]|$)/i
  )
  if (!clarification) return []

  const clauses = clarification[1]
    .split(/,\s*(?:and\s+)?(?=(?:your|the|whether|what|which|where|how)\b)|\s+and\s+(?=(?:your|the|whether|what|which|where|how)\b)/i)
    .map((clause) => clause.trim())
    .filter(Boolean)
    .slice(0, 2)

  return clauses.map((clause, index): PromptQuestion => {
    if (/scholarships?|grants?|loans?/i.test(clause)) {
      return {
        id: `legacy-clarification-${index + 1}`,
        type: "single-choice",
        question: "What type of financial assistance are you looking for?",
        options: ["Scholarships", "Grants", "Loans"],
      }
    }

    const detail = clause.replace(/^(your|the)\s+/i, "").replace(/[.!?]+$/, "")
    const question = /location|country|city|state/i.test(detail)
      ? "Where are you located?"
      : /education level|undergraduate|graduate|student/i.test(detail)
        ? "What is your current education level?"
        : /field|program|course|subject|study/i.test(detail)
          ? "What field or program do you plan to study?"
          : `Please share ${detail}.`

    return {
      id: `legacy-clarification-${index + 1}`,
      type: "text",
      question,
    }
  })
}

export function getLegacyClarifyingQuestions(content: string): PromptQuestion[] {
  const lines = content.split(/\r?\n/).map((line) => line.trim())
  const headerIndex = getClarifyingQuestionHeaderIndex(lines)
  if (headerIndex < 0) return getInlineClarifyingQuestions(content)

  const candidates: string[] = []
  for (const line of lines.slice(headerIndex + 1)) {
    if (!line) continue
    if (/^(once|when you|after you|with this information)\b/i.test(line)) break

    const question = line.replace(/^(?:[-*•]|\d+[.)])\s*/, "").trim()
    if (question.length >= 12) candidates.push(question)
    if (candidates.length === 2) break
  }

  return candidates.map((question, index): PromptQuestion => ({
    id: `legacy-clarification-${index + 1}`,
    type: "text",
    question,
  }))
}

export function getSavedClarifyingQuestions(content: string): PromptQuestion[] {
  const lines = content.split(/\r?\n/).map((line) => line.trim())
  const currentHeaderIndex = lines.findIndex((line) =>
    /^to help me find the right options, please answer:\s*$/i.test(line)
  )
  const headerIndex = currentHeaderIndex >= 0
    ? currentHeaderIndex
    : getClarifyingQuestionHeaderIndex(lines)
  if (headerIndex < 0) return getInlineClarifyingQuestions(content)

  const questions: PromptQuestion[] = []
  for (const line of lines.slice(headerIndex + 1)) {
    if (/^(once|when you|after you|with this information)\b/i.test(line)) break

    const question = line.replace(/^(?:[-*•]|\d+[.)])\s*/, "").trim()
    if (!question || question.length < 12) continue

    questions.push({
      id: `saved-clarification-${questions.length + 1}`,
      type: "text",
      question,
    })
    if (questions.length === 2) break
  }

  return questions
}

export function hideLegacyClarifyingQuestions(content: string) {
  const lines = content.split(/\r?\n/).map((line) => line.trim())
  const headerIndex = getClarifyingQuestionHeaderIndex(lines)
  if (headerIndex < 0) {
    return getInlineClarifyingQuestions(content).length > 0
      ? "A few details will help me find the right options for you."
      : content
  }

  return lines.slice(0, headerIndex).join("\n").trim() ||
    "A few details will help me find the right options for you."
}

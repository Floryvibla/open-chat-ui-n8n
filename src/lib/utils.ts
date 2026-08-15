import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function safeJsonParse<T = unknown>(text: string | undefined | null): T | null {
  if (!text) return null
  try {
    return JSON.parse(text) as T
  } catch {
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1].trim()) as T
      } catch {
        // ignore
      }
    }
    const firstObject = findFirstJson(text)
    if (firstObject) {
      try {
        return JSON.parse(firstObject) as T
      } catch {
        // ignore
      }
    }
    return null
  }
}

function findFirstJson(text: string): string | null {
  let start = -1
  let end = -1
  let depth = 0
  let inString = false
  let escape = false
  const openChar = text.search(/[{[]/)
  if (openChar === -1) return null
  const openBrace = text[openChar]
  const closeBrace = openBrace === "{" ? "}" : "]"
  for (let i = openChar; i < text.length; i++) {
    const ch = text[i]
    if (escape) {
      escape = false
      continue
    }
    if (ch === "\\") {
      escape = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (ch === openBrace) {
      if (depth === 0) start = i
      depth++
    } else if (ch === closeBrace) {
      depth--
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  if (start !== -1 && end !== -1) {
    return text.slice(start, end + 1)
  }
  return null
}

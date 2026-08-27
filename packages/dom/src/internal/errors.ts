export type DOMErrorName =
  | "HierarchyRequestError"
  | "IndexSizeError"
  | "InvalidCharacterError"
  | "InvalidStateError"
  | "NotFoundError"
  | "NotSupportedError"
  | "SyntaxError"

export function domError(name: DOMErrorName, message: string): Error {
  const error = new Error(message)
  error.name = name
  return error
}

export function notSupported(message: string): Error {
  const error = new Error(message)
  error.name = "NotSupportedError"
  return error
}

export function invalidState(message: string): Error {
  const error = new Error(message)
  error.name = "InvalidStateError"
  return error
}

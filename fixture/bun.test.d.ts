declare module "bun:test" {
  interface Matchers<T> {
    /** Проверяет, что строка соответствует ожидаемой строке, игнорируя пробельные символы. */
    toMatchStringHTML(expected: string): any
  }
}

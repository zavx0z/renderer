export type WebRealmPlatformHost = object

export interface WebRealmURLSearchParamsIterator<T>
  extends IteratorObject<T, BuiltinIteratorReturn, unknown> {
  [Symbol.iterator](): WebRealmURLSearchParamsIterator<T>
}

export interface WebRealmURLSearchParams extends Iterable<[string, string]> {
  [Symbol.iterator](): WebRealmURLSearchParamsIterator<[string, string]>
  readonly size: number
  append(name: string, value: string): void
  delete(name: string, value?: string): void
  entries(): WebRealmURLSearchParamsIterator<[string, string]>
  forEach(
    callback: (value: string, key: string, parent: WebRealmURLSearchParams) => void,
    thisArg?: unknown,
  ): void
  get(name: string): string | null
  getAll(name: string): string[]
  has(name: string, value?: string): boolean
  keys(): WebRealmURLSearchParamsIterator<string>
  set(name: string, value: string): void
  sort(): void
  toJSON(): Record<string, string>
  toString(): string
  values(): WebRealmURLSearchParamsIterator<string>
}

export interface WebRealmURL {
  hash: string
  host: string
  hostname: string
  href: string
  password: string
  pathname: string
  port: string
  protocol: string
  search: string
  readonly searchParams: WebRealmURLSearchParams
  username: string
  readonly origin: string
  toJSON(): string
  toString(): string
}

export interface WebRealmURLConstructor {
  new(url: string | WebRealmURL, base?: string | WebRealmURL): WebRealmURL
  canParse?(url: string, base?: string): boolean
  parse?(url: string, base?: string): WebRealmURL | null
}

export interface WebRealmURLSearchParamsConstructor {
  new(
    init?: string |
      Iterable<readonly [string, string]> |
      Readonly<Record<string, string>> |
      WebRealmURLSearchParams
  ): WebRealmURLSearchParams
}

export interface WebRealmLocation {
  href: string
  readonly origin: string
  protocol: string
  host: string
  hostname: string
  port: string
  pathname: string
  search: string
  hash: string
  assign(url: string | WebRealmURL): void
  replace(url: string | WebRealmURL): void
  reload(): void
  toString(): string
}

export interface WebRealmHistory {
  readonly length: number
  readonly state: unknown
  back(): void
  forward(): void
  go(delta?: number): void
  pushState(data: unknown, unused: string, url?: string | WebRealmURL | null): void
  replaceState(data: unknown, unused: string, url?: string | WebRealmURL | null): void
}

export interface WebRealmNavigator {
  readonly gpu?: unknown
  readonly xr?: unknown
  readonly hardwareConcurrency?: number
  readonly language?: string
  readonly languages?: readonly string[]
  readonly maxTouchPoints?: number
  readonly onLine?: boolean
  readonly userAgent?: string
}

export interface WebRealmPerformance {
  readonly timeOrigin: number
  now(): number
}

export interface WebRealmCrypto {
  getRandomValues<ArrayType extends ArrayBufferView>(array: ArrayType): ArrayType
  randomUUID?(): string
}

export interface WebRealmConsole {
  debug(...data: unknown[]): void
  error(...data: unknown[]): void
  info(...data: unknown[]): void
  log(...data: unknown[]): void
  warn(...data: unknown[]): void
}

export interface WebRealmFetchResponse {
  readonly ok: boolean
  readonly redirected: boolean
  readonly status: number
  readonly statusText: string
  readonly type: string
  readonly url: string
  arrayBuffer(): Promise<ArrayBuffer>
  json(): Promise<unknown>
  text(): Promise<string>
}

export type WebRealmFetch = (
  input: string | WebRealmURL | object,
  init?: Readonly<Record<string, unknown>>
) => Promise<WebRealmFetchResponse>

export type WebRealmAnimationFrameCallback = (time: number) => void
export type WebRealmRequestAnimationFrame = (callback: WebRealmAnimationFrameCallback) => number
export type WebRealmCancelAnimationFrame = (handle: number) => void
export type WebRealmTimerHandler = (...arguments_: unknown[]) => void
export type WebRealmSetTimer = (
  handler: WebRealmTimerHandler,
  timeout?: number,
  ...arguments_: unknown[]
) => unknown
export type WebRealmClearTimer = (handle?: unknown) => void

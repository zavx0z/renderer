import { mkdir, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { dirname, resolve } from "node:path"
import {
  CAPABILITY_POLICIES,
  readJson,
  rendererRoot,
  sha256,
  stableStringify,
} from "./model.ts"
import type {
  CapabilityPolicy,
  CapabilityConsumerIdentity,
  CapabilityRequestReport,
} from "./model.ts"
import {adaptTemplateCapabilityManifest} from "./adapt-template-usage.ts"
import {
  formatCapabilityDiagnostic,
  parseCapabilityUsageFile,
  resolveCapabilityUsages,
} from "./resolve-usage.ts"
import type {CapabilityIndex} from "./resolve-usage.ts"

interface AjvValidationFunction {
  (value: unknown): boolean
  errors?: unknown[] | null
}

interface AjvInstance {
  addFormat(name: string, format: RegExp): AjvInstance
  addSchema(schema: unknown): AjvInstance
  getSchema(id: string): AjvValidationFunction | undefined
}

interface AjvConstructor {
  new (options: Record<string, unknown>): AjvInstance
}

export interface ConsumerCheckOptions {
  matrixPath: string
  sourcePath: string
  outputPath: string
  policy: CapabilityPolicy
  sourceFormat: "auto" | "usage" | "template"
  consumer: CapabilityConsumerIdentity | null
}

export function parseConsumerCheckOptions(argv: readonly string[]): ConsumerCheckOptions {
  const values = new Map<string, string>()
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!
    if (argument === "--help" || argument === "-h") throw new UsageRequested()
    if (!argument.startsWith("--")) throw new TypeError(`Unexpected argument: ${argument}`)
    const value = argv[index + 1]
    if (!value || value.startsWith("--")) throw new TypeError(`Missing value for ${argument}`)
    if (values.has(argument)) throw new TypeError(`Duplicate option: ${argument}`)
    values.set(argument, value)
    index += 1
  }

  const matrix = requiredOption(values, "--matrix")
  const source = requiredOption(values, "--source")
  const output = requiredOption(values, "--output")
  const policy = values.get("--policy") ?? "strict"
  if (!CAPABILITY_POLICIES.includes(policy as CapabilityPolicy)) {
    throw new TypeError(`Invalid --policy ${policy}; expected ${CAPABILITY_POLICIES.join(" | ")}`)
  }
  const sourceFormat = values.get("--source-format") ?? "auto"
  if (sourceFormat !== "auto" && sourceFormat !== "usage" && sourceFormat !== "template") {
    throw new TypeError(`Invalid --source-format ${sourceFormat}; expected auto | usage | template`)
  }
  const identityOptions = ["--repository", "--package", "--subject", "--scope", "--revision"]
  const providedIdentity = identityOptions.filter(option => values.has(option))
  if (providedIdentity.length !== 0 && providedIdentity.length !== identityOptions.length) {
    throw new TypeError(`Template consumer identity requires all of ${identityOptions.join(", ")}`)
  }
  const scope = values.get("--scope")
  if (scope !== undefined && scope !== "production" && scope !== "storybook" && scope !== "development") {
    throw new TypeError(`Invalid --scope ${scope}; expected production | storybook | development`)
  }
  const consumer = providedIdentity.length === 0 ? null : {
    repository: values.get("--repository")!,
    package: values.get("--package")!,
    subject: values.get("--subject")!,
    scope: scope as CapabilityConsumerIdentity["scope"],
    revision: values.get("--revision")!,
  }
  const allowed = ["--matrix", "--source", "--output", "--policy", "--source-format", ...identityOptions]
  for (const option of values.keys()) {
    if (!allowed.includes(option)) {
      throw new TypeError(`Unknown option: ${option}`)
    }
  }
  return {
    matrixPath: resolve(matrix),
    sourcePath: resolve(source),
    outputPath: resolve(output),
    policy: policy as CapabilityPolicy,
    sourceFormat,
    consumer,
  }
}

export async function runConsumerCheck(options: ConsumerCheckOptions): Promise<Readonly<{
  report: CapabilityRequestReport
  exitCode: number
}>> {
  const [matrixValue, sourceValue] = await Promise.all([
    readJson<unknown>(options.matrixPath),
    readJson<unknown>(options.sourcePath),
  ])
  const matrix = parseMatrix(matrixValue)
  const sourceFormat = options.sourceFormat === "auto"
    ? isTemplateManifest(sourceValue) ? "template" : "usage"
    : options.sourceFormat
  const source = sourceFormat === "template"
    ? adaptTemplateCapabilityManifest(sourceValue, requireConsumer(options.consumer))
    : parseCapabilityUsageFile(sourceValue)
  const report = resolveCapabilityUsages({
    matrix,
    matrixPath: options.matrixPath,
    source,
    sourcePath: options.sourcePath,
    sourceDigest: sha256(stableStringify(sourceValue)),
    policy: options.policy,
  })
  await validateReport(report)
  await mkdir(dirname(options.outputPath), {recursive: true})
  await writeFile(options.outputPath, stableStringify(report), "utf8")
  for (const diagnostic of report.diagnostics) console.error(formatCapabilityDiagnostic(diagnostic))
  return {report, exitCode: report.summary.blocking > 0 ? 1 : 0}
}

export function consumerCheckUsage(): string {
  return [
    "Usage:",
    "  bun scripts/capabilities/consumer-check.ts \\",
    "    --matrix <capabilities.index.json> \\",
    "    --source <template-capability-usages.json> \\",
    "    --output <capability-requests.json> \\",
    "    [--policy report|strict|exact] \\",
    "    [--source-format auto|usage|template] \\",
    "    [--repository <id> --package <name> --subject <name> --scope <scope> --revision <revision>]",
    "",
    "Template manifests are detected automatically and require the five explicit consumer identity options.",
    "report never fails; strict blocks missing, ambiguous, unsupported, unverified, and not-applicable requests while reporting conformance drift; exact blocks every request.",
  ].join("\n")
}

async function validateReport(report: CapabilityRequestReport): Promise<void> {
  const specificationsRoot = resolve(rendererRoot, "specifications")
  const require = createRequire(import.meta.url)
  const Ajv = require(resolve(specificationsRoot, "sources/tooling/ajv2020.cjs")) as AjvConstructor
  const ajv = new Ajv({allErrors: true, strict: true, strictRequired: false})
  ajv.addFormat("date", /^\d{4}-\d{2}-\d{2}$/)
  const [capabilitySchema, requestSchema] = await Promise.all([
    readJson<Record<string, unknown>>(resolve(specificationsRoot, "capability.schema.json")),
    readJson<Record<string, unknown>>(resolve(specificationsRoot, "capability-request.schema.json")),
  ])
  ajv.addSchema(capabilitySchema).addSchema(requestSchema)
  const validate = ajv.getSchema("https://zavx0z.dev/schemas/platform-capability-request-v1.json")
  if (!validate) throw new Error("Capability request schema was not registered")
  if (!validate(report)) {
    throw new Error(`Capability request report failed schema validation: ${JSON.stringify(validate.errors, null, 2)}`)
  }
}

function parseMatrix(value: unknown): CapabilityIndex {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Capability matrix must be an object")
  }
  const matrix = value as CapabilityIndex
  if (!Array.isArray(matrix.records)) throw new TypeError("Capability matrix records must be an array")
  return matrix
}

function isTemplateManifest(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) &&
    Array.isArray((value as Record<string, unknown>).files))
}

function requireConsumer(consumer: CapabilityConsumerIdentity | null): CapabilityConsumerIdentity {
  if (!consumer) {
    throw new TypeError("Template capability manifests require --repository, --package, --subject, --scope, and --revision")
  }
  return consumer
}

function requiredOption(values: ReadonlyMap<string, string>, option: string): string {
  const value = values.get(option)
  if (!value) throw new TypeError(`Missing required option: ${option}`)
  return value
}

class UsageRequested extends Error {}

async function main(): Promise<void> {
  try {
    const options = parseConsumerCheckOptions(process.argv.slice(2))
    const result = await runConsumerCheck(options)
    process.exitCode = result.exitCode
  } catch (error) {
    if (error instanceof UsageRequested) {
      console.log(consumerCheckUsage())
      return
    }
    console.error(error instanceof Error ? error.message : String(error))
    console.error(consumerCheckUsage())
    process.exitCode = 2
  }
}

if (import.meta.main) await main()

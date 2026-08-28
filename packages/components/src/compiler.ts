import {dirname, resolve} from "node:path"
import {API} from "typescript/unstable/async"
import {
  NodeFlags,
  SyntaxKind,
  type CallExpression,
  type Expression,
  type Identifier,
  type JsxAttribute,
  type JsxExpression,
  type Node,
  type SourceFile,
  type VariableDeclaration,
} from "typescript/unstable/ast"
import {
  isArrayBindingPattern,
  isArrowFunction,
  isBinaryExpression,
  isBindingElement,
  isBlock,
  isBreakOrContinueStatement,
  isCallExpression,
  isClassDeclaration,
  isExportSpecifier,
  isFunctionDeclaration,
  isFunctionExpression,
  isFunctionLikeDeclaration,
  isIdentifier,
  isImportSpecifier,
  isJsxAttribute,
  isJsxExpression,
  isJsxOpeningElement,
  isJsxSelfClosingElement,
  isLabeledStatement,
  isMethodDeclaration,
  isOmittedExpression,
  isParameterDeclaration,
  isPostfixUnaryExpression,
  isPrefixUnaryExpression,
  isPropertyAccessExpression,
  isPropertyAssignment,
  isPropertyDeclaration,
  isVariableDeclaration,
  isVariableStatement,
} from "typescript/unstable/ast/is"

const dynamicHelper = "__zavx0zDynamic"
const readHelper = "__zavx0zReadState"
const internalModule = "@zavx0z/dom-components/internal"
const directivePrologue = /^(?:(?:[ \t\r\n]|\/\/[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*(?:"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*')[ \t]*;?)*/

export type TransformComponentFileOptions = Readonly<{
  source?: string
}>

export type TransformComponentSourceResult = Readonly<{
  code: string
  stateBindings: readonly string[]
}>

type TextEdit = Readonly<{
  end: number
  start: number
  text: string
}>

export class ComponentCompileError extends Error {
  override readonly name = "ComponentCompileError"
}

/**
 * Parses one real TSX/JSX module through the installed TypeScript 7 project API
 * and lowers the bounded useState form with source-range edits. Bun then owns
 * the normal TS/JSX transpilation and bundling stages.
 */
export async function transformComponentFile(
  sourcePath: string,
  options: TransformComponentFileOptions = {},
): Promise<TransformComponentSourceResult> {
  const absolutePath = resolve(sourcePath)
  const api = new API({cwd: dirname(absolutePath)})
  let snapshot: Awaited<ReturnType<API["updateSnapshot"]>> | null = null
  try {
    snapshot = await api.updateSnapshot({openFiles: [absolutePath]})
    const project = await snapshot.getDefaultProjectForFile(absolutePath)
    if (!project) throw compileError(absolutePath, "TypeScript 7 could not resolve a project for this module")
    const diagnostics = await project.program.getSyntacticDiagnostics(absolutePath)
    if (diagnostics.length > 0) {
      throw compileError(absolutePath, "TypeScript 7 reported a syntax error before component lowering")
    }
    const sourceFile = await project.program.getSourceFile(absolutePath)
    if (!sourceFile) throw compileError(absolutePath, "TypeScript 7 did not return the source AST")
    const source = options.source ?? sourceFile.text
    if (sourceFile.text !== source) {
      throw compileError(absolutePath, "The Bun onLoad source differs from the TypeScript 7 project snapshot")
    }
    return lowerComponentSource(sourceFile, source)
  } finally {
    if (snapshot) await snapshot.dispose()
    await api.close()
  }
}

function lowerComponentSource(
  sourceFile: SourceFile,
  source: string,
): TransformComponentSourceResult {
  if (source.includes(dynamicHelper) || source.includes(readHelper)) {
    throw compileError(sourceFile.fileName, "Source collides with reserved compiler helper names")
  }

  const supportedCalls = new Set<CallExpression>()
  const stateDeclarations = new Set<Identifier>()
  const stateNames = new Set<string>()
  visit(sourceFile, collectFunctionState)

  visit(sourceFile, node => {
    if (
      isCallExpression(node) && isIdentifier(node.expression) &&
      node.expression.text === "useState" && !supportedCalls.has(node)
    ) {
      throw compileError(
        sourceFile.fileName,
        "useState must be a direct `const [value, setValue] = useState(initial)` declaration in a function body",
      )
    }
  })
  if (stateNames.size === 0) {
    return Object.freeze({code: source, stateBindings: Object.freeze([])})
  }

  visit(sourceFile, node => {
    if (!isIdentifier(node) || !stateNames.has(node.text) || stateDeclarations.has(node)) return
    if (isBindingDeclarationIdentifier(node)) {
      throw compileError(sourceFile.fileName, `State binding ${node.text} is shadowed in the same module`)
    }
  })

  const edits: TextEdit[] = []
  const handledExpressions = new Set<JsxExpression>()
  visit(sourceFile, node => {
    if (!isJsxExpression(node) || !node.expression) return
    const references = stateReferences(node.expression, stateNames)
    if (references.length === 0) return
    for (const reference of references) assertReadableReference(reference, sourceFile.fileName)
    const rewritten = rewriteStateReads(node.expression, references, sourceFile, source)
    const replacement = isJsxAttribute(node.parent)
      ? lowerAttributeExpression(node.parent, node.expression, rewritten, sourceFile.fileName)
      : lowerChildExpression(node.expression, rewritten, sourceFile.fileName)
    edits.push({
      start: node.expression.getStart(sourceFile),
      end: node.expression.getEnd(),
      text: replacement,
    })
    handledExpressions.add(node)
  })

  visit(sourceFile, node => {
    if (
      !isIdentifier(node) || !stateNames.has(node.text) || stateDeclarations.has(node) ||
      !isReferenceIdentifier(node)
    ) return
    const expression = containingJsxExpression(node)
    if (expression && handledExpressions.has(expression)) return
    throw compileError(
      sourceFile.fileName,
      `State value ${node.text} is read outside a supported JSX child, intrinsic property, or JSX event callback`,
    )
  })

  const insertionOffset = importInsertionOffset(source)
  edits.push({
    start: insertionOffset,
    end: insertionOffset,
    text:
      `import {__dynamic as ${dynamicHelper},__readState as ${readHelper}} ` +
      `from ${JSON.stringify(internalModule)};\n`,
  })
  return Object.freeze({
    code: applyEdits(source, edits, sourceFile.fileName),
    stateBindings: Object.freeze([...stateNames]),
  })

  function collectFunctionState(node: Node): void {
    if (!isFunctionLikeDeclaration(node) || !node.body || !isBlock(node.body)) return
    for (const statement of node.body.statements) {
      if (!isVariableStatement(statement)) continue
      const isConst = (statement.declarationList.flags & NodeFlags.Const) !== 0
      for (const declaration of statement.declarationList.declarations) {
        const call = useStateCall(declaration)
        if (!call) continue
        if (!isConst || !isArrayBindingPattern(declaration.name) || declaration.name.elements.length !== 2) {
          continue
        }
        const value = declaration.name.elements[0]
        const setter = declaration.name.elements[1]
        if (
          !value || !setter || isOmittedExpression(value) || isOmittedExpression(setter) ||
          !value.name || !setter.name || !isIdentifier(value.name) || !isIdentifier(setter.name) ||
          value.dotDotDotToken || setter.dotDotDotToken || value.initializer || setter.initializer
        ) continue
        if (call.arguments.length !== 1) {
          throw compileError(sourceFile.fileName, "useState requires exactly one initial value")
        }
        if (stateNames.has(value.name.text)) {
          throw compileError(sourceFile.fileName, `State binding ${value.name.text} must be unique in one module`)
        }
        stateNames.add(value.name.text)
        stateDeclarations.add(value.name)
        supportedCalls.add(call)
      }
    }
  }
}

function useStateCall(declaration: VariableDeclaration): CallExpression | null {
  const initializer = declaration.initializer
  return initializer && isCallExpression(initializer) && isIdentifier(initializer.expression) &&
    initializer.expression.text === "useState"
    ? initializer
    : null
}

function stateReferences(expression: Expression, names: ReadonlySet<string>): Identifier[] {
  const references: Identifier[] = []
  const walk = (node: Node): void => {
    if (node !== expression && isJsxExpression(node)) return
    if (isIdentifier(node) && names.has(node.text) && isReferenceIdentifier(node)) references.push(node)
    node.forEachChild(child => {
      walk(child)
      return undefined
    })
  }
  walk(expression)
  return references
}

function rewriteStateReads(
  expression: Expression,
  references: readonly Identifier[],
  sourceFile: SourceFile,
  source: string,
): string {
  const start = expression.getStart(sourceFile)
  const end = expression.getEnd()
  const expressionSource = source.slice(start, end)
  const edits = references.map(reference => ({
    start: reference.getStart(sourceFile) - start,
    end: reference.getEnd() - start,
    text: `${readHelper}(${reference.text})`,
  }))
  return applyEdits(expressionSource, edits, sourceFile.fileName)
}

function lowerAttributeExpression(
  attribute: JsxAttribute,
  expression: Expression,
  rewritten: string,
  sourcePath: string,
): string {
  if (!isIntrinsicAttribute(attribute)) {
    throw compileError(sourcePath, "Reactive component props are outside the first component subset")
  }
  return isArrowFunction(expression) || isFunctionExpression(expression)
    ? rewritten
    : `${dynamicHelper}(() => (${rewritten}))`
}

function lowerChildExpression(expression: Expression, rewritten: string, sourcePath: string): string {
  if (isArrowFunction(expression) || isFunctionExpression(expression)) {
    throw compileError(sourcePath, "A reactive JSX child must resolve to a primitive, not a function")
  }
  return `${dynamicHelper}(() => (${rewritten}))`
}

function isIntrinsicAttribute(attribute: JsxAttribute): boolean {
  const opening = attribute.parent.parent
  const tagName = isJsxOpeningElement(opening) || isJsxSelfClosingElement(opening)
    ? opening.tagName
    : null
  return !!tagName && isIdentifier(tagName) && /^[a-z]/.test(tagName.text)
}

function containingJsxExpression(node: Node): JsxExpression | null {
  for (let current: Node | undefined = node.parent; current; current = current.parent) {
    if (isJsxExpression(current)) return current
    if (isFunctionLikeDeclaration(current)) return null
  }
  return null
}

function assertReadableReference(identifier: Identifier, sourcePath: string): void {
  const parent = identifier.parent
  if (
    (isPrefixUnaryExpression(parent) || isPostfixUnaryExpression(parent)) &&
    parent.operand === identifier
  ) {
    throw compileError(sourcePath, `State value ${identifier.text} is read-only; use its setter`)
  }
  if (
    isBinaryExpression(parent) && parent.left === identifier &&
    parent.operatorToken.kind >= SyntaxKind.FirstAssignment &&
    parent.operatorToken.kind <= SyntaxKind.LastAssignment
  ) {
    throw compileError(sourcePath, `State value ${identifier.text} is read-only; use its setter`)
  }
}

function isReferenceIdentifier(identifier: Identifier): boolean {
  const parent = identifier.parent
  if (
    (isPropertyAccessExpression(parent) && parent.name === identifier) ||
    (isPropertyAssignment(parent) && parent.name === identifier) ||
    (isMethodDeclaration(parent) && parent.name === identifier) ||
    (isPropertyDeclaration(parent) && parent.name === identifier) ||
    (isBindingElement(parent) && parent.name === identifier) ||
    (isVariableDeclaration(parent) && parent.name === identifier) ||
    (isParameterDeclaration(parent) && parent.name === identifier) ||
    (isFunctionDeclaration(parent) && parent.name === identifier) ||
    (isClassDeclaration(parent) && parent.name === identifier) ||
    isImportSpecifier(parent) || isExportSpecifier(parent) ||
    (isLabeledStatement(parent) && parent.label === identifier) ||
    (isBreakOrContinueStatement(parent) && parent.label === identifier)
  ) return false
  return true
}

function isBindingDeclarationIdentifier(identifier: Identifier): boolean {
  const parent = identifier.parent
  return (
    (isBindingElement(parent) && parent.name === identifier) ||
    (isVariableDeclaration(parent) && parent.name === identifier) ||
    (isParameterDeclaration(parent) && parent.name === identifier) ||
    (isFunctionDeclaration(parent) && parent.name === identifier) ||
    (isClassDeclaration(parent) && parent.name === identifier) ||
    isImportSpecifier(parent)
  )
}

function importInsertionOffset(source: string): number {
  const newline = source.startsWith("#!") ? source.indexOf("\n") : -1
  const bodyOffset = newline < 0 ? 0 : newline + 1
  const prologue = directivePrologue.exec(source.slice(bodyOffset))?.[0] ?? ""
  return bodyOffset + prologue.length
}

function applyEdits(source: string, edits: readonly TextEdit[], sourcePath: string): string {
  const ascending = [...edits].sort((left, right) => left.start - right.start || left.end - right.end)
  for (let index = 1; index < ascending.length; index += 1) {
    const previous = ascending[index - 1]!
    const current = ascending[index]!
    if (current.start < previous.end) {
      throw compileError(sourcePath, "Component compiler produced overlapping source edits")
    }
  }
  let output = source
  for (const edit of [...ascending].reverse()) {
    output = `${output.slice(0, edit.start)}${edit.text}${output.slice(edit.end)}`
  }
  return output
}

function visit(node: Node, callback: (node: Node) => void): void {
  callback(node)
  node.forEachChild(child => {
    visit(child, callback)
    return undefined
  })
}

function compileError(sourcePath: string, message: string): ComponentCompileError {
  return new ComponentCompileError(`${sourcePath}: ${message}`)
}

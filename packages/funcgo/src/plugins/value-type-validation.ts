import path from 'path'
import type { SystemErrorCode } from '@func/shared/system-errors'
import ts from 'typescript'
import type { Plugin } from 'rolldown'
import { formatCodeFrame } from '../utils/dev-error-code-frame'

interface ValueTypeValidationOptions {
  cwd: string
}

interface ValueTypeDiagnostic {
  className?: string
  column: number
  declaredType?: string
  file: string
  line: number
  position: number
  property: string
}

type RuntimeTypeStatus = 'supported' | 'unknown' | 'unsupported'
type DecoratorTypeStatus = 'present' | 'unknown' | 'missing'

const SOURCE_EXTENSION = /\.(?:[cm]?ts|tsx)$/
const DECLARATION_EXTENSION = /\.d\.(?:[cm]?ts|tsx)$/
const FUNC_MODULE = 'func'
const CANNOT_INFER_VALUE_TYPE_CODE =
  'F_SYSTEM_CANNOT_INFER_VALUE_TYPE' satisfies SystemErrorCode
const UNSUPPORTED_TYPE_REFERENCES = new Set([
  'Array',
  'Date',
  'Function',
  'Map',
  'Object',
  'Promise',
  'ReadonlyArray',
  'Set',
  'WeakMap',
  'WeakSet',
])
const UNSUPPORTED_TYPE_KINDS: ReadonlySet<ts.SyntaxKind> = new Set([
  ts.SyntaxKind.AnyKeyword,
  ts.SyntaxKind.BigIntKeyword,
  ts.SyntaxKind.NeverKeyword,
  ts.SyntaxKind.NullKeyword,
  ts.SyntaxKind.ObjectKeyword,
  ts.SyntaxKind.SymbolKeyword,
  ts.SyntaxKind.UndefinedKeyword,
  ts.SyntaxKind.UnknownKeyword,
  ts.SyntaxKind.VoidKeyword,
])

export const valueTypeValidationPlugin = (
  options: ValueTypeValidationOptions,
): Plugin => {
  const diagnostics = new Map<string, ValueTypeDiagnostic>()

  return {
    name: 'funcgo-value-type-validation',
    buildStart() {
      diagnostics.clear()
    },
    transform(code, id) {
      const file = sourceFilePath(id)
      if (!file) return

      validateSource(code, file).forEach(diagnostic => {
        diagnostics.set(`${diagnostic.file}:${diagnostic.position}`, diagnostic)
      })
    },
    buildEnd(error) {
      if (error || !diagnostics.size) return

      const sorted = [...diagnostics.values()].sort(compareDiagnostics)
      const first = sorted[0]
      const message = formatDiagnostics(sorted, options.cwd)

      this.error({
        code: CANNOT_INFER_VALUE_TYPE_CODE,
        frame: formatCodeFrame(first, { highlight: first.property }),
        id: first.file,
        loc: {
          column: first.column - 1,
          file: first.file,
          line: first.line,
        },
        message,
        pos: first.position,
      })
    },
  }
}

const sourceFilePath = (id: string): string | undefined => {
  if (id.startsWith('\0')) return undefined

  const file = id.split('?', 1)[0]
  const normalized = file.replace(/\\/g, '/')
  if (!SOURCE_EXTENSION.test(normalized)) return undefined
  if (DECLARATION_EXTENSION.test(normalized)) return undefined
  if (normalized.split('/').includes('node_modules')) return undefined

  return file
}

const validateSource = (code: string, file: string): ValueTypeDiagnostic[] => {
  const sourceFile = ts.createSourceFile(
    file,
    code,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  const bindings = valueBindings(sourceFile)
  if (!bindings.identifiers.size && !bindings.namespaces.size) return []

  const diagnostics: ValueTypeDiagnostic[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isPropertyDeclaration(node)) {
      validateProperty(node, sourceFile, bindings).forEach(diagnostic => {
        diagnostics.push(diagnostic)
      })
    }

    ts.forEachChild(node, visit)
  }
  visit(sourceFile)

  return diagnostics
}

interface ValueBindings {
  identifiers: Set<string>
  namespaces: Set<string>
}

const valueBindings = (sourceFile: ts.SourceFile): ValueBindings => {
  const identifiers = new Set<string>()
  const namespaces = new Set<string>()

  sourceFile.statements.forEach(statement => {
    if (!ts.isImportDeclaration(statement)) return
    if (!ts.isStringLiteral(statement.moduleSpecifier)) return
    if (statement.moduleSpecifier.text !== FUNC_MODULE) return

    const clause = statement.importClause
    if (!clause || clause.isTypeOnly || !clause.namedBindings) return
    if (ts.isNamespaceImport(clause.namedBindings)) {
      namespaces.add(clause.namedBindings.name.text)
      return
    }

    clause.namedBindings.elements.forEach(element => {
      if (element.isTypeOnly) return

      const imported = element.propertyName?.text || element.name.text
      if (imported === 'Value') identifiers.add(element.name.text)
    })
  })

  return { identifiers, namespaces }
}

const validateProperty = (
  property: ts.PropertyDeclaration,
  sourceFile: ts.SourceFile,
  bindings: ValueBindings,
): ValueTypeDiagnostic[] => {
  const decorators = ts.getDecorators(property) || []
  const valueDecorators = decorators
    .map(decorator => valueDecoratorCall(decorator, bindings))
    .filter((call): call is ts.CallExpression => Boolean(call))
  if (!valueDecorators.length) return []

  const typeStatus = runtimeTypeStatus(property.type)
  const hasInvalidDecorator = valueDecorators.some(call => {
    return decoratorTypeStatus(call) === 'missing' && typeStatus === 'unsupported'
  })
  if (!hasInvalidDecorator) return []

  const propertyName = staticPropertyName(property.name)
  if (!propertyName) return []

  const position = property.name.getStart(sourceFile)
  const location = sourceFile.getLineAndCharacterOfPosition(position)

  return [
    {
      className: property.parent.name?.getText(sourceFile),
      column: location.character + 1,
      declaredType: property.type?.getText(sourceFile),
      file: sourceFile.fileName,
      line: location.line + 1,
      position,
      property: propertyName,
    },
  ]
}

const valueDecoratorCall = (
  decorator: ts.Decorator,
  bindings: ValueBindings,
): ts.CallExpression | undefined => {
  if (!ts.isCallExpression(decorator.expression)) return undefined

  const callee = decorator.expression.expression
  if (ts.isIdentifier(callee) && bindings.identifiers.has(callee.text)) {
    return decorator.expression
  }
  if (!ts.isPropertyAccessExpression(callee)) return undefined
  if (!ts.isIdentifier(callee.expression)) return undefined
  if (!bindings.namespaces.has(callee.expression.text)) return undefined
  if (callee.name.text !== 'Value') return undefined

  return decorator.expression
}

const decoratorTypeStatus = (call: ts.CallExpression): DecoratorTypeStatus => {
  const params = call.arguments[0]
  if (!params) return 'missing'
  if (!ts.isObjectLiteralExpression(params)) return 'unknown'

  let lastSpread = -1
  let lastType = -1
  let status: DecoratorTypeStatus = 'missing'

  params.properties.forEach((property, index) => {
    if (ts.isSpreadAssignment(property)) {
      lastSpread = index
      return
    }
    if (!property.name || staticPropertyName(property.name) !== 'type') return

    lastType = index
    status = explicitTypeStatus(property)
  })
  if (lastSpread > lastType) return 'unknown'

  return lastType >= 0 ? status : lastSpread >= 0 ? 'unknown' : 'missing'
}

const explicitTypeStatus = (
  property: ts.ObjectLiteralElementLike,
): DecoratorTypeStatus => {
  if (!ts.isPropertyAssignment(property)) return 'present'

  const value = property.initializer
  if (value.kind === ts.SyntaxKind.NullKeyword) return 'missing'
  if (ts.isIdentifier(value) && value.text === 'undefined') return 'missing'
  if (ts.isVoidExpression(value)) return 'missing'

  return 'present'
}

const runtimeTypeStatus = (type: ts.TypeNode | undefined): RuntimeTypeStatus => {
  if (!type) return 'unsupported'
  if (ts.isParenthesizedTypeNode(type)) return runtimeTypeStatus(type.type)
  if (isSupportedPrimitive(type)) return 'supported'
  if (ts.isLiteralTypeNode(type)) return literalTypeStatus(type)
  if (ts.isTypeReferenceNode(type)) return typeReferenceStatus(type)
  if (isUnsupportedType(type)) return 'unsupported'

  return 'unknown'
}

const isSupportedPrimitive = (type: ts.TypeNode): boolean => {
  return (
    type.kind === ts.SyntaxKind.StringKeyword ||
    type.kind === ts.SyntaxKind.NumberKeyword ||
    type.kind === ts.SyntaxKind.BooleanKeyword
  )
}

const literalTypeStatus = (type: ts.LiteralTypeNode): RuntimeTypeStatus => {
  const literal = type.literal
  if (ts.isStringLiteral(literal) || ts.isNumericLiteral(literal)) {
    return 'supported'
  }
  if (
    literal.kind === ts.SyntaxKind.TrueKeyword ||
    literal.kind === ts.SyntaxKind.FalseKeyword
  ) {
    return 'supported'
  }

  return 'unsupported'
}

const typeReferenceStatus = (type: ts.TypeReferenceNode): RuntimeTypeStatus => {
  if (!ts.isIdentifier(type.typeName)) return 'unknown'

  return UNSUPPORTED_TYPE_REFERENCES.has(type.typeName.text)
    ? 'unsupported'
    : 'unknown'
}

const isUnsupportedType = (type: ts.TypeNode): boolean => {
  if (
    ts.isArrayTypeNode(type) ||
    ts.isTupleTypeNode(type) ||
    ts.isUnionTypeNode(type) ||
    ts.isIntersectionTypeNode(type) ||
    ts.isTypeLiteralNode(type) ||
    ts.isFunctionTypeNode(type) ||
    ts.isConstructorTypeNode(type) ||
    ts.isMappedTypeNode(type) ||
    ts.isConditionalTypeNode(type)
  ) {
    return true
  }

  return UNSUPPORTED_TYPE_KINDS.has(type.kind)
}

const staticPropertyName = (name: ts.PropertyName): string | undefined => {
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name)
  ) {
    return name.text
  }
  if (!ts.isComputedPropertyName(name)) return undefined
  if (!ts.isStringLiteral(name.expression)) return undefined

  return name.expression.text
}

const compareDiagnostics = (
  left: ValueTypeDiagnostic,
  right: ValueTypeDiagnostic,
): number => {
  const file = left.file.localeCompare(right.file)
  if (file) return file

  return left.position - right.position
}

const formatDiagnostics = (
  diagnostics: ValueTypeDiagnostic[],
  cwd: string,
): string => {
  const content = diagnostics.flatMap((diagnostic, index) => {
    return formatDiagnostic(diagnostic, index, diagnostics.length, cwd)
  })
  const property = diagnostics.length === 1 ? diagnostics[0].property : 'value'

  return [
    ...content,
    '',
    'Please specify the type explicitly in the option decorator:',
    '  @Value({ type: String })',
    `  ${property}!: string`,
  ].join('\n')
}

const formatDiagnostic = (
  diagnostic: ValueTypeDiagnostic,
  index: number,
  total: number,
  cwd: string,
): string[] => {
  const subject = diagnostic.className
    ? `${diagnostic.className}.${diagnostic.property}`
    : diagnostic.property
  const declaredType = diagnostic.declaredType
    ? ` (declared as "${diagnostic.declaredType}")`
    : ''
  const relativeFile = path.relative(cwd, diagnostic.file).replace(/\\/g, '/')
  const codeFrame = formatCodeFrame(diagnostic, {
    highlight: diagnostic.property,
  })
  const heading =
    total === 1
      ? `Cannot automatically infer the runtime type for "${subject}"${declaredType}.`
      : `${index + 1}. "${subject}"${declaredType}`
  const result = [
    heading,
    '',
    `  ${relativeFile}:${diagnostic.line}:${diagnostic.column}`,
  ]
  if (codeFrame) result.push('', codeFrame)
  if (index < total - 1) result.push('')

  if (total === 1) return result
  if (index > 0) return result

  return [
    `Cannot automatically infer runtime types for ${total} @Value properties:`,
    '',
    ...result,
  ]
}

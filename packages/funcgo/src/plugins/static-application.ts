import path from 'node:path'
import ts from 'typescript'

const APPLICATION_DEFINITION_ABI = 2 as const
const FUNC_MODULE = 'func'
const BUILTIN_REFERENCES = new Set([
  'ARGS',
  'Context',
  'MODULE_OPTION',
  'OutputHost',
  'STDERR',
  'STDIN',
  'STDOUT',
])
const MULTI_PROVIDER_REFERENCES = new Set(['MODULE_OPTION'])
const RESERVED_PROVIDER_REFERENCES = new Set([
  'ARGS',
  'Context',
  'OutputHost',
  'STDERR',
  'STDIN',
  'STDOUT',
])

type Primitive = boolean | null | number | string | undefined

interface EvaluatedReference {
  reference: number
}

type Evaluated =
  Primitive | EvaluatedReference | Evaluated[] | { [key: string]: Evaluated }

interface ReferenceDefinition {
  builtin?: string
  code: string
  file: string
  id: number
  name: string
}

interface StaticFieldOption {
  aliases: string[]
  dependsOn?: string[]
  deprecated?: true | string
  description?: string
  enum?: (boolean | number | string)[]
  exclusive?: string[]
  kind: 'array' | 'flag' | 'value'
  name: string
  negatable?: boolean
  override?: boolean
  propertyKey: string
  required: boolean
  transform?: number
  type: 'boolean' | 'number' | 'number[]' | 'string' | 'string[]'
  validators: number[]
}

interface StaticHandler {
  command?: Record<string, unknown>
  fieldOptions: StaticFieldOption[]
  handler: number
  kind?: 'command' | 'major' | 'missing'
  methodHandlers: Record<string, unknown>[]
}

interface StaticModuleOption {
  fieldOptions?: StaticFieldOption[]
  handler?: Record<string, unknown>
  kind: 'action' | 'value'
  option?: Record<string, unknown>
  target: number
}

interface StaticProvider {
  inject?: number[]
  multi: boolean
  strategy: 'class' | 'factory' | 'value'
  token: number
  use: Evaluated
}

interface StaticModule {
  exports: number[]
  handlers: StaticHandler[]
  imports: number[]
  input: number
  name: string
  options: StaticModuleOption[]
  providers: StaticProvider[]
}

export interface StaticApplicationAnalysis {
  callEnd: number
  callStart: number
  definition: {
    abi: typeof APPLICATION_DEFINITION_ABI
    modules: StaticModule[]
    references: Omit<ReferenceDefinition, 'code' | 'file'>[]
    rootModule: number
  }
  entry: string
  optionArguments: string
  references: ReferenceDefinition[]
  statementStart: number
}

export type StaticApplicationAnalysisResult =
  | { analysis: StaticApplicationAnalysis; supported: true }
  | { reason: string; supported: false }

interface FuncBindings {
  named: ReadonlyMap<string, string>
  namespaces: ReadonlySet<string>
}

interface FieldState {
  constraints: {
    dependsOn?: string[]
    enum?: (boolean | number | string)[]
    exclusive?: string[]
  }
  deprecated?: true | string
  option?: StaticFieldOption
  override: boolean
  required: boolean
  validators: number[]
}

class UnsupportedApplication extends Error {}

class ReferenceRegistry {
  private readonly byKey = new Map<ts.Node | ts.Symbol, ReferenceDefinition>()
  readonly definitions: ReferenceDefinition[] = []

  constructor(private readonly checker: ts.TypeChecker) {}

  add(node: ts.Expression): number {
    const symbol = this.symbol(node)
    const key = symbol ?? node
    const existing = this.byKey.get(key)
    if (existing) return existing.id
    const binding = importedBinding(node)
    const definition: ReferenceDefinition = {
      ...(binding?.module === FUNC_MODULE && BUILTIN_REFERENCES.has(binding.imported)
        ? { builtin: binding.imported }
        : {}),
      code: node.getText(node.getSourceFile()),
      file: normalizeFile(node.getSourceFile().fileName),
      id: this.definitions.length,
      name: symbol?.getName() ?? expressionName(node),
    }
    this.byKey.set(key, definition)
    this.definitions.push(definition)
    return definition.id
  }

  declaration(reference: number): ts.ClassDeclaration {
    const definition =
      this.definitions.at(reference) ?? unsupported('unknown class reference')
    const node = Array.from(this.byKey).find(
      ([, value]) => value === definition,
    )?.[0]
    const symbol = node && isSymbol(node) ? node : undefined
    const declaration = symbol?.declarations?.find(ts.isClassDeclaration)
    if (declaration) return declaration
    return unsupported(`class source is unavailable for ${definition.name}`)
  }

  private symbol(node: ts.Expression): ts.Symbol | undefined {
    const symbol = this.checker.getSymbolAtLocation(node)
    if (!symbol) return undefined
    if (symbol.flags & ts.SymbolFlags.Alias)
      return this.checker.getAliasedSymbol(symbol)
    return symbol
  }
}

class StaticApplicationAnalyzer {
  private readonly bindings = new Map<string, FuncBindings>()
  private readonly moduleCache = new Map<number, number>()
  private readonly moduleStack = new Set<number>()
  private readonly modules: StaticModule[] = []
  private readonly references: ReferenceRegistry

  constructor(
    private readonly program: ts.Program,
    private readonly entry: ts.SourceFile,
  ) {
    this.references = new ReferenceRegistry(program.getTypeChecker())
  }

  analyze(): StaticApplicationAnalysis {
    const calls = this.createAppCalls()
    if (calls.length !== 1) unsupported('exactly one createApp call is required')
    const call = calls.at(0) ?? unsupported('createApp call is unavailable')
    const rootExpression =
      call.arguments.at(0) ?? unsupported('createApp requires a module')
    const root = referenceOf(this.evaluate(rootExpression))
    const rootModule = this.module(root)
    const statement = topLevelStatement(call)
    const optionArguments =
      call.arguments.length > 1
        ? `, ${call.arguments
            .slice(1)
            .map(argument => argument.getText(this.entry))
            .join(', ')}`
        : ''

    return {
      callEnd: call.end,
      callStart: call.getStart(this.entry),
      definition: {
        abi: APPLICATION_DEFINITION_ABI,
        modules: this.modules,
        references: this.references.definitions.map(({ builtin, id, name }) => ({
          ...(builtin ? { builtin } : {}),
          id,
          name,
        })),
        rootModule,
      },
      entry: normalizeFile(this.entry.fileName),
      optionArguments,
      references: this.references.definitions,
      statementStart: statement.getStart(this.entry),
    }
  }

  private createAppCalls(): ts.CallExpression[] {
    const bindings = this.funcBindings(this.entry)
    const names = new Set(
      Array.from(bindings.named, ([local, imported]) =>
        imported === 'createApp' ? local : '',
      ).filter(Boolean),
    )
    const calls: ts.CallExpression[] = []
    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        names.has(node.expression.text)
      ) {
        calls.push(node)
      }
      ts.forEachChild(node, visit)
    }
    visit(this.entry)
    return calls
  }

  private module(reference: number): number {
    const cached = this.moduleCache.get(reference)
    if (cached !== undefined) return cached
    if (this.moduleStack.has(reference)) unsupported('circular module import')
    this.moduleStack.add(reference)
    const declaration = this.references.declaration(reference)
    this.assertSimpleClass(declaration)
    const metadata = this.moduleMetadata(declaration)
    const imports = values(metadata.imports).map(value =>
      this.module(referenceOf(value)),
    )
    const handlers = values(metadata.commands).map(value =>
      this.handler(referenceOf(value)),
    )
    const options = values(metadata.options).map(value =>
      this.moduleOption(referenceOf(value)),
    )
    const module: StaticModule = {
      exports: values(metadata.exports).map(referenceOf),
      handlers,
      imports,
      input: reference,
      name:
        optionalString(metadata.name) ??
        declaration.name?.text ??
        '(anonymous module)',
      options,
      providers: values(metadata.providers).map(value => this.provider(value)),
    }
    const index = this.modules.length
    this.modules.push(module)
    this.moduleCache.set(reference, index)
    this.moduleStack.delete(reference)
    return index
  }

  private moduleMetadata(
    declaration: ts.ClassDeclaration,
  ): Record<string, Evaluated> {
    const decorators = this.classDecorators(declaration)
    const module =
      decorators.find(item => item.name === 'Module') ??
      unsupported('application modules must use @Module')
    this.assertDecorators(decorators, ['Module'])
    const argument =
      module.call.arguments.at(0) ?? unsupported('@Module requires static metadata')
    return objectOf(this.evaluate(argument))
  }

  private handler(reference: number): StaticHandler {
    const declaration = this.references.declaration(reference)
    this.assertSimpleClass(declaration)
    const decorators = this.classDecorators(declaration)
    this.assertDecorators(decorators, ['Command', 'CommandMajor', 'CommandMissing'])
    const command = decorators.find(item => item.name === 'Command')
    const major = decorators.some(item => item.name === 'CommandMajor')
    const missing = decorators.some(item => item.name === 'CommandMissing')
    const kinds = [Boolean(command), major, missing].filter(Boolean)
    if (kinds.length !== 1) unsupported('command kind must be statically known')
    return {
      ...(command
        ? {
            command: normalizeCommand(this.evaluate(this.argument(command.call))),
          }
        : {}),
      fieldOptions: this.fieldOptions(declaration),
      handler: reference,
      kind: command ? 'command' : major ? 'major' : 'missing',
      methodHandlers: this.methodHandlers(declaration),
    }
  }

  private moduleOption(reference: number): StaticModuleOption {
    const declaration = this.references.declaration(reference)
    this.assertSimpleClass(declaration)
    const decorators = this.classDecorators(declaration)
    this.assertDecorators(decorators, ['Option', 'OptionCommand'])
    const option = decorators.some(item => item.name === 'Option')
    const action = decorators.find(item => item.name === 'OptionCommand')
    if (option === Boolean(action)) unsupported('module option kind is ambiguous')
    if (action) {
      const handlers = this.methodHandlers(declaration)
      const handler = handlers.at(0)
      const fields = this.fieldOptions(declaration)
      if (
        handlers.length !== 1 ||
        !handler ||
        handler.flag ||
        valuesFromUnknown(handler.path).length
      ) {
        unsupported('option command requires one default handler')
      }
      if (fields.length) unsupported('option commands cannot declare fields')
      return {
        handler,
        kind: 'action',
        option: normalizeOptionCommand(
          objectOf(this.evaluate(this.argument(action.call))),
        ),
        target: reference,
      }
    }
    if (this.methodHandlers(declaration).length) {
      unsupported('value options cannot declare handlers')
    }
    const fields = this.fieldOptions(declaration)
    if (!fields.length) unsupported('value options require fields')
    return {
      fieldOptions: fields,
      kind: 'value',
      target: reference,
    }
  }

  private provider(value: Evaluated): StaticProvider {
    if (isReference(value)) {
      this.assertInjectable(value.reference)
      return {
        multi: this.multiProvider(value.reference),
        strategy: 'class',
        token: value.reference,
        use: value,
      }
    }
    const provider = objectOf(value)
    const token = referenceOf(requiredValue(provider.provide, 'provider token'))
    const builtin = this.references.definitions[token]?.builtin
    if (builtin && RESERVED_PROVIDER_REFERENCES.has(builtin)) {
      unsupported(`the ${builtin} runtime token cannot be provided by a module`)
    }
    const strategies = ['useClass', 'useFactory', 'useValue'].filter(key =>
      Object.prototype.hasOwnProperty.call(provider, key),
    )
    if (strategies.length !== 1) unsupported('provider strategy must be static')
    const strategy = strategies[0]
    if (strategy === 'useClass') {
      this.assertInjectable(
        referenceOf(requiredValue(provider.useClass, 'class provider')),
      )
    }
    const inject = provider.inject
      ? values(provider.inject).map(referenceOf)
      : undefined
    return {
      ...(inject ? { inject } : {}),
      multi: this.multiProvider(token),
      strategy:
        strategy === 'useClass'
          ? 'class'
          : strategy === 'useFactory'
            ? 'factory'
            : 'value',
      token,
      use: requiredValue(provider[strategy], strategy),
    }
  }

  private multiProvider(reference: number): boolean {
    const builtin = this.references.definitions[reference]?.builtin
    return Boolean(builtin && MULTI_PROVIDER_REFERENCES.has(builtin))
  }

  private assertInjectable(reference: number) {
    const declaration = this.references.declaration(reference)
    this.assertSimpleClass(declaration)
    const decorators = this.classDecorators(declaration)
    this.assertDecorators(decorators, ['Injectable', 'Option', 'OptionCommand'])
    const injectable = decorators.some(decorator =>
      ['Injectable', 'Option', 'OptionCommand'].includes(decorator.name),
    )
    if (!injectable) unsupported('class providers must be injectable')
    const hasHandlers = declaration.members.some(member =>
      this.memberDecorators(member).some(decorator => decorator.name === 'Handler'),
    )
    if (hasHandlers) unsupported('provider classes cannot declare handlers')
  }

  private methodHandlers(
    declaration: ts.ClassDeclaration,
  ): Record<string, unknown>[] {
    return declaration.members.flatMap(member => {
      if (!ts.isMethodDeclaration(member)) return []
      const decorators = this.memberDecorators(member)
      this.assertDecorators(decorators, ['Deprecated', 'Handler'])
      const handler = decorators.find(item => item.name === 'Handler')
      if (!handler) return []
      const methodName = propertyName(member.name)
      const handlerInput = handler.call.arguments.at(0)
      const params = normalizeHandler(
        handlerInput ? this.evaluate(handlerInput) : undefined,
        methodName,
      )
      const deprecated = decorators.find(item => item.name === 'Deprecated')
      if (!deprecated) return [params]
      if (!params.flag) unsupported('@Deprecated handlers require a flag')
      const deprecatedInput = deprecated.call.arguments.at(0)
      return [
        {
          ...params,
          deprecated: normalizeDeprecation(
            deprecatedInput ? this.evaluate(deprecatedInput) : true,
          ),
        },
      ]
    })
  }

  private fieldOptions(declaration: ts.ClassDeclaration): StaticFieldOption[] {
    return declaration.members.flatMap(member => {
      if (!ts.isPropertyDeclaration(member)) return []
      const decorators = this.memberDecorators(member)
      const supported = [
        'ArrayNumber',
        'ArrayString',
        'DependsOn',
        'Deprecated',
        'Enum',
        'Exclusive',
        'Flag',
        'Override',
        'Required',
        'Value',
        'ValueValidate',
      ]
      this.assertDecorators(decorators, supported)
      if (!decorators.length) return []
      const propertyKey = propertyName(member.name)
      const state: FieldState = {
        constraints: {},
        override: false,
        required: false,
        validators: [],
      }
      decorators
        .slice()
        .reverse()
        .forEach(decorator => {
          this.applyFieldDecorator(state, decorator, member, propertyKey)
        })
      if (!state.option) return []
      return [
        {
          ...state.option,
          ...state.constraints,
          ...(state.deprecated ? { deprecated: state.deprecated } : {}),
          ...(state.override ? { override: true } : {}),
          required: state.required,
          validators: state.validators,
        },
      ]
    })
  }

  private applyFieldDecorator(
    state: FieldState,
    decorator: NamedDecorator,
    member: ts.PropertyDeclaration,
    propertyKey: string,
  ) {
    if (
      decorator.name === 'Flag' ||
      decorator.name === 'Value' ||
      decorator.name === 'ArrayString' ||
      decorator.name === 'ArrayNumber'
    ) {
      if (state.option) unsupported('multiple field option decorators')
      state.option = this.fieldOption(decorator, member, propertyKey)
      return
    }
    if (decorator.name === 'Required') {
      state.required = true
      return
    }
    if (decorator.name === 'Override') {
      state.override = true
      return
    }
    if (decorator.name === 'Deprecated') {
      const input = decorator.call.arguments.at(0)
      state.deprecated = normalizeDeprecation(input ? this.evaluate(input) : true)
      return
    }
    if (decorator.name === 'ValueValidate') {
      state.validators.push(
        referenceOf(this.evaluate(this.argument(decorator.call))),
      )
      return
    }
    const values = primitiveArray(
      this.evaluate(this.argument(decorator.call)),
      decorator.name,
    )
    if (decorator.name === 'Enum') {
      state.constraints.enum = values
      return
    }
    const strings = values.map(value => {
      if (typeof value === 'string') return value
      return unsupported(`${decorator.name} requires string values`)
    })
    if (decorator.name === 'DependsOn') {
      state.constraints.dependsOn = strings
      return
    }
    state.constraints.exclusive = strings
  }

  private fieldOption(
    decorator: NamedDecorator,
    member: ts.PropertyDeclaration,
    propertyKey: string,
  ): StaticFieldOption {
    const argument = decorator.call.arguments.at(0)
    const input = argument ? this.evaluate(argument) : {}
    const params = typeof input === 'string' ? { name: input } : objectOf(input)
    const name = Object.prototype.hasOwnProperty.call(params, 'name')
      ? (optionalString(params.name) ?? '')
      : propertyKey
    const aliases = normalizeAliases(params)
    const description = optionalString(params.description)
    const kind =
      decorator.name === 'Flag'
        ? 'flag'
        : decorator.name.startsWith('Array')
          ? 'array'
          : 'value'
    const type =
      decorator.name === 'Flag'
        ? 'boolean'
        : decorator.name === 'ArrayNumber'
          ? 'number[]'
          : decorator.name === 'ArrayString'
            ? 'string[]'
            : valueType(member)
    return {
      aliases,
      ...(description === undefined ? {} : { description }),
      kind,
      name,
      ...(decorator.name === 'Flag' && params.negatable === true
        ? { negatable: true }
        : {}),
      propertyKey,
      required: false,
      type,
      validators: [],
    }
  }

  private classDecorators(declaration: ts.ClassDeclaration): NamedDecorator[] {
    return this.namedDecorators(declaration)
  }

  private memberDecorators(declaration: ts.ClassElement): NamedDecorator[] {
    return this.namedDecorators(declaration)
  }

  private namedDecorators(node: ts.Node): NamedDecorator[] {
    const bindings = this.funcBindings(node.getSourceFile())
    const decorators = ts.canHaveDecorators(node) ? ts.getDecorators(node) : []
    return (decorators ?? []).map(decorator => {
      const expression = decorator.expression
      const call = ts.isCallExpression(expression)
        ? expression
        : unsupported('decorators must be invoked')
      const name =
        decoratorName(call.expression, bindings) ??
        unsupported('custom decorators are not precompiled')
      return { call, name }
    })
  }

  private assertDecorators(
    decorators: readonly NamedDecorator[],
    supported: readonly string[],
  ) {
    const unknown = decorators.find(item => !supported.includes(item.name))
    if (unknown) unsupported(`unsupported @${unknown.name} decorator`)
  }

  private assertSimpleClass(declaration: ts.ClassDeclaration) {
    if (
      declaration.heritageClauses?.some(
        clause => clause.token === ts.SyntaxKind.ExtendsKeyword,
      )
    ) {
      unsupported(
        `inherited application definition ${declaration.name?.text ?? '(anonymous)'} is not precompiled`,
      )
    }
  }

  private funcBindings(sourceFile: ts.SourceFile): FuncBindings {
    const file = normalizeFile(sourceFile.fileName)
    const cached = this.bindings.get(file)
    if (cached) return cached
    const named = new Map<string, string>()
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
        named.set(element.name.text, element.propertyName?.text ?? element.name.text)
      })
    })
    const bindings = { named, namespaces }
    this.bindings.set(file, bindings)
    return bindings
  }

  private argument(call: ts.CallExpression): ts.Expression {
    const argument = call.arguments.at(0)
    if (argument) return argument
    return unsupported('decorator argument must be static')
  }

  private evaluate(node: ts.Expression): Evaluated {
    const expression = unwrap(node)
    if (
      ts.isStringLiteral(expression) ||
      ts.isNoSubstitutionTemplateLiteral(expression)
    ) {
      return expression.text
    }
    if (ts.isNumericLiteral(expression)) return Number(expression.text)
    if (expression.kind === ts.SyntaxKind.TrueKeyword) return true
    if (expression.kind === ts.SyntaxKind.FalseKeyword) return false
    if (expression.kind === ts.SyntaxKind.NullKeyword) return null
    if (ts.isIdentifier(expression) && expression.text === 'undefined')
      return undefined
    if (
      ts.isPrefixUnaryExpression(expression) &&
      expression.operator === ts.SyntaxKind.MinusToken &&
      ts.isNumericLiteral(expression.operand)
    ) {
      return -Number(expression.operand.text)
    }
    if (ts.isArrayLiteralExpression(expression)) {
      return expression.elements.flatMap(element => {
        if (ts.isSpreadElement(element))
          return values(this.evaluate(element.expression))
        if (ts.isOmittedExpression(element)) unsupported('sparse arrays are dynamic')
        return [this.evaluate(element)]
      })
    }
    if (ts.isObjectLiteralExpression(expression)) {
      const result: Record<string, Evaluated> = {}
      expression.properties.forEach(property => {
        if (ts.isSpreadAssignment(property)) {
          Object.assign(result, objectOf(this.evaluate(property.expression)))
          return
        }
        if (ts.isPropertyAssignment(property)) {
          result[propertyName(property.name)] = this.evaluate(property.initializer)
          return
        }
        if (ts.isShorthandPropertyAssignment(property)) {
          result[property.name.text] = this.evaluate(property.name)
          return
        }
        unsupported('computed module metadata is dynamic')
      })
      return result
    }
    if (ts.isIdentifier(expression)) {
      const symbol = this.program.getTypeChecker().getSymbolAtLocation(expression)
      const declaration = symbol?.valueDeclaration
      if (
        declaration &&
        ts.isVariableDeclaration(declaration) &&
        declaration.initializer &&
        isStaticContainer(declaration.initializer)
      ) {
        return this.evaluate(declaration.initializer)
      }
      return { reference: this.references.add(expression) }
    }
    if (
      ts.isPropertyAccessExpression(expression) ||
      ts.isElementAccessExpression(expression) ||
      ts.isArrowFunction(expression) ||
      ts.isFunctionExpression(expression) ||
      ts.isClassExpression(expression)
    ) {
      return { reference: this.references.add(expression) }
    }
    unsupported(`dynamic expression: ${ts.SyntaxKind[expression.kind]}`)
  }
}

interface NamedDecorator {
  call: ts.CallExpression
  name: string
}

export const analyzeStaticApplication = (
  entry: string,
  tsconfig: string | true,
): StaticApplicationAnalysis | undefined => {
  const result = inspectStaticApplication(entry, tsconfig)
  return result.supported ? result.analysis : undefined
}

export const inspectStaticApplication = (
  entry: string,
  tsconfig: string | true,
): StaticApplicationAnalysisResult => {
  try {
    const program = createProgram(entry, tsconfig)
    const sourceFile =
      program.getSourceFile(normalizeFile(entry)) ??
      program
        .getSourceFiles()
        .find(file => normalizeFile(file.fileName) === normalizeFile(entry))
    if (!sourceFile)
      return { reason: 'entry source is unavailable', supported: false }
    return {
      analysis: new StaticApplicationAnalyzer(program, sourceFile).analyze(),
      supported: true,
    }
  } catch (error) {
    if (error instanceof UnsupportedApplication)
      return { reason: error.message, supported: false }
    throw error
  }
}

const createProgram = (entry: string, tsconfig: string | true): ts.Program => {
  if (typeof tsconfig === 'string') {
    const config = ts.readConfigFile(tsconfig, ts.sys.readFile)
    if (config.error) unsupported('tsconfig cannot be read')
    const parsed = ts.parseJsonConfigFileContent(
      config.config,
      ts.sys,
      path.dirname(tsconfig),
    )
    const rootNames = Array.from(new Set(parsed.fileNames.concat([entry])))
    return ts.createProgram({
      options: parsed.options,
      rootNames,
    })
  }
  return ts.createProgram({
    options: {
      emitDecoratorMetadata: true,
      experimentalDecorators: true,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      target: ts.ScriptTarget.ESNext,
    },
    rootNames: [entry],
  })
}

const decoratorName = (
  expression: ts.LeftHandSideExpression,
  bindings: FuncBindings,
): string | undefined => {
  if (ts.isIdentifier(expression)) return bindings.named.get(expression.text)
  if (!ts.isPropertyAccessExpression(expression)) return undefined
  if (!ts.isIdentifier(expression.expression)) return undefined
  if (!bindings.namespaces.has(expression.expression.text)) return undefined
  return expression.name.text
}

const importedBinding = (
  node: ts.Expression,
): { imported: string; module: string } | undefined => {
  if (!ts.isIdentifier(node)) return undefined
  const sourceFile = node.getSourceFile()
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue
    const bindings = statement.importClause?.namedBindings
    if (!bindings || !ts.isNamedImports(bindings)) continue
    const element = bindings.elements.find(item => item.name.text === node.text)
    if (!element) continue
    return {
      imported: element.propertyName?.text ?? element.name.text,
      module: statement.moduleSpecifier.text,
    }
  }
  return undefined
}

const normalizeCommand = (input: Evaluated): Record<string, unknown> => {
  const params = isPlainObject(input) ? input : { path: input }
  const commandSegments = commandPath(requiredValue(params.path, 'command path'))
  const deprecated = normalizeDeprecation(params.deprecated)
  const description = optionalString(params.description)
  return {
    aliases: normalizeAliases(params),
    ...(deprecated ? { deprecated } : {}),
    ...(description ? { description } : {}),
    path: commandSegments,
  }
}

const normalizeHandler = (
  input: Evaluated,
  methodName: string,
): Record<string, unknown> => {
  const params = isPlainObject(input) ? input : { path: input }
  const flag = optionalString(params.flag)
  const description = optionalString(params.description)
  return {
    aliases: normalizeAliases(params),
    ...(description ? { description } : {}),
    ...(flag ? { flag } : {}),
    methodName,
    path: flag ? [] : handlerPath(params.path),
  }
}

const normalizeOptionCommand = (
  params: Record<string, Evaluated>,
): Record<string, unknown> => {
  const deprecated = normalizeDeprecation(params.deprecated)
  const description = optionalString(params.description)
  const name = requiredString(params.name, 'option command name')
  return {
    aliases: normalizeAliases(params),
    ...(deprecated ? { deprecated } : {}),
    ...(description ? { description } : {}),
    ...(params.overrideAll === true ? { overrideAll: true } : {}),
    name,
  }
}

const normalizeAliases = (params: Record<string, Evaluated>): string[] => {
  const alias = optionalString(params.alias)
  const aliases = params.aliases
    ? values(params.aliases).map(value => requiredString(value, 'alias'))
    : []
  return Array.from(new Set(alias ? [alias, ...aliases] : aliases))
}

const normalizeDeprecation = (value: Evaluated): true | string | undefined => {
  if (typeof value === 'string') return value.trim() || true
  return value === true ? true : undefined
}

const commandPath = (value: Evaluated): string[] =>
  typeof value === 'string'
    ? [value]
    : values(value).map(item => requiredString(item, 'command path'))

const handlerPath = (value: Evaluated): string[] => {
  if (value === undefined || value === '') return []
  return commandPath(value)
}

const valueType = (member: ts.PropertyDeclaration): 'number' | 'string' => {
  if (member.type?.kind === ts.SyntaxKind.StringKeyword) return 'string'
  if (member.type?.kind === ts.SyntaxKind.NumberKeyword) return 'number'
  return unsupported('@Value requires an explicit string or number type')
}

const values = (value: Evaluated): Evaluated[] => {
  if (value === undefined) return []
  if (Array.isArray(value)) return value
  return unsupported('expected a static array')
}

const valuesFromUnknown = (value: unknown): readonly unknown[] =>
  Array.isArray(value) ? value : []

const primitiveArray = (
  value: Evaluated,
  name: string,
): (boolean | number | string)[] =>
  values(value).map(item => {
    if (
      typeof item === 'boolean' ||
      typeof item === 'number' ||
      typeof item === 'string'
    ) {
      return item
    }
    return unsupported(`@${name} requires primitive values`)
  })

const objectOf = (value: Evaluated): Record<string, Evaluated> => {
  if (isPlainObject(value)) return value
  return unsupported('expected a static object')
}

const isPlainObject = (value: Evaluated): value is Record<string, Evaluated> =>
  Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    !isReference(value),
  )

const referenceOf = (value: Evaluated): number => {
  if (isReference(value)) return value.reference
  return unsupported('expected a static reference')
}

const isReference = (value: Evaluated): value is EvaluatedReference =>
  Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    'reference' in value &&
    typeof value.reference === 'number',
  )

const requiredValue = (value: Evaluated | undefined, name: string): Evaluated => {
  if (value !== undefined) return value
  return unsupported(`${name} is required`)
}

const requiredString = (value: Evaluated | undefined, name: string): string => {
  if (typeof value === 'string') return value
  return unsupported(`${name} must be a string`)
}

const optionalString = (value: Evaluated | undefined): string | undefined => {
  if (value === undefined) return undefined
  if (typeof value === 'string') return value
  return unsupported('expected a string')
}

const propertyName = (name: ts.PropertyName): string => {
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name)
  ) {
    return name.text
  }
  return unsupported('computed property names are dynamic')
}

const topLevelStatement = (node: ts.Node): ts.Statement => {
  let current = node
  while (!ts.isSourceFile(current.parent)) {
    current = current.parent
  }
  if (ts.isStatement(current)) return current
  return unsupported('createApp must be invoked from a top-level statement')
}

const unwrap = (expression: ts.Expression): ts.Expression => {
  if (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isTypeAssertionExpression(expression) ||
    ts.isSatisfiesExpression(expression) ||
    ts.isNonNullExpression(expression)
  ) {
    return unwrap(expression.expression)
  }
  return expression
}

const isStaticContainer = (expression: ts.Expression): boolean => {
  const value = unwrap(expression)
  return ts.isArrayLiteralExpression(value) || ts.isObjectLiteralExpression(value)
}

const expressionName = (expression: ts.Expression): string => {
  if (ts.isIdentifier(expression)) return expression.text
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text
  return '(anonymous)'
}

const isSymbol = (value: ts.Node | ts.Symbol): value is ts.Symbol =>
  !('kind' in value)

const normalizeFile = (file: string): string =>
  path.resolve(file).replace(/\\/g, '/')

const unsupported = (message: string): never => {
  throw new UnsupportedApplication(message)
}

import type { Locale } from './docs'

interface ChangelogRelease {
  commit: string
  date: string
  latest?: boolean
  notes: Record<Locale, string[]>
  version: string
}

export const changelogReleases: ChangelogRelease[] = [
  {
    commit: '2a3209d',
    date: '2026-08-07',
    latest: true,
    notes: {
      en: [
        'Publish separate CommonJS and ESM bundles with conditional package exports and a shared declaration entry.',
        'Move JavaScript bundling to Rolldown and add end-to-end coverage for both import and require consumers.',
        'Declare Node.js 20.12 or newer as the supported runtime.',
      ],
      'zh-cn': [
        '分别发布 CommonJS 和 ESM 产物，通过包条件导出提供统一的类型声明入口。',
        '将 JavaScript 打包迁移到 Rolldown，并为 import 和 require 两种消费方式增加端到端覆盖。',
        '明确支持 Node.js 20.12 及以上版本。',
      ],
    },
    version: '2.3.0',
  },
  {
    commit: '2a3209d',
    date: '2026-08-07',
    notes: {
      en: [
        'Clean the output directory before every package build so stale artifacts are not shipped.',
        'Run the test suite as part of the package build. The published package is reduced from 161 files in 2.2.1 to 61 files.',
      ],
      'zh-cn': [
        '每次构建前清理输出目录，避免将历史构建产物带入发布包。',
        '将测试纳入包构建流程；发布包从 2.2.1 的 161 个文件精简到 61 个。',
      ],
    },
    version: '2.2.2',
  },
  {
    commit: '74c94b7',
    date: '2026-08-07',
    notes: {
      en: [
        'Refresh the core build and test toolchain, including TypeScript 7, Vitest 4, Vite 8, and related dependencies.',
        'Refresh package metadata and the README without changing the runtime API.',
      ],
      'zh-cn': [
        '更新核心包的构建与测试工具链，包括 TypeScript 7、Vitest 4、Vite 8 及相关依赖。',
        '更新包元数据和 README，运行时 API 保持不变。',
      ],
    },
    version: '2.2.1',
  },
  {
    commit: '610290b',
    date: '2026-06-06',
    notes: {
      en: [
        'Allow missing-command classes to use method-based handlers, including async execution, field options, services, and local catches.',
        'Add a stable reason field to errors raised when a value type cannot be inferred.',
      ],
      'zh-cn': [
        '缺失命令类支持基于方法的处理器，可使用异步执行、字段选项、服务注入和局部错误捕获。',
        '当值类型无法推断时，在错误详情中提供稳定的原因标识。',
      ],
    },
    version: '2.2.0',
  },
  {
    commit: '75dbb94',
    date: '2026-06-05',
    notes: {
      en: [
        'Move the workspace to pnpm 11 and switch the shared formatter package to @unix/prettier.',
        'Maintenance-only release with no runtime behavior change.',
      ],
      'zh-cn': [
        '工作区迁移到 pnpm 11，共享格式化配置切换为 @unix/prettier。',
        '纯维护性发布，不改变运行时行为。',
      ],
    },
    version: '2.1.1',
  },
  {
    commit: '7572440',
    date: '2026-06-03',
    notes: {
      en: [
        'Introduce the module-based command runtime with FuncModule, services, method handlers, local catches, field options, and constraints.',
        'Add explicit application creation and run APIs, registration validation, and TypeScript 6 support.',
      ],
      'zh-cn': [
        '引入基于模块的命令运行时，包括 FuncModule、服务、方法处理器、局部错误捕获、字段选项和约束。',
        '新增显式的应用创建与运行 API、注册校验，并支持 TypeScript 6。',
      ],
    },
    version: '2.1.0',
  },
  {
    commit: 'fed3030',
    date: '2026-06-01',
    notes: {
      en: [
        'Correct decorator factory declarations to return the standard ClassDecorator type.',
        'Remove unnecessary constructor returns from the emitted decorator implementations.',
      ],
      'zh-cn': [
        '修正装饰器工厂的类型声明，统一返回标准 ClassDecorator 类型。',
        '移除装饰器产物中不必要的构造函数返回值。',
      ],
    },
    version: '2.0.1',
  },
  {
    commit: 'ddf7f2f',
    date: '2026-06-01',
    notes: {
      en: [
        'Rework command validation and parsing with stricter duplicate, type, required-value, array, and unknown-option checks.',
        'Add structured system, runtime, input, and deprecation errors with stable codes and details.',
        'Move the core package into the pnpm workspace and migrate its test suite to Vitest.',
      ],
      'zh-cn': [
        '重构命令校验与解析，严格检查重复注册、类型、必填值、数组和未知选项。',
        '引入结构化的系统、运行时、输入和弃用错误，提供稳定的错误码与详情。',
        '将核心包迁入 pnpm 工作区，并把测试套件迁移到 Vitest。',
      ],
    },
    version: '2.0.0',
  },
]

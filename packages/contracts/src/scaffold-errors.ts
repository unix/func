import {
  Exception,
  formatExceptionCode,
  type ExceptionCode,
  type ExceptionOptions,
} from './exception.js'

export const ScaffoldErrorScope = 'F_SCAFFOLD' as const

export enum SCAFFOLD {
  COMMAND_FAILED = 'COMMAND_FAILED',
  ENTRY_NOT_FOUND = 'ENTRY_NOT_FOUND',
  INTERNAL_COMMAND_MISMATCH = 'INTERNAL_COMMAND_MISMATCH',
  INVALID_PACKAGE_METADATA = 'INVALID_PACKAGE_METADATA',
  INVALID_PROJECT_NAME = 'INVALID_PROJECT_NAME',
  MULTIPLE_PROJECT_NAMES = 'MULTIPLE_PROJECT_NAMES',
  NEGATIVE_WATCH_GLOB = 'NEGATIVE_WATCH_GLOB',
  PACKAGE_MANIFEST_NOT_FOUND = 'PACKAGE_MANIFEST_NOT_FOUND',
  PROJECT_EXISTS = 'PROJECT_EXISTS',
  TEMPLATE_DOWNLOAD_FAILED = 'TEMPLATE_DOWNLOAD_FAILED',
  TEMPLATE_METADATA_INVALID = 'TEMPLATE_METADATA_INVALID',
  WATCH_GLOB_BASE_NOT_FOUND = 'WATCH_GLOB_BASE_NOT_FOUND',
  WATCH_PATH_NOT_FOUND = 'WATCH_PATH_NOT_FOUND',
  WATCH_REQUIRES_WATCH = 'WATCH_REQUIRES_WATCH',
}

export type ScaffoldErrorCode<Code extends SCAFFOLD = SCAFFOLD> = ExceptionCode<
  typeof ScaffoldErrorScope,
  Code
>

export const formatScaffoldErrorCode = <Code extends SCAFFOLD>(
  code: Code,
): ScaffoldErrorCode<Code> => formatExceptionCode(ScaffoldErrorScope, code)

export type ScaffoldExceptionOptions = Omit<ExceptionOptions, 'name'>

export class ScaffoldException<Code extends SCAFFOLD = SCAFFOLD> extends Exception<
  typeof ScaffoldErrorScope,
  Code
> {
  constructor(code: Code, options: ScaffoldExceptionOptions | string = {}) {
    const normalizedOptions =
      typeof options === 'string' ? { message: options } : options
    super(ScaffoldErrorScope, code, {
      ...normalizedOptions,
      name: 'ScaffoldException',
    })
  }
}

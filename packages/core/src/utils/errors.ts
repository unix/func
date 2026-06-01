export interface FuncErrorDetails {
  [key: string]: any
}

export class FuncError extends Error {
  constructor(
    public code: string,
    message: string,
    public details: FuncErrorDetails = {},
  ) {
    super(message)
    this.name = 'FuncError'
  }
}

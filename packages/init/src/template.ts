import { SCAFFOLD, ScaffoldException } from '@func/contracts/scaffold-errors'
import fs from 'fs'
import https from 'https'
import os from 'os'
import path from 'path'
import * as tar from 'tar'

export const FUNC_TEMPLATE_URL = 'https://www.npmjs.com/package/func-template'

const FUNC_TEMPLATE_METADATA_URL = 'https://registry.npmjs.org/func-template/latest'

interface PackageMetadata {
  dist?: {
    tarball?: string
  }
}

export const downloadTemplate = async (destination: string): Promise<void> => {
  const packDir = fs.mkdtempSync(path.join(os.tmpdir(), 'create-func-pack-'))

  try {
    fs.mkdirSync(destination, { recursive: true })
    const tarballUrl = resolveTemplateTarball(
      await fetchUrl(FUNC_TEMPLATE_METADATA_URL),
    )
    const tarball = path.join(packDir, 'func-template.tgz')
    fs.writeFileSync(tarball, await fetchUrl(tarballUrl))

    await tar.extract({
      cwd: destination,
      file: tarball,
      strip: 1,
    })
  } finally {
    fs.rmSync(packDir, { force: true, recursive: true })
  }
}

export const resolveTemplateTarball = (metadata: Buffer): string => {
  let pkg: unknown
  try {
    pkg = JSON.parse(metadata.toString('utf-8'))
  } catch (error) {
    throw templateMetadataError(nativeError(error))
  }
  if (!isPackageMetadata(pkg)) {
    throw templateMetadataError()
  }
  const tarball = pkg.dist?.tarball
  if (!tarball) {
    throw templateMetadataError()
  }

  return tarball
}

const fetchUrl = (url: string): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    https
      .get(url, response => {
        const statusCode = response.statusCode ?? 0
        const location = response.headers.location
        if (statusCode >= 300 && statusCode < 400 && location) {
          response.resume()
          fetchUrl(new URL(location, url).toString()).then(resolve, reject)
          return
        }

        if (statusCode < 200 || statusCode >= 300) {
          response.resume()
          reject(
            new ScaffoldException(SCAFFOLD.TEMPLATE_DOWNLOAD_FAILED, {
              details: { statusCode, url },
              message: `Request failed: ${url} (${statusCode})`,
            }),
          )
          return
        }

        const chunks: Uint8Array[] = []
        response.on('data', chunk => {
          const value: unknown = chunk
          if (typeof value === 'string') {
            chunks.push(Buffer.from(value))
            return
          }
          if (value instanceof Uint8Array) {
            chunks.push(value)
            return
          }
          reject(
            new ScaffoldException(SCAFFOLD.TEMPLATE_DOWNLOAD_FAILED, {
              details: { url },
              message: `Unsupported response chunk from ${url}.`,
            }),
          )
          response.destroy()
        })
        response.on('end', () => {
          resolve(concatBytes(chunks))
        })
      })
      .on('error', error => {
        reject(
          new ScaffoldException(SCAFFOLD.TEMPLATE_DOWNLOAD_FAILED, {
            cause: error,
            details: { url },
            message: `Request failed: ${url}.`,
          }),
        )
      })
  })
}

const templateMetadataError = (cause?: Error): ScaffoldException =>
  new ScaffoldException(SCAFFOLD.TEMPLATE_METADATA_INVALID, {
    ...(cause ? { cause } : {}),
    details: { url: FUNC_TEMPLATE_URL },
    message: `Cannot resolve tarball for ${FUNC_TEMPLATE_URL}.`,
  })

const nativeError = (error: unknown): Error | undefined =>
  error instanceof Error ? error : undefined

const isPackageMetadata = (value: unknown): value is PackageMetadata =>
  typeof value === 'object' && value !== null

const concatBytes = (chunks: Uint8Array[]): Buffer => {
  const size = chunks.reduce((total, chunk) => total + chunk.byteLength, 0)
  const output = Buffer.allocUnsafe(size)
  let offset = 0

  chunks.forEach(chunk => {
    output.set(chunk, offset)
    offset += chunk.byteLength
  })

  return output
}

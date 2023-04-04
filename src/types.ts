import * as crossFetch from 'cross-fetch'
import * as nodeFetch from 'node-fetch'
import { IFetchComponent } from '@well-known-components/interfaces'

export type RequestOptions = nodeFetch.RequestInit & {
  timeout?: number
  attempts?: number
  retryDelay?: number
}

const NON_RETRYABLE_STATUS_CODES = [404, 400, 401, 403]
const IDEMPOTENT_HTTP_METHODS = ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE']

export function createFetchComponent(defaultHeaders?: Headers): IFetchComponent {
  async function fetch(url: nodeFetch.RequestInfo, options?: RequestOptions): Promise<nodeFetch.Response> {
    const { timeout, method = 'GET', retryDelay = 0, ...fetchOptions } = options || {}
    let attempts = fetchOptions.attempts || 1
    let timer: NodeJS.Timeout | null = null
    let response: Response = new Response()

    if (defaultHeaders) {
      fetchOptions.headers = { ...(fetchOptions.headers || {}), ...defaultHeaders }
    }

    if (!IDEMPOTENT_HTTP_METHODS.includes(method.toUpperCase())) attempts = 1

    let currentAttempt = 0
    do {
      try {
        const controller = new AbortController()
        const { signal: timeoutSignal } = controller

        if (timeout) {
          timer = setTimeout(() => {
            controller.abort()
          }, timeout)
        }

        const fetchPromise = crossFetch.default(url.toString(), {
          ...fetchOptions
        } as any)

        const racePromise = Promise.race([
          fetchPromise,
          new Promise((resolve, _) => {
            timeoutSignal.addEventListener('abort', () => {
              response = new Response('timeout', { status: 408, statusText: 'Request Timeout' })
              resolve(response)
            })
          })
        ])

        ++currentAttempt
        response = (await racePromise) as Response

        if (timer) clearTimeout(timer)
      } finally {
        if (response.ok || NON_RETRYABLE_STATUS_CODES.includes(response.status) || currentAttempt >= attempts) break
        else await new Promise((resolve) => setTimeout(resolve, retryDelay))
      }
    } while (!response.ok && currentAttempt < attempts)

    if (!response.ok) {
      const responseText = await response.text()
      throw new Error(`Failed to fetch ${url}. Got status ${response.status}. Response was '${responseText}'`)
    }

    return response as any
  }

  return { fetch }
}

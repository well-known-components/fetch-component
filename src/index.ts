import * as crossFetch from 'cross-fetch'
import * as nodeFetch from 'node-fetch'
import { IFetchComponent } from '@well-known-components/interfaces'
import { RequestOptions } from './types'

const NON_RETRYABLE_STATUS_CODES = [400, 401, 403, 404]
const IDEMPOTENT_HTTP_METHODS = ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE']

export function createFetchComponent(defaultHeaders?: HeadersInit): IFetchComponent {
  async function fetch(url: nodeFetch.RequestInfo, options?: RequestOptions): Promise<nodeFetch.Response> {
    const { timeout, method = 'GET', retryDelay = 0, abortController, ...fetchOptions } = options || {}
    const controller = abortController || new AbortController()
    const { signal: timeoutSignal } = controller

    let attempts = fetchOptions.attempts || 1
    let currentAttempt = 0
    let timer: NodeJS.Timeout | null = null
    let response: Response | undefined = undefined

    if (defaultHeaders) fetchOptions.headers = { ...(fetchOptions.headers || {}), ...defaultHeaders }

    if (!IDEMPOTENT_HTTP_METHODS.includes(method.toUpperCase())) attempts = 1

    do {
      try {
        if (timeout) {
          timer = setTimeout(() => {
            controller.abort()
          }, timeout)
        }

        const fetchPromise = crossFetch.default(url.toString(), {
          ...fetchOptions,
          method,
          signal: timeoutSignal
        } as any)

        const racePromise = Promise.race([
          fetchPromise,
          new Promise((resolve, _) => {
            timeoutSignal.addEventListener('abort', () => {
              resolve(new Response('timeout', { status: 408, statusText: 'Request Timeout' }))
            })
          })
        ])

        ++currentAttempt

        response = (await racePromise) as any

        if (timer) clearTimeout(timer)
      } finally {
        if (
          !!response &&
          (response.ok || NON_RETRYABLE_STATUS_CODES.includes(response.status) || currentAttempt >= attempts)
        )
          break
        else await new Promise((resolve) => setTimeout(resolve, retryDelay))
      }
    } while ((!response || !response.ok) && currentAttempt < attempts)

    if (!response?.ok) {
      const responseText = await response?.text()
      throw new Error(`Failed to fetch ${url}. Got status ${response?.status}. Response was '${responseText}'`)
    }

    return timeoutSignal.aborted ? undefined : (response as any)
  }

  return { fetch }
}

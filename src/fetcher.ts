import * as crossFetch from 'cross-fetch'
import * as nodeFetch from 'node-fetch'
import { IFetchComponent, RequestOptions } from '@well-known-components/interfaces'

const NON_RETRYABLE_STATUS_CODES = [400, 401, 403, 404]
const IDEMPOTENT_HTTP_METHODS = ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE']

async function fetchWithRetriesAndTimeout(
  url: nodeFetch.RequestInfo,
  options: RequestOptions
): Promise<nodeFetch.Response> {
  const { timeout, abortController, signal: timeoutSignal, retryDelay } = options
  let attempts = options.attempts!
  let timer: NodeJS.Timeout | null = null
  let response: Response | undefined = undefined

  do {
    try {
      if (timeout) {
        timer = setTimeout(() => {
          abortController!.abort()
        }, timeout)
      }

      const fetchPromise = crossFetch.default(url.toString(), {
        ...options,
        signal: timeoutSignal
      } as any)

      const racePromise = Promise.race([
        fetchPromise,
        new Promise((resolve, _) => {
          timeoutSignal!.addEventListener('abort', () => {
            resolve(new Response('timeout', { status: 408, statusText: 'Request Timeout' }))
          })
        })
      ])

      --attempts

      response = (await racePromise) as any

      if (timer) clearTimeout(timer)
    } finally {
      if (!!response && (response.ok || NON_RETRYABLE_STATUS_CODES.includes(response.status) || attempts === 0)) break
      else await new Promise((resolve) => setTimeout(resolve, retryDelay))
    }
  } while ((!response || !response.ok) && attempts > 0)

  return response as any
}

/**
 * @public
 * Creates a fetch component
 * @param defaultHeaders - default headers to be injected on every call performed by this component
 */
export function createFetchComponent(defaultHeaders?: HeadersInit): IFetchComponent {
  async function fetch(url: nodeFetch.RequestInfo, options?: RequestOptions): Promise<nodeFetch.Response> {
    // Parse options
    const { timeout, method = 'GET', retryDelay = 0, abortController, ...fetchOptions } = options || {}
    let attempts = fetchOptions.attempts || 1
    const controller = abortController || new AbortController()
    const { signal } = controller

    // Add default headers
    if (defaultHeaders) fetchOptions.headers = { ...(fetchOptions.headers || {}), ...defaultHeaders } as any

    // Fix attempts in case of POST
    if (!IDEMPOTENT_HTTP_METHODS.includes(method.toUpperCase())) attempts = 1

    // Fetch with retries and timeout
    const response = await fetchWithRetriesAndTimeout(url, {
      ...fetchOptions,
      attempts,
      method,
      timeout,
      retryDelay,
      signal: signal as any,
      abortController: controller
    })

    // Throw in case of error
    if (!response?.ok) {
      const responseText = await response?.text()
      throw new Error(`Failed to fetch ${url}. Got status ${response?.status}. Response was '${responseText}'`)
    }

    // Parse response in case of abortion
    return signal.aborted ? undefined : (response as any)
  }

  return { fetch }
}
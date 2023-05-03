import * as nodeFetch from 'node-fetch'

export type RequestOptions = nodeFetch.RequestInit & {
  abortController?: AbortController
  timeout?: number
  attempts?: number
  retryDelay?: number
}

import { createFetchComponent } from './types'

/**
 * A function that does something
 * @public
 */
async function example() {
  const fetcher = createFetchComponent()
  const controller = new AbortController()

  const fetchPromise = fetcher.fetch('https://httpstat.us/200?sleep=1000', { abortController: controller } as any)
  controller.abort()
  const response = await fetchPromise
  console.log({ response })
}

example().then(console.log).catch(console.log)
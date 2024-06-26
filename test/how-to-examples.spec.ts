import { createFetchComponent } from './../src/fetcher'

describe('How to', () => {
  it('abort a request', async () => {
    // Creates fetcher
    const fetcher = createFetchComponent()

    // Creates AbortController
    const controller = new AbortController()

    // Trigger fetch and pass AbortController
    const fetchPromise = fetcher.fetch('https://httpstat.us/201?sleep=3000', { abortController: controller } as any)

    // Abort fetch using AbortController
    controller.abort()

    // Fetch is not done, undefined response is returned
    await expect(fetchPromise).rejects.toThrow('Request aborted (timed out)')
  })

  it('buffer a response', async () => {
    const fetcher = createFetchComponent()

    const response = await (await fetcher.fetch('https://httpstat.us/200?sleep=100')).arrayBuffer()
    const bufferedResponse = Buffer.from(response)

    expect(bufferedResponse).toBeDefined()
  })
})

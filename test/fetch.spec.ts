import { IFetchComponent } from '@well-known-components/interfaces'
import { createFetchComponent, RequestOptions } from './../src/types'

import fetchMock from 'jest-fetch-mock'

jest.setMock('cross-fetch', fetchMock)

describe('fetchComponent', () => {
  let sut: IFetchComponent

  beforeEach(() => {
    sut = createFetchComponent()
    jest.resetAllMocks()
  })

  it('should make a successful request', async () => {
    const expectedResponseBody = { mock: 'successful' }

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(expectedResponseBody), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    )

    const response = await (await sut.fetch('https://example.com')).json()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(response).toEqual(expectedResponseBody)
  })

  it('should return successful response from second attempt when first one fails', async () => {
    const expectedResponseBody = { mock: 'successful' }

    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'error' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(expectedResponseBody), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )

    const response = await (
      await sut.fetch('https://example.com', {
        attempts: 3,
        retryDelay: 100
      } as any)
    ).json()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(response).toEqual(expectedResponseBody)
  })

  it('should throw an error when all retries fail', async () => {
    fetchMock.mockResolvedValue(
      new Response('test error', {
        status: 503,
        headers: { 'Content-Type': 'text/plain' }
      })
    )

    await expect(
      sut.fetch('https://example.com', {
        attempts: 3,
        retryDelay: 10
      } as any)
    ).rejects.toThrow(`Failed to fetch https://example.com. Got status 503. Response was 'test error'`)

    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('should throw a timeout error when the timeout threshold is reached', async () => {
    let timer = undefined
    fetchMock.mockImplementation(() => {
      return new Promise((resolve) => {
        timer = setTimeout(
          () =>
            resolve(
              new Response('success', {
                status: 201,
                headers: { 'Content-Type': 'text/plain' }
              })
            ),
          3500
        )
      })
    })

    await expect(
      sut.fetch('https://example.com', {
        timeout: 500
      } as any)
    ).rejects.toThrow(`Failed to fetch https://example.com. Got status 408. Response was 'timeout'`)

    clearTimeout(timer)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('should make a successful request if timeout threshold is not reached', async () => {
    const expectedResponseBody = { mock: 'successful' }

    fetchMock.mockImplementation(() => {
      return new Promise((resolve) => {
        setTimeout(
          () =>
            resolve(
              new Response(JSON.stringify(expectedResponseBody), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
              })
            ),
          2000
        )
      })
    })

    const response = await (await sut.fetch('https://example.com', { timeout: 3000 } as any)).json()

    expect(response).toEqual(expectedResponseBody)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  function hasHeader(headers: HeadersInit, headerKey: string): boolean {
    if (headers instanceof Headers) {
      return headers.has(headerKey)
    } else if (Array.isArray(headers)) {
      return headers.some(([key]) => key === headerKey)
    } else {
      return headerKey in headers
    }
  }

  it('should make a successful request with defaultHeaders', async () => {
    const customHeader = { 'X-Custom': 'Test' }

    sut = createFetchComponent(customHeader)

    fetchMock.mockResolvedValue(
      new Response('test', {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    )

    await sut.fetch('https://example.com')

    expect(fetchMock.mock.calls[0][1].headers).toEqual(customHeader)
  })
})

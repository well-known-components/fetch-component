import { IFetchComponent } from '@well-known-components/interfaces'
import { createFetchComponent } from './../src/fetcher'
import * as environment from '../src/environment'

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

  it('should not throw an error when all retries fail but return latest response', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response('test error', {
          status: 502,
          headers: { 'Content-Type': 'text/plain' }
        })
      )
      .mockResolvedValue(
        new Response('test error', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' }
        })
      )

    const response = await sut.fetch('https://example.com', {
      attempts: 3,
      retryDelay: 10
    } as any)

    expect(response instanceof Response).toBe(true)
    expect(response.status).toBe(503)
    expect(response.statusText).toBe('Service Unavailable')
    const bodyBuffer = await response.buffer()
    expect(bodyBuffer.toString()).toBe('test error')

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
    ).rejects.toThrow('Request aborted (timed out)')

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

  it('should make a successful request with defaultHeaders', async () => {
    const customHeader = { 'X-Custom': 'Test' }

    sut = createFetchComponent({ defaultHeaders: customHeader })

    fetchMock.mockResolvedValue(
      new Response('test', {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    )

    await sut.fetch('https://example.com')

    expect(fetchMock.mock.calls[0][1].headers).toEqual(customHeader)
  })

  it('should successfully override a defaultHeaders when the fetcher is called with the same option', async () => {
    const overwrittenHeader = { 'X-Custom': 'Override' }

    sut = createFetchComponent({ defaultHeaders: { 'X-Custom': 'Test' } })

    fetchMock.mockResolvedValue(
      new Response('test', {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    )

    await sut.fetch('https://example.com', { headers: overwrittenHeader })

    expect(fetchMock.mock.calls[0][1].headers).toEqual(overwrittenHeader)
  })

  // Setting a default body is not a valid use case, anyways this test is only to validate
  // that the default options are taking into account
  it('should make a successful request with defaultFetcherOptions', async () => {
    const defaultBodyOption = JSON.stringify({ test: 'test' })

    sut = createFetchComponent({ defaultFetcherOptions: { body: defaultBodyOption } })

    fetchMock.mockResolvedValue(
      new Response('test', {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    )

    await sut.fetch('https://example.com')

    expect(fetchMock.mock.calls[0][1].body).toEqual(defaultBodyOption)
  })

  it('should successfully override a defaultFetcherOptions when the fetcher is called with the same option', async () => {
    const overwrittenBody = JSON.stringify({ overwritten: 'overwritten' })

    sut = createFetchComponent({ defaultFetcherOptions: { body: JSON.stringify({ test: 'test' }) } })

    fetchMock.mockResolvedValue(
      new Response('test', {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    )

    await sut.fetch('https://example.com', { body: overwrittenBody })

    expect(fetchMock.mock.calls[0][1].body).toEqual(overwrittenBody)
  })

  it('should not retry when performing a POST', async () => {
    const expectedResponseBody = { mock: 'successful' }

    fetchMock
      .mockResolvedValueOnce(
        new Response('test error', {
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

    const response = await sut.fetch('https://example.com', {
      method: 'POST',
      attempts: 3,
      retryDelay: 10
    } as any)

    expect(response instanceof Response).toBe(true)
    expect(response.status).toBe(503)
    expect(response.statusText).toBe('Service Unavailable')
    const bodyBuffer = await response.buffer()
    expect(bodyBuffer.toString()).toBe('test error')

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('should not retry when receiving a 400 status code error', async () => {
    const expectedResponseBody = { mock: 'successful' }

    fetchMock
      .mockResolvedValueOnce(
        new Response('test error', {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(expectedResponseBody), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )

    const response = await sut.fetch('https://example.com', {
      attempts: 3,
      retryDelay: 10
    } as any)

    expect(response instanceof Response).toBe(true)
    expect(response.status).toBe(400)
    expect(response.statusText).toBe('Bad Request')
    const bodyBuffer = await response.buffer()
    expect(bodyBuffer.toString()).toBe('test error')

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('should not retry when receiving a 401 status code error', async () => {
    const expectedResponseBody = { mock: 'successful' }

    fetchMock
      .mockResolvedValueOnce(
        new Response('test error', {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(expectedResponseBody), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )

    const response = await sut.fetch('https://example.com', {
      attempts: 3,
      retryDelay: 10
    } as any)

    expect(response instanceof Response).toBe(true)
    expect(response.status).toBe(401)
    expect(response.statusText).toBe('Unauthorized')
    const bodyBuffer = await response.buffer()
    expect(bodyBuffer.toString()).toBe('test error')

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('should not retry when receiving a 403 status code error', async () => {
    const expectedResponseBody = { mock: 'successful' }

    fetchMock
      .mockResolvedValueOnce(
        new Response('test error', {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(expectedResponseBody), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )

    const response = await sut.fetch('https://example.com', {
      attempts: 3,
      retryDelay: 10
    } as any)

    expect(response instanceof Response).toBe(true)
    expect(response.status).toBe(403)
    expect(response.statusText).toBe('Forbidden')
    const bodyBuffer = await response.buffer()
    expect(bodyBuffer.toString()).toBe('test error')

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('should not retry when receiving a 404 status code error', async () => {
    const expectedResponseBody = { mock: 'successful' }

    fetchMock
      .mockResolvedValueOnce(
        new Response('test error', {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(expectedResponseBody), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )

    const response = await sut.fetch('https://example.com', {
      attempts: 3,
      retryDelay: 10
    } as any)

    expect(response instanceof Response).toBe(true)
    expect(response.status).toBe(404)
    expect(response.statusText).toBe('Not Found')
    const bodyBuffer = await response.buffer()
    expect(bodyBuffer.toString()).toBe('test error')

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('should expose .buffer function even when it is not called from a Node environment', async () => {
    const expectedResponseBody = { mock: 'successful', ok: true }
    jest.spyOn(environment, 'isUsingNode').mockReturnValue(false)

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(expectedResponseBody), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    )

    const response = await sut.fetch('https://example.com', {
      attempts: 3,
      retryDelay: 10
    } as any)

    expect(response).toBeDefined()
    expect(response.buffer).toBeDefined()
  })

  it('should read buffer correctly from .buffer function even when it is not called from a Node environment', async () => {
    const expectedResponseBody = { mock: 'successful', ok: true }
    jest.spyOn(environment, 'isUsingNode').mockReturnValue(false)

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(expectedResponseBody), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    )

    const response = await sut.fetch('https://example.com', {
      attempts: 3,
      retryDelay: 10
    } as any)

    const bufferedResponse = await response.buffer()

    const parsedBufferedResponse = JSON.parse(bufferedResponse.toString())
    expect(parsedBufferedResponse).toEqual(expectedResponseBody)
  })
})

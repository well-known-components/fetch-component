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

  // it.only('should allow setting a timeout for the request', async () => {
  //     fetchMock.mockImplementation(() => {
  //         return new Promise((resolve) => setTimeout(() => resolve(new Response('success', {
  //             status: 200,
  //             headers: { 'Content-Type': 'text/plain' }
  //         })), 1500))
  //     })

  //     await expect(
  //         sut.fetch('https://example.com', {
  //         timeout: 500,
  //     } as any)
  //     ).rejects.toThrow('timeout')

  //     expect(fetchMock).toHaveBeenCalledTimes(1)
  // })

  // it('should allow aborting the request', async () => {
  //     const controller = new AbortController()
  //     const fetchSpy = jest.spyOn(crossFetch, 'default').mockImplementation(() => {
  //     return new Promise((resolve) => setTimeout(() => resolve(new Response()), 5000))
  //     })

  //     setTimeout(() => {
  //     controller.abort()
  //     }, 100)

  //     await expect(
  //     fetchComponent.fetch('https://example.com', {
  //         signal: controller.signal,
  //     })
  //     ).rejects.toThrow('aborted')

  //     expect(fetchSpy).toHaveBeenCalledWith('https://example.com', { signal: controller.signal })
  // })
})

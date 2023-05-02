const fetchMock = require('jest-fetch-mock')

// eslint-disable-next-line no-undef
jest.setMock('cross-fetch', fetchMock)

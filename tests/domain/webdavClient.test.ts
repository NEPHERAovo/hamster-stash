import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebDavClient, type WebDavConfig } from '../../src/domain/sync/webdavClient';

describe('WebDavClient', () => {
  let client: WebDavClient;

  beforeEach(() => {
    client = new WebDavClient();
    vi.restoreAllMocks();
  });

  it('routes requests through builtin proxy by default with X-Target-URL header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const config: WebDavConfig = {
      url: 'https://dav.jianguoyun.com/dav/',
      username: 'user@example.com',
      password: 'token-password',
      proxyMode: 'builtin',
    };

    const connected = await client.testConnection(config);
    expect(connected).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [calledUrl, calledInit] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe('/api/webdav');
    const headers = calledInit.headers as Headers;
    expect(headers.get('X-Target-URL')).toBe('https://dav.jianguoyun.com/dav');
    expect(headers.get('Authorization')).toContain('Basic ');
  });

  it('routes directly to target server when proxyMode is direct', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 207 }));
    vi.stubGlobal('fetch', fetchMock);

    const config: WebDavConfig = {
      url: 'https://dav.jianguoyun.com/dav/',
      username: 'user@example.com',
      password: 'token-password',
      proxyMode: 'direct',
    };

    const connected = await client.testConnection(config);
    expect(connected).toBe(true);

    const [calledUrl, calledInit] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe('https://dav.jianguoyun.com/dav');
    expect(calledInit.headers['Depth']).toBe('0');
  });

  it('routes to custom proxy endpoint when proxyMode is custom and url is configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const config: WebDavConfig = {
      url: 'https://dav.jianguoyun.com/dav/',
      username: 'user@example.com',
      password: 'token-password',
      proxyMode: 'custom',
      customProxyUrl: 'https://dav-proxy.naera.dev/',
    };

    const connected = await client.testConnection(config);
    expect(connected).toBe(true);

    const [calledUrl, calledInit] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe('https://dav-proxy.naera.dev');
    const headers = calledInit.headers as Headers;
    expect(headers.get('X-Target-URL')).toBe('https://dav.jianguoyun.com/dav');
  });

  it('formats helpful error message when TypeError occurs due to CORS', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    const config: WebDavConfig = {
      url: 'https://dav.jianguoyun.com/dav/',
      username: 'user@example.com',
      password: 'token-password',
      proxyMode: 'direct',
    };

    await expect(client.testConnection(config)).rejects.toThrow('CORS Error');
  });
});

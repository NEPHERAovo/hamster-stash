import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebDavClient, type WebDavConfig } from '../../src/domain/sync/webdavClient';

describe('WebDavClient', () => {
  let client: WebDavClient;

  beforeEach(() => {
    client = new WebDavClient();
    vi.restoreAllMocks();
  });

  it('routes requests through builtin proxy with X-Target-URL and X-Requested-With headers', async () => {
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
    expect(headers.get('X-Requested-With')).toBe('XMLHttpRequest');
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

  it('routes to custom proxy endpoint with query param and custom headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const config: WebDavConfig = {
      url: 'https://dav.jianguoyun.com/dav/',
      username: 'user@example.com',
      password: 'token-password',
      proxyMode: 'custom',
      customProxyUrl: 'https://dav-proxy.naera.dev/',
      customHeaders: {
        'CF-Access-Client-Id': 'client-123',
        'X-Proxy-Key': 'secret-key',
      },
    };

    const connected = await client.testConnection(config);
    expect(connected).toBe(true);

    const [calledUrl, calledInit] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe('https://dav-proxy.naera.dev?url=https%3A%2F%2Fdav.jianguoyun.com%2Fdav');
    const headers = calledInit.headers as Headers;
    expect(headers.get('X-Target-URL')).toBe('https://dav.jianguoyun.com/dav');
    expect(headers.get('X-Requested-With')).toBe('XMLHttpRequest');
    expect(headers.get('CF-Access-Client-Id')).toBe('client-123');
    expect(headers.get('X-Proxy-Key')).toBe('secret-key');
  });

  it('replaces url placeholder when present in customProxyUrl', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const config: WebDavConfig = {
      url: 'https://dav.jianguoyun.com/dav/',
      username: 'user@example.com',
      password: 'token-password',
      proxyMode: 'custom',
      customProxyUrl: 'https://dav-proxy.naera.dev/proxy/{url}',
    };

    const connected = await client.testConnection(config);
    expect(connected).toBe(true);

    const [calledUrl] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe('https://dav-proxy.naera.dev/proxy/https%3A%2F%2Fdav.jianguoyun.com%2Fdav');
  });

  it('throws descriptive error on 401 Unauthorized without triggering native browser basic auth', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    const config: WebDavConfig = {
      url: 'https://dav.jianguoyun.com/dav/',
      username: 'user@example.com',
      password: 'wrong-password',
      proxyMode: 'builtin',
    };

    await expect(client.testConnection(config)).rejects.toThrow('401 Unauthorized');
  });

  it('throws descriptive error on 502 Bad Gateway', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 502 }));
    vi.stubGlobal('fetch', fetchMock);

    const config: WebDavConfig = {
      url: 'https://dav.jianguoyun.com/dav/',
      username: 'user@example.com',
      password: 'token-password',
      proxyMode: 'builtin',
    };

    await expect(client.testConnection(config)).rejects.toThrow('502 Bad Gateway');
  });

  it('reports network error instead of false CORS error when builtin proxy fails', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    const config: WebDavConfig = {
      url: 'https://dav.jianguoyun.com/dav/',
      username: 'user@example.com',
      password: 'token-password',
      proxyMode: 'builtin',
    };

    await expect(client.testConnection(config)).rejects.toThrow('网络连接异常或代理服务暂时不可达');
    await expect(client.testConnection(config)).rejects.not.toThrow('CORS');
  });

  it('reports CORS and direct connection advice when direct mode fails', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    const config: WebDavConfig = {
      url: 'https://dav.jianguoyun.com/dav/',
      username: 'user@example.com',
      password: 'token-password',
      proxyMode: 'direct',
    };

    await expect(client.testConnection(config)).rejects.toThrow('CORS');
  });
});

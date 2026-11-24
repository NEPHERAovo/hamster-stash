export type WebDavProxyMode = 'direct' | 'builtin' | 'custom';

export interface WebDavConfig {
  url: string;
  username: string;
  password: string;
  syncPath?: string;
  proxyMode?: WebDavProxyMode;
  customProxyUrl?: string;
  customHeaders?: Record<string, string>;
}

export class WebDavClient {
  private getAuthHeader(config: WebDavConfig): string {
    const raw = `${config.username}:${config.password}`;
    try {
      return `Basic ${btoa(unescape(encodeURIComponent(raw)))}`;
    } catch {
      return `Basic ${btoa(raw)}`;
    }
  }

  private resolveUrl(config: WebDavConfig, filename: string): string {
    const baseUrl = config.url.trim().replace(/\/+$/, '');
    const dir = (config.syncPath || '').trim().replace(/^\/+/, '').replace(/\/+$/, '');
    const file = filename.trim().replace(/^\/+/, '');
    if (dir) {
      return `${baseUrl}/${dir}/${file}`;
    }
    return `${baseUrl}/${file}`;
  }

  private isCorsOrNetworkError(e: unknown): boolean {
    if (e instanceof TypeError) {
      const msg = e.message.toLowerCase();
      return (
        msg.includes('failed to fetch') ||
        msg.includes('networkerror') ||
        msg.includes('network error') ||
        msg.includes('cors') ||
        msg.includes('load failed')
      );
    }
    return false;
  }

  private async executeFetch(
    config: WebDavConfig,
    targetUrl: string,
    init: RequestInit
  ): Promise<Response> {
    const proxyMode = config.proxyMode || 'builtin';

    if (proxyMode === 'builtin') {
      const proxyEndpoint = '/api/webdav';
      const headers = new Headers(init.headers);
      headers.set('X-Target-URL', targetUrl);
      headers.set('X-Requested-With', 'XMLHttpRequest');
      if (config.customHeaders) {
        for (const [k, v] of Object.entries(config.customHeaders)) {
          if (k.trim() && v) headers.set(k.trim(), v);
        }
      }
      return fetch(proxyEndpoint, {
        ...init,
        headers,
      });
    }

    if (proxyMode === 'custom' && config.customProxyUrl) {
      let proxyEndpoint = config.customProxyUrl.trim();
      const headers = new Headers(init.headers);
      headers.set('X-Target-URL', targetUrl);
      headers.set('X-Requested-With', 'XMLHttpRequest');
      if (config.customHeaders) {
        for (const [k, v] of Object.entries(config.customHeaders)) {
          if (k.trim() && v) headers.set(k.trim(), v);
        }
      }

      if (proxyEndpoint.includes('{url}') || proxyEndpoint.includes('{target}')) {
        proxyEndpoint = proxyEndpoint.replace(/\{url\}|\{target\}/g, encodeURIComponent(targetUrl));
      } else {
        const separator = proxyEndpoint.includes('?') ? '&' : '?';
        proxyEndpoint = `${proxyEndpoint.replace(/\/+$/, '')}${separator}url=${encodeURIComponent(targetUrl)}`;
      }

      return fetch(proxyEndpoint, {
        ...init,
        headers,
      });
    }

    return fetch(targetUrl, init);
  }

  async testConnection(config: WebDavConfig): Promise<boolean> {
    const baseUrl = config.url.trim().replace(/\/+$/, '');
    const headers = {
      Authorization: this.getAuthHeader(config),
      Depth: '0',
    };

    try {
      let resp = await this.executeFetch(config, baseUrl, {
        method: 'PROPFIND',
        headers,
      });

      if (resp.status === 405 || resp.status === 501) {
        resp = await this.executeFetch(config, baseUrl, {
          method: 'GET',
          headers: { Authorization: this.getAuthHeader(config) },
        });
      }

      return resp.ok || resp.status === 207;
    } catch (e) {
      if (this.isCorsOrNetworkError(e)) {
        throw new Error('WebDAV 连接失败：跨域请求受阻 (CORS Error)。坚果云等公有网盘未配置浏览器跨域允许头，直连会被拦截。可切换为「内置代理」或配置自建代理中转。', { cause: e });
      }
      throw new Error(`连接 WebDAV 失败：${e instanceof Error ? e.message : '网络或跨域受阻'}`, { cause: e });
    }
  }

  async fetchFile(config: WebDavConfig, filename: string): Promise<string | null> {
    const targetUrl = this.resolveUrl(config, filename);
    const headers = {
      Authorization: this.getAuthHeader(config),
    };

    try {
      const resp = await this.executeFetch(config, targetUrl, {
        method: 'GET',
        headers,
      });

      if (resp.status === 404) {
        return null;
      }

      if (!resp.ok) {
        throw new Error(`WebDAV GET 失败 (HTTP ${resp.status}): ${resp.statusText}`);
      }

      return await resp.text();
    } catch (e) {
      if (e instanceof Error && e.message.includes('404')) {
        return null;
      }
      if (this.isCorsOrNetworkError(e)) {
        throw new Error('WebDAV 读取失败：跨域限制 (CORS Error)。目标服务器未开放浏览器跨域响应头，可切换为「内置代理」或使用自建代理。', { cause: e });
      }
      throw e;
    }
  }

  async fileExists(config: WebDavConfig, filename: string): Promise<boolean> {
    const targetUrl = this.resolveUrl(config, filename);
    const headers = {
      Authorization: this.getAuthHeader(config),
    };
    try {
      const headResp = await this.executeFetch(config, targetUrl, { method: 'HEAD', headers });
      if (headResp.ok) return true;
      if (headResp.status === 404) return false;
      if (headResp.status === 405 || headResp.status === 501) {
        const propResp = await this.executeFetch(config, targetUrl, {
          method: 'PROPFIND',
          headers: { ...headers, Depth: '0' },
        });
        return propResp.ok || propResp.status === 207;
      }
      return false;
    } catch {
      return false;
    }
  }

  async putFile(config: WebDavConfig, filename: string, content: string): Promise<void> {
    const targetUrl = this.resolveUrl(config, filename);
    const headers = {
      Authorization: this.getAuthHeader(config),
      'Content-Type': 'application/json; charset=utf-8',
    };

    let resp: Response;
    try {
      resp = await this.executeFetch(config, targetUrl, {
        method: 'PUT',
        headers,
        body: content,
      });
    } catch (e) {
      if (this.isCorsOrNetworkError(e)) {
        throw new Error('WebDAV 写入失败：跨域限制 (CORS Error)。目标服务器未开放浏览器跨域响应头，可切换为「内置代理」或使用自建代理。', { cause: e });
      }
      throw e;
    }

    if (resp.status === 409) {
      await this.ensureParentDir(config, filename);
      const retryResp = await this.executeFetch(config, targetUrl, {
        method: 'PUT',
        headers,
        body: content,
      });
      if (!retryResp.ok && retryResp.status !== 201 && retryResp.status !== 204) {
        throw new Error(`WebDAV PUT 写入失败 (HTTP ${retryResp.status})`);
      }
      return;
    }

    if (!resp.ok && resp.status !== 201 && resp.status !== 204) {
      throw new Error(`WebDAV PUT 写入失败 (HTTP ${resp.status}): ${resp.statusText}`);
    }
  }

  private async ensureParentDir(config: WebDavConfig, filename?: string): Promise<void> {
    const baseUrl = config.url.trim().replace(/\/+$/, '');
    const dir = (config.syncPath || '').trim().replace(/^\/+/, '').replace(/\/+$/, '');
    const fileDir = filename
      ? filename
          .trim()
          .replace(/^\/+/, '')
          .split('/')
          .slice(0, -1)
          .join('/')
      : '';
    const combinedDir = [dir, fileDir].filter(Boolean).join('/');
    if (!combinedDir) return;

    const parts = combinedDir.split('/').filter(Boolean);
    let current = baseUrl;
    for (const part of parts) {
      current = `${current}/${part}`;
      try {
        await this.executeFetch(config, current, {
          method: 'MKCOL',
          headers: { Authorization: this.getAuthHeader(config) },
        });
      } catch {
        void 0;
      }
    }
  }
}

export const webdavClient = new WebDavClient();

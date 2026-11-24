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
    let dir = (config.syncPath || '').trim().replace(/^\/+/, '').replace(/\/+$/, '');

    if (dir && baseUrl.toLowerCase().endsWith(`/${dir.toLowerCase()}`)) {
      dir = '';
    }

    if (!dir && (baseUrl.endsWith('/dav') || !baseUrl.includes('/dav/'))) {
      dir = 'hamsterstash';
    }

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

  private async handleHttpError(resp: Response, action: string, errorBody?: string): Promise<never> {
    const body = errorBody !== undefined ? errorBody : await resp.text().catch(() => '');
    if (body.includes('AncestorsNotFound')) {
      throw new Error(`WebDAV ${action}失败：目标网盘上层文件夹不存在 (AncestorsNotFound)。已尝试自动创建但未能成功，请检查服务器地址与路径设置。`);
    }
    if (resp.status === 401) {
      throw new Error(`WebDAV ${action}失败 (401 Unauthorized)：账号或密码错误，请检查授权凭据`);
    }
    if (resp.status === 403) {
      throw new Error(`WebDAV ${action}失败 (403 Forbidden)：无权访问该路径或应用密码受限`);
    }
    if (resp.status === 404) {
      throw new Error(`WebDAV ${action}失败 (404 Not Found)：服务器地址或路径不存在`);
    }
    if (resp.status === 502) {
      throw new Error(`WebDAV ${action}失败 (502 Bad Gateway)：代理网关无法连通目标网盘，请检查地址或网络`);
    }
    throw new Error(`WebDAV ${action}失败 (HTTP ${resp.status}): ${resp.statusText || '服务异常'}`);
  }

  private handleNetworkError(e: unknown, config: WebDavConfig, action: string): never {
    if (e instanceof Error && !this.isCorsOrNetworkError(e)) {
      throw e;
    }
    const mode = config.proxyMode || 'builtin';
    if (mode === 'builtin') {
      throw new Error(`WebDAV ${action}失败：网络连接异常或代理服务暂时不可达，请检查网络设置。`, { cause: e });
    }
    if (mode === 'custom') {
      throw new Error(`WebDAV ${action}失败：无法连通自建代理网关，请检查代理地址是否正确及跨域响应头。`, { cause: e });
    }
    throw new Error(`WebDAV ${action}失败：网络异常或目标网盘未开启浏览器跨域 (CORS)。可切换为「内置代理」模式。`, { cause: e });
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
      let resp = await this.executeFetch(config, `${baseUrl}/`, {
        method: 'PROPFIND',
        headers,
      });

      if (resp.status === 405 || resp.status === 501) {
        resp = await this.executeFetch(config, `${baseUrl}/`, {
          method: 'GET',
          headers: { Authorization: this.getAuthHeader(config) },
        });
      }

      if (resp.ok || resp.status === 207) {
        await this.ensureParentDir(config);
        return true;
      }

      await this.handleHttpError(resp, '连接');
      return false;
    } catch (e) {
      this.handleNetworkError(e, config, '连接');
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
        const errorText = await resp.text().catch(() => '');
        if (errorText.includes('AncestorsNotFound') || resp.status === 409) {
          return null;
        }
        await this.handleHttpError(resp, '读取', errorText);
        return null;
      }

      return await resp.text();
    } catch (e) {
      if (e instanceof Error && e.message.includes('404')) {
        return null;
      }
      this.handleNetworkError(e, config, '读取');
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
      this.handleNetworkError(e, config, '写入');
    }

    if (!resp.ok && resp.status !== 201 && resp.status !== 204) {
      await this.ensureParentDir(config, filename);
      let retryResp: Response;
      try {
        retryResp = await this.executeFetch(config, targetUrl, {
          method: 'PUT',
          headers,
          body: content,
        });
      } catch (e) {
        this.handleNetworkError(e, config, '写入');
      }
      if (retryResp.ok || retryResp.status === 201 || retryResp.status === 204) {
        return;
      }
      await this.handleHttpError(retryResp, '写入');
      return;
    }
  }

  async ensureParentDir(config: WebDavConfig, filename?: string): Promise<void> {
    const baseUrl = config.url.trim().replace(/\/+$/, '');
    let dir = (config.syncPath || '').trim().replace(/^\/+/, '').replace(/\/+$/, '');

    if (dir && baseUrl.toLowerCase().endsWith(`/${dir.toLowerCase()}`)) {
      dir = '';
    }

    if (!dir && (baseUrl.endsWith('/dav') || !baseUrl.includes('/dav/'))) {
      dir = 'hamsterstash';
    }

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
        await this.executeFetch(config, `${current}/`, {
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

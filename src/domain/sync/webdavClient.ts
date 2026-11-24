export interface WebDavConfig {
  url: string;
  username: string;
  password: string;
  syncPath?: string;
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

  async testConnection(config: WebDavConfig): Promise<boolean> {
    const baseUrl = config.url.trim().replace(/\/+$/, '');
    const headers = {
      Authorization: this.getAuthHeader(config),
      Depth: '0',
    };

    try {
      let resp = await fetch(baseUrl, {
        method: 'PROPFIND',
        headers,
      });

      if (resp.status === 405 || resp.status === 501) {
        resp = await fetch(baseUrl, {
          method: 'GET',
          headers: { Authorization: this.getAuthHeader(config) },
        });
      }

      return resp.ok || resp.status === 207;
    } catch (e) {
      if (this.isCorsOrNetworkError(e)) {
        throw new Error('WebDAV 连接失败：跨域请求受阻 (CORS Error)。坚果云等公有网盘未配置浏览器跨域允许头，纯前端 PWA 无法直接连接。建议配置 Cloudflare Worker 反向代理或改用支持 CORS 的 WebDAV（如 Alist / Nextcloud）。', { cause: e });
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
      const resp = await fetch(targetUrl, {
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
        throw new Error('WebDAV 读取失败：跨域限制 (CORS Error)。服务器未开放浏览器跨域响应头，请通过反向代理中转或使用支持 CORS 的 WebDAV 服务。', { cause: e });
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
      const headResp = await fetch(targetUrl, { method: 'HEAD', headers });
      if (headResp.ok) return true;
      if (headResp.status === 404) return false;
      if (headResp.status === 405 || headResp.status === 501) {
        const propResp = await fetch(targetUrl, {
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
      resp = await fetch(targetUrl, {
        method: 'PUT',
        headers,
        body: content,
      });
    } catch (e) {
      if (this.isCorsOrNetworkError(e)) {
        throw new Error('WebDAV 写入失败：跨域限制 (CORS Error)。服务器未开放浏览器跨域响应头，请通过反向代理中转或使用支持 CORS 的 WebDAV 服务。', { cause: e });
      }
      throw e;
    }

    if (resp.status === 409) {
      await this.ensureParentDir(config, filename);
      const retryResp = await fetch(targetUrl, {
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
        await fetch(current, {
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

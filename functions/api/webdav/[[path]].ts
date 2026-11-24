interface EventContext {
  request: Request;
}

export async function onRequest(context: EventContext): Promise<Response> {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, DELETE, OPTIONS, PROPFIND, MKCOL, MOVE, COPY, LOCK, UNLOCK',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, Depth, If-Match, If-None-Match, Lock-Token, Timeout, Destination, Overwrite, X-Target-URL, X-Requested-With, *',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const targetHeader = request.headers.get('x-target-url');
  const url = new URL(request.url);
  const targetUrl = targetHeader || url.searchParams.get('url');

  if (!targetUrl || (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://'))) {
    return new Response(
      JSON.stringify({
        error: 'Missing or invalid target URL',
        hint: 'Provide target URL via X-Target-URL header or ?url= parameter',
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  const newHeaders = new Headers();
  const skipHeaders = new Set([
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
    'cf-connecting-ip',
    'cf-ipcountry',
    'cf-ray',
    'cf-visitor',
    'x-target-url',
  ]);

  for (const [key, value] of request.headers.entries()) {
    if (!skipHeaders.has(key.toLowerCase())) {
      newHeaders.set(key, value);
    }
  }

  try {
    const parsedTarget = new URL(targetUrl);
    newHeaders.set('Host', parsedTarget.host);

    const fetchOptions: RequestInit = {
      method: request.method,
      headers: newHeaders,
      redirect: 'follow',
    };

    if (request.method !== 'GET' && request.method !== 'HEAD' && request.body) {
      fetchOptions.body = request.body;
      (fetchOptions as unknown as { duplex: string }).duplex = 'half';
    }

    const response = await fetch(targetUrl, fetchOptions);

    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, DELETE, OPTIONS, PROPFIND, MKCOL, MOVE, COPY, LOCK, UNLOCK');
    responseHeaders.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, Depth, If-Match, If-None-Match, Lock-Token, Timeout, Destination, Overwrite, X-Target-URL, X-Requested-With, *');
    responseHeaders.set('Access-Control-Expose-Headers', '*');
    responseHeaders.delete('www-authenticate');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({
        error: 'WebDAV proxy forward failed',
        message: err instanceof Error ? err.message : String(err),
      }),
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}

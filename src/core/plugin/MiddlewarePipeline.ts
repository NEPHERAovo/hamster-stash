import type { MiddlewareHandler } from './types';

interface RegisteredMiddleware {
  pluginId: string;
  hookName: string;
  handler: MiddlewareHandler;
}

export class MiddlewarePipeline {
  private middlewares: RegisteredMiddleware[] = [];

  use<P = unknown, R = unknown>(
    pluginIdOrHook: string,
    hookNameOrHandler: string | MiddlewareHandler<P, R>,
    handler?: MiddlewareHandler<P, R>
  ): void {
    if (typeof hookNameOrHandler === 'function') {
      this.middlewares.push({
        pluginId: 'anonymous',
        hookName: pluginIdOrHook,
        handler: hookNameOrHandler as MiddlewareHandler,
      });
    } else {
      this.middlewares.push({
        pluginId: pluginIdOrHook,
        hookName: hookNameOrHandler,
        handler: handler as MiddlewareHandler,
      });
    }
  }

  unregisterByPlugin(pluginId: string): void {
    this.middlewares = this.middlewares.filter((m) => m.pluginId !== pluginId);
  }

  async run<P = unknown, R = unknown>(
    hookName: string,
    initialPayload: P,
    finalHandler: (payload: P) => Promise<R>
  ): Promise<R> {
    const chain = this.middlewares.filter((m) => m.hookName === hookName);
    if (chain.length === 0) {
      return finalHandler(initialPayload);
    }

    const context = {
      payload: initialPayload,
      hookName,
    };

    let index = -1;

    const dispatch = async (i: number, overridePayload?: P): Promise<R> => {
      if (i <= index) {
        throw new Error(`next() called multiple times in hook "${hookName}"`);
      }
      index = i;

      if (overridePayload !== undefined) {
        context.payload = overridePayload;
      }

      const middleware = chain[i];
      if (!middleware) {
        return finalHandler(context.payload);
      }

      const nextFn = async (nextPayload?: P) => {
        return dispatch(i + 1, nextPayload);
      };

      return (middleware.handler as MiddlewareHandler<P, R>)(
        {
          payload: context.payload,
          next: nextFn,
        },
        nextFn
      );
    };

    return dispatch(0);
  }
}

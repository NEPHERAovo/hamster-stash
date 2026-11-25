export type MiddlewareRunner = <P = unknown, R = unknown>(
  hookName: string,
  payload: P,
  finalHandler: (payload: P) => Promise<R>
) => Promise<R>;

export type SearchParamsLike<T extends Record<string, unknown>> =
  | T
  | Promise<T>
  | undefined;

export async function resolveSearchParams<T extends Record<string, unknown>>(
  params: SearchParamsLike<T>,
): Promise<T> {
  if (!params) {
    return {} as T;
  }

  if (params instanceof Promise) {
    const resolved = await params;
    return (resolved ?? {}) as T;
  }

  return params;
}

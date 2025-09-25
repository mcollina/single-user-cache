export type BatchLoadFn<Key, Value, Context = any> = (
  keys: Array<Key>,
  context: Context
) => Promise<Array<Value>>

export type SerializeFn<Key> = (key: Key) => string

export interface Options {
  /**
   * cache by default, set to false to just do batching
   * @default true
   */
  cache?: boolean;
  /**
   * unlimited batch size by default, set to a number > 0 to split the batches in chunks
   * @default undefined
   */
  maxBatchSize?: number;
}

export type Cache<MethodMap = {}, Context = any> = MethodMap & {
  readonly ctx?: Context;
}

export class Factory<Context = any, MethodMap extends {} = {}> {
  public constructor ()
  /**
   * Registers a data-fetching function.
   */
  add<MethodName extends string, Key, Value>(
    key: MethodName,
    func: BatchLoadFn<Key, Value, Context>,
    serialize?: SerializeFn<Key>
  ): Factory<
    Context,
    MethodMap & { [M in MethodName]: (key: Key) => Promise<Value> }
  >
  /**
   * Registers a data-fetching function.
   */
  add<MethodName extends string, Key, Value>(
    key: MethodName,
    opts: Options,
    func: BatchLoadFn<Key, Value, Context>,
    serialize?: SerializeFn<Key>
  ): Factory<
    Context,
    MethodMap & { [M in MethodName]: (key: Key) => Promise<Value> }
  >

  /**
   * Creates a cache instance for a single request.
   */
  create (ctx?: Context): Cache<MethodMap, Context>
}

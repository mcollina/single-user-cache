# single-user-cache

A simple cache system for a single user request, built on the same concepts of [data loader](https://github.com/facebook/dataloader).

## Install

```js
npm i single-user-cache
```

## Usage

```js
const { Factory } = require('.')
const factory = new Factory()

factory.add('fetchSomething', {
  // cache by default, set to false to just do batching
  cache: true,
  // unlimited batch size by default, set to a number > 0 to split the batches in chunks
  maxBatchSize: undefined,
}, async (queries, context) => {
  console.log(queries)
  // [ 42, 24 ]

  console.log(context)
  // { some: 'data' }

  return queries.map((k) => {
    return { k }
  })
})

async function run () {
  const context = {
    some: 'data'
  }
  const cache = factory.create(context)

  const p1 = cache.fetchSomething(42)
  const p2 = cache.fetchSomething(24)

  const res = await Promise.all([p1, p2])

  console.log(res)
  // [
  //   { k: 42 },
  //   { k: 24 }
  // ]
}

run().catch(console.log)
```

If the query parameter is an object, its cache key will be generated
using
[safe-stable-stringify](https://github.com/BridgeAR/safe-stable-stringify).

## Benchmarks

Compared to [dataloader](http://npm.im/dataloader), this library is significantly
faster.

```
➜  node benchmark.js
clk: ~4.21 GHz
cpu: Apple M4 Max
runtime: node 22.15.0 (arm64-darwin)

benchmark                   avg (min … max) p75 / p99    (min … top 1%)
------------------------------------------- -------------------------------
dataloader                     1.09 ms/iter   1.30 ms  █
                      (718.92 µs … 2.04 ms)   1.72 ms  █      ▄▂
                    (  2.81 mb …   6.82 mb)   6.73 mb ██▆▂▁▁▂███▇▆▇▅▄▆▂▃▃▃▁

single-user-cache            345.48 µs/iter 337.71 µs  ▄▇█
                    (297.83 µs … 601.96 µs) 526.33 µs ████▃
                    (  1.20 mb …   2.08 mb)   1.85 mb █████▃▁▁▁▁▁▁▁▁▁▁▂▄▅▅▂
```

## License

MIT

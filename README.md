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
  cache: true
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

## License

MIT

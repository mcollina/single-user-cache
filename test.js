'use strict'

const { test } = require('tap')
const { buildSchema, graphql } = require('graphql')
const { Factory } = require('.')
const { makeExecutableSchema } = require('graphql-tools')

const kValues = require('./symbol')

test('create a Factory that batches', async (t) => {
  // plan verifies that fetchSomething is called only once
  t.plan(2)

  const factory = new Factory()

  factory.add('fetchSomething', async (queries) => {
    t.same(queries, [
      42, 24
    ])
    return queries.map((k) => {
      return { k }
    })
  })

  const cache = factory.create()

  const p1 = cache.fetchSomething(42)
  const p2 = cache.fetchSomething(24)

  const res = await Promise.all([p1, p2])

  t.same(res, [
    { k: 42 },
    { k: 24 }
  ])
})

test('create a Factory that dedupes the queries', async (t) => {
  const factory = new Factory()

  factory.add('fetchSomething', async (queries) => {
    t.same(queries, [42])
    return [{ k: 42 }]
  })

  const cache = factory.create()

  const p1 = cache.fetchSomething(42)
  const p2 = cache.fetchSomething(42)

  const res = await Promise.all([p1, p2])

  t.same(res, [
    { k: 42 },
    { k: 42 }
  ])
})

test('create a Factory that dedupes the queries after resolution', async (t) => {
  t.plan(3)

  const factory = new Factory()

  factory.add('fetchSomething', async (queries) => {
    // this tests verifies that the callback is called only once
    t.same(queries, [42])
    return [{ k: 42 }]
  })

  const cache = factory.create()

  t.same(await cache.fetchSomething(42), { k: 42 })
  t.same(await cache.fetchSomething(42), { k: 42 })
})

test('works with GQL', async (t) => {
  const schema = buildSchema(`
    type Person {
      id: String!
      name: String!
      friends: [Person]
    }

    type Query {
      allPeople: [Person]
    }
  `)

  const factory = new Factory()

  factory.add('allPeople', async (_, ctx) => {
    // The external array is needed to match the unwanted, single id.
    return [
      [{
        id: '42',
        name: 'matteo',
        friends: cache.fetchFriends.bind(cache, '42', ctx)
      }, {
        id: '24',
        name: 'marco',
        friends: cache.fetchFriends.bind(cache, '24', ctx)
      }]
    ]
  })

  factory.add('fetchFriends', async (ids, ctx) => {
    // this tests verifies that the callback is called only once
    t.same(ids, ['42', '24'])

    return [[{
      id: '24',
      name: 'marco',
      friends: cache.fetchFriends.bind(cache, '24', ctx)
    }], [{
      id: '42',
      name: 'matteo',
      friends: cache.fetchFriends.bind(cache, '42', ctx)
    }]]
  })

  const root = {
    async allPeople (_, ctx) {
      return ctx.cache.allPeople()
    }
  }

  const cache = factory.create()

  const data = await graphql(schema, `{
    allPeople {
      name,
      friends {
        name
      }
    }
  }`, root, {
    cache
  })

  t.same(data, {
    data: {
      allPeople: [
        {
          name: 'matteo',
          friends: [
            {
              name: 'marco'
            }
          ]
        },
        {
          name: 'marco',
          friends: [
            {
              name: 'matteo'
            }
          ]
        }
      ]
    }
  })
})

test('cache makeSchemaExecutable', async (t) => {
  const factory = new Factory()

  factory.add('fetchSomething', async (queries) => {
    t.same(queries, [42])
    return [42]
  })

  const typeDefs = `
    type Query {
      fetchSomething(x: Int): Int
    }
  `

  const resolvers = {
    Query: {
      fetchSomething: (_, { x }, { cache }) => {
        return cache.fetchSomething(x)
      }
    }
  }

  const schema = makeExecutableSchema({ typeDefs, resolvers })

  const query = '{ fetchSomething(x: 42) }'
  const res = await graphql(schema, query, {}, { cache: factory.create() })
  t.same(res, {
    data: {
      fetchSomething: 42
    }
  })
})

test('support context', async (t) => {
  // plan verifies that fetchSomething is called only once
  t.plan(2)

  const factory = new Factory()
  const expectedCtx = {}

  factory.add('fetchSomething', async (queries, ctx) => {
    t.equal(ctx, expectedCtx)
    return queries.map((k) => {
      return { k }
    })
  })

  const cache = factory.create(expectedCtx)

  const p1 = cache.fetchSomething(42)
  const p2 = cache.fetchSomething(24)

  const res = await Promise.all([p1, p2])

  t.same(res, [
    { k: 42 },
    { k: 24 }
  ])
})

test('cache: false', async (t) => {
  t.plan(4)

  const factory = new Factory()

  factory.add('fetchSomething', { cache: false }, async (queries) => {
    t.same(queries, [42])
    return [{ k: 42 }]
  })

  const cache = factory.create()

  t.same(await cache.fetchSomething(42), { k: 42 })
  t.same(await cache.fetchSomething(42), { k: 42 })
})

test('works with objects', async (t) => {
  // plan verifies that fetchSomething is called only once
  t.plan(1)

  const factory = new Factory()

  factory.add('fetchSomething', async (queries) => {
    return queries
  })

  const cache = factory.create()

  const p1 = cache.fetchSomething({ k: 42 })
  const p2 = cache.fetchSomething({ k: 24 })

  const res = await Promise.all([p1, p2])

  t.same(res, [
    { k: 42 },
    { k: 24 }
  ])
})

test('add data validation', async (t) => {
  const factory = new Factory()

  t.throws(() => {
    factory.add('fetchSomething', null, null)
  }, new TypeError('Missing the function parameter for \'fetchSomething\''))

  t.end()
})

test('create a Factory that batches with null options', async (t) => {
  // plan verifies that fetchSomething is called only once
  t.plan(2)

  const factory = new Factory()

  factory.add('fetchSomething', null, async (queries) => {
    t.same(queries, [
      42, 24
    ])
    return queries.map((k) => {
      return { k }
    })
  })

  const cache = factory.create()

  const p1 = cache.fetchSomething(42)
  const p2 = cache.fetchSomething(24)

  const res = await Promise.all([p1, p2])

  t.same(res, [
    { k: 42 },
    { k: 24 }
  ])
})

test('works with custom serialize', async (t) => {
  // plan verifies that fetchSomething is called only once
  t.plan(2)

  const factory = new Factory()

  factory.add(
    'fetchSomething',
    async (queries) => {
      return queries
    },
    args => args.k
  )

  const cache = factory.create()

  const p1 = cache.fetchSomething({ k: 42 })
  const p2 = cache.fetchSomething({ k: 24 })

  const res = await Promise.all([p1, p2])

  t.same(res, [
    { k: 42 },
    { k: 24 }
  ])

  t.same(Object.keys(cache[kValues].fetchSomething.ids), ['24', '42'])
})

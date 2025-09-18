'use strict'

const { setTimeout } = require('node:timers/promises')
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { graphql, buildSchema } = require('graphql')
const { Factory } = require('.')

const kValues = require('./symbol')
const { makeExecutableSchema } = require('@graphql-tools/schema')

test('create a Factory that batches', async () => {
  let functionCalled = 0

  const factory = new Factory()

  factory.add('fetchSomething', async (queries) => {
    functionCalled++
    assert.deepEqual(queries, [42, 24])
    return queries.map((k) => {
      return { k }
    })
  })

  const cache = factory.create()

  const p1 = cache.fetchSomething(42)
  const p2 = cache.fetchSomething(24)

  const res = await Promise.all([p1, p2])

  assert.deepEqual(res, [
    { k: 42 },
    { k: 24 }
  ])
  assert.equal(functionCalled, 1)
})

test('create a Factory that dedupes the queries', async () => {
  const factory = new Factory()

  factory.add('fetchSomething', async (queries) => {
    assert.deepEqual(queries, [42])
    return [{ k: 42 }]
  })

  const cache = factory.create()

  const p1 = cache.fetchSomething(42)
  const p2 = cache.fetchSomething(42)

  const res = await Promise.all([p1, p2])

  assert.deepEqual(res, [
    { k: 42 },
    { k: 42 }
  ])
})

test('create a Factory that dedupes the queries after resolution', async () => {
  let functionCalled = 0

  const factory = new Factory()

  factory.add('fetchSomething', async (queries) => {
    // this tests verifies that the callback is called only once
    functionCalled++
    assert.deepEqual(queries, [42])
    return [{ k: 42 }]
  })

  const cache = factory.create()

  assert.deepEqual(await cache.fetchSomething(42), { k: 42 })
  assert.deepEqual(await cache.fetchSomething(42), { k: 42 })
  assert.equal(functionCalled, 1)
})

test('works with GQL', async () => {
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
    assert.deepEqual(ids, ['42', '24'])

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

  const data = await graphql({
    schema,
    source: '{ allPeople { name, friends { name } } }',
    rootValue: root,
    contextValue: { cache }
  })

  // Create expected result with null prototype objects to match GraphQL's output format
  const expected = {}
  expected.data = Object.create(null)
  expected.data.allPeople = [
    Object.create(null),
    Object.create(null)
  ]

  expected.data.allPeople[0].name = 'matteo'
  expected.data.allPeople[0].friends = [Object.create(null)]
  expected.data.allPeople[0].friends[0].name = 'marco'

  expected.data.allPeople[1].name = 'marco'
  expected.data.allPeople[1].friends = [Object.create(null)]
  expected.data.allPeople[1].friends[0].name = 'matteo'

  assert.deepEqual(data, expected)
})

test('cache makeSchemaExecutable', async () => {
  const factory = new Factory()

  factory.add('fetchSomething', async (queries) => {
    assert.deepEqual(queries, [42])
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

  const res = await graphql({
    schema,
    source: query,
    rootValue: {},
    contextValue: { cache: factory.create() }
  })

  // Create expected result with null prototype objects to match GraphQL's output format
  const expected = {}
  expected.data = Object.create(null)
  expected.data.fetchSomething = 42

  assert.deepEqual(res, expected)
})

test('support context', async () => {
  let functionCalled = 0

  const factory = new Factory()
  const expectedCtx = {}

  factory.add('fetchSomething', async (queries, ctx) => {
    functionCalled++
    assert.equal(ctx, expectedCtx)
    return queries.map((k) => {
      return { k }
    })
  })

  const cache = factory.create(expectedCtx)

  const p1 = cache.fetchSomething(42)
  const p2 = cache.fetchSomething(24)

  const res = await Promise.all([p1, p2])

  assert.deepEqual(res, [
    { k: 42 },
    { k: 24 }
  ])
  assert.equal(functionCalled, 1)
})

test('cache: false', async () => {
  let functionCalled = 0

  const factory = new Factory()

  factory.add('fetchSomething', { cache: false }, async (queries) => {
    functionCalled++
    assert.deepEqual(queries, [42])
    return [{ k: 42 }]
  })

  const cache = factory.create()

  assert.deepEqual(await cache.fetchSomething(42), { k: 42 })
  assert.deepEqual(await cache.fetchSomething(42), { k: 42 })
  assert.equal(functionCalled, 2)
})

test('works with objects', async () => {
  const factory = new Factory()

  factory.add('fetchSomething', async (queries) => {
    return queries
  })

  const cache = factory.create()

  const p1 = cache.fetchSomething({ k: 42 })
  const p2 = cache.fetchSomething({ k: 24 })

  const res = await Promise.all([p1, p2])

  assert.deepEqual(res, [
    { k: 42 },
    { k: 24 }
  ])
})

test('add data validation', async () => {
  const factory = new Factory()

  assert.throws(() => {
    factory.add('fetchSomething', null, null)
  }, {
    name: 'TypeError',
    message: 'Missing the function parameter for \'fetchSomething\''
  })
})

test('create a Factory that batches with null options', async () => {
  let functionCalled = 0

  const factory = new Factory()

  factory.add('fetchSomething', null, async (queries) => {
    functionCalled++
    assert.deepEqual(queries, [
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

  assert.deepEqual(res, [
    { k: 42 },
    { k: 24 }
  ])
  assert.equal(functionCalled, 1)
})

test('works with custom serialize', async () => {
  let functionCalled = 0

  const factory = new Factory()

  factory.add(
    'fetchSomething',
    async (queries) => {
      functionCalled++
      return queries
    },
    args => args.k
  )

  const cache = factory.create()

  const p1 = cache.fetchSomething({ k: 42 })
  const p2 = cache.fetchSomething({ k: 24 })

  const res = await Promise.all([p1, p2])

  assert.deepEqual(res, [
    { k: 42 },
    { k: 24 }
  ])
  assert.equal(functionCalled, 1)

  assert.deepEqual(Object.keys(cache[kValues].fetchSomething.ids), ['24', '42'])
})

test('works with same args', async () => {
  const factory = new Factory()

  factory.add('mul10', async (queries) => queries.map(q => q * 10))

  const cache = factory.create()

  const r = await Promise.all([
    cache.mul10(1),
    cache.mul10(2),
    cache.mul10(1),
    cache.mul10(3),
    cache.mul10(2),
    cache.mul10(2),
    cache.mul10(1),
    cache.mul10(3)
  ])

  assert.deepEqual(r, [10, 20, 10, 30, 20, 20, 10, 30])
})

test('concurrent requests without cache', async () => {
  const factory = new Factory()
  const users = { 1: 'Alice', 2: 'Barbara' }

  let calls = 0
  let batch
  factory.add('slowQuery', { cache: false }, async (queries) => {
    calls++
    await setTimeout(250)
    batch = queries.length
    return queries.map(q => users[q.id])
  })

  const loader = factory.create()

  const r = await Promise.all([
    Promise.all([
      loader.slowQuery({ id: 1 }),
      loader.slowQuery({ id: 2 }),
      loader.slowQuery({ id: 3 }),
      loader.slowQuery({ id: 1 }),
      loader.slowQuery({ id: 2 }),
      loader.slowQuery({ id: 3 })
    ]),
    Promise.all([
      loader.slowQuery({ id: 1 }),
      loader.slowQuery({ id: 2 }),
      loader.slowQuery({ id: 3 }),
      loader.slowQuery({ id: 1 }),
      loader.slowQuery({ id: 2 }),
      loader.slowQuery({ id: 3 })
    ])
  ])

  assert.equal(calls, 1)
  assert.equal(batch, 3)
  assert.deepEqual(r, [['Alice', 'Barbara', undefined, 'Alice', 'Barbara', undefined], ['Alice', 'Barbara', undefined, 'Alice', 'Barbara', undefined]])
})

test('create a Factory that batches in slices', async () => {
  let functionCalled = 0

  const factory = new Factory()

  factory.add('fetchSomething', { maxBatchSize: 2 }, async (queries) => {
    functionCalled++

    if (functionCalled === 1) {
      assert.deepEqual(queries, [42, 24])
    } else {
      assert.deepEqual(queries, [420, 240])
    }
    return queries.map((k) => {
      return { k }
    })
  })

  const cache = factory.create()

  const p1 = cache.fetchSomething(42)
  const p2 = cache.fetchSomething(24)
  const p3 = cache.fetchSomething(420)
  const p4 = cache.fetchSomething(240)

  const res = await Promise.all([p1, p2, p3, p4])

  assert.deepEqual(res, [
    { k: 42 },
    { k: 24 },
    { k: 420 },
    { k: 240 },
  ])
  assert.equal(functionCalled, 2)
})

test('create a Factory that batches in slices with a partial page', async () => {
  let functionCalled = 0

  const factory = new Factory()

  factory.add('fetchSomething', { maxBatchSize: 2 }, async (queries) => {
    functionCalled++

    if (functionCalled === 1) {
      assert.deepEqual(queries, [42, 24])
    } else {
      assert.deepEqual(queries, [420])
    }
    return queries.map((k) => {
      return { k }
    })
  })

  const cache = factory.create()

  const p1 = cache.fetchSomething(42)
  const p2 = cache.fetchSomething(24)
  const p3 = cache.fetchSomething(420)

  const res = await Promise.all([p1, p2, p3])

  assert.deepEqual(res, [
    { k: 42 },
    { k: 24 },
    { k: 420 },
  ])
  assert.equal(functionCalled, 2)
})

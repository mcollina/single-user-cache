import { expectType } from 'tsd'
import { Factory } from '.'

interface Post {
  id: string;
}

interface Context {
  requestId: string;
}

type BatchFn = (key: string) => Promise<Post>

// Serializer
const f1 = new Factory().add('getPost', async (keys: string[]) =>
  keys.map(
    (k) => ({ id: k }),
    (id: string) => {
      return id
    }
  )
)
const c1 = f1.create()

expectType<BatchFn>(c1.getPost)
expectType<Promise<Post>>(c1.getPost('a'))

// Context
const f2 = new Factory<Context>().add(
  'getPost',
  async (keys: string[], ctx) => {
    expectType<Context>(ctx)
    return keys.map((k) => ({ id: k }))
  }
)
const c2 = f2.create({ requestId: '1' })

expectType<BatchFn>(c2.getPost)
expectType<Promise<Post>>(c2.getPost('a'))

// Context + Options + Serializer
const f3 = new Factory<Context>().add(
  'getPost',
  { cache: true },
  async (keys: string[], ctx) => {
    expectType<Context>(ctx)
    return keys.map((k) => ({ id: k }))
  },
  (id: string) => {
    return id
  }
)
const c3 = f3.create({ requestId: '1' })

expectType<BatchFn>(c3.getPost)
expectType<Promise<Post>>(c3.getPost('a'))

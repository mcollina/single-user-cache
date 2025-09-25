'use strict'

const kValues = require('./symbol')
const stringify = require('safe-stable-stringify')

class Factory {
  constructor () {
    this.Cache = class Cache extends _Cache {}
  }

  add (key, opts, func, serialize) {
    if (typeof opts === 'function') {
      serialize = func
      func = opts
      opts = {}
    }

    if (typeof func !== 'function') {
      throw new TypeError(`Missing the function parameter for '${key}'`)
    }

    if (serialize && typeof serialize !== 'function') {
      throw new TypeError('serialize must be a function')
    }

    opts = opts || {}

    class Wrapper extends _Wrapper {}

    Wrapper.prototype.func = func
    Wrapper.prototype.key = key
    Wrapper.prototype.serialize = serialize

    this.Cache.prototype[key] = function (id) {
      if (!this[kValues][key]) {
        this[kValues][key] = new Wrapper(this.ctx, opts.cache, opts.maxBatchSize)
      }
      return this[kValues][key].add(id)
    }

    return this
  }

  create (ctx) {
    return new this.Cache(ctx)
  }
}

class _Cache {
  constructor (ctx) {
    this[kValues] = {}
    this.ctx = ctx
  }
}

class _Wrapper {
  constructor (ctx, cache = true, maxBatchSize = undefined) {
    this.ids = {}
    this.toFetch = new Map()
    this.error = null
    this.started = false
    this.ctx = ctx
    this.cache = cache
    this.maxBatchSize = maxBatchSize
  }

  add (args) {
    const id = this.serialize ? this.serialize(args) : args
    const key = typeof id === 'string' ? id : stringify(id)
    if (this.ids[key]) {
      return this.ids[key].promise
    }

    // already started
    if (!this.start()) {
      const q = this.toFetch.get(key)
      if (q) {
        return q.promise
      }
    }

    const query = new Query(id, args)
    if (this.cache) {
      this.ids[key] = query
    }
    this.toFetch.set(key, query)
    return query.promise
  }

  start () {
    if (this.started) {
      return
    }
    this.started = true

    // Needed to escape the promise context.
    process.nextTick(() => {
      this.started = false
      const toFetch = Array.from(this.toFetch.values())
      this.toFetch = new Map()

      if (this.maxBatchSize && toFetch.length > this.maxBatchSize) {
        // Split into batches
        for (let i = 0; i < toFetch.length; i += this.maxBatchSize) {
          const batch = toFetch.slice(i, i + this.maxBatchSize)
          this.processBatch(batch)
        }
      } else {
        this.processBatch(toFetch)
      }
    })

    return true
  }

  processBatch (batch) {
    const funcArgs = []
    for (let i = 0; i < batch.length; i++) {
      funcArgs.push(batch[i].args)
    }
    this.func(funcArgs, this.ctx).then((data) => {
      if (!Array.isArray(data) && data.length !== batch.length) {
        onError(new Error(`The Number of elements in the response for ${this.key} does not match`))
        return
      }
      for (let i = 0; i < batch.length; i++) {
        batch[i].resolve(data[i])
      }
    }, onError)

    function onError (err) {
      for (let i = 0; i < batch.length; i++) {
        batch[i].reject(err)
      }
    }
  }
}

class Query {
  constructor (id, args) {
    // ease the work to V8, define the fields beforehand
    this.resolve = null
    this.reject = null
    this.id = id
    this.args = args

    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve
      this.reject = reject
    })
  }
}

module.exports = { Factory }

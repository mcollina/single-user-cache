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
        this[kValues][key] = new Wrapper(this.ctx, opts.cache)
      }
      return this[kValues][key].add(id)
    }
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
  constructor (ctx, cache = true) {
    this.ids = {}
    this.toFetch = []
    this.error = null
    this.started = false
    this.ctx = ctx
    this.cache = cache
  }

  add (args) {
    const id = this.serialize ? this.serialize(args) : args
    const key = typeof id === 'string' ? id : stringify(id)
    if (this.ids[key]) {
      return this.ids[key].promise
    }

    this.start()

    const query = new Query(id, args)
    if (this.cache) {
      this.ids[key] = query
    }
    this.toFetch.push(query)
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
      const toFetch = this.toFetch
      this.toFetch = []

      this.func(toFetch.map((q) => q.args), this.ctx).then((data) => {
        if (!Array.isArray(data) && data.length !== toFetch.length) {
          onError(new Error(`The Number of elements in the response for ${this.key} does not match`))
          return
        }
        for (let i = 0; i < toFetch.length; i++) {
          toFetch[i].resolve(data[i])
        }
      }, onError)

      function onError (err) {
        for (let i = 0; i < toFetch.length; i++) {
          toFetch[i].reject(err)
        }
      }
    })
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

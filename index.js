'use strict'

const kValues = Symbol('values')

class Factory {
  constructor () {
    this.Cache = class Cache extends _Cache {}
  }

  add (key, func) {
    class Wrapper extends _Wrapper {}

    Wrapper.prototype.func = func
    Wrapper.prototype.key = key

    this.Cache.prototype[key] = function (id) {
      if (!this[kValues][key]) {
        this[kValues][key] = new Wrapper(this.ctx)
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
  constructor (ctx) {
    this.ids = {}
    this.toFetch = []
    this.error = null
    this.started = false
    this.ctx = ctx
  }

  add (id) {
    if (this.ids[id]) {
      return this.ids[id].promise
    }

    this.start()

    const query = new Query(id)
    this.ids[id] = query
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

      this.func(toFetch.map((q) => q.id), this.ctx).then((data) => {
        if (!Array.isArray(data) && data.length !== toFetch.length) {
          onError(new Error(`The Number of elements in the response for ${this.key} does not match`))
          return
        }
        for (var i = 0; i < toFetch.length; i++) {
          toFetch[i].resolve(data[i])
        }
      }, onError)

      function onError (err) {
        for (var i = 0; i < toFetch.length; i++) {
          toFetch[i].reject(err)
        }
      }
    })
  }
}

class Query {
  constructor (id) {
    // ease the work to V8, define the fields beforehand
    this.resolve = null
    this.reject = null
    this.id = id

    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve
      this.reject = reject
    })
  }
}

module.exports = { Factory }

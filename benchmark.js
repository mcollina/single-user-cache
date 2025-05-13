'use strict'

const { bench, run } = require('mitata')
const DataLoader = require('dataloader')
const { Factory } = require('./index')

// Number of items to batch
const ITEMS = 1000
// Number of concurrent requests
const CONCURRENT = 10000

// Utility function to delay the response
function delay (ms, val) {
  return new Promise(resolve => setTimeout(() => resolve(val), ms))
}

// Generate test data and ids
const batchedIds = Array(CONCURRENT).fill(0).map(() => Math.floor(Math.random() * ITEMS))

// Setup DataLoader - created outside benchmark loop
const dataLoader = new DataLoader(async keys => {
  // Simulate database fetch with 10ms delay
  await delay(10)
  return keys.map(id => ({ id }))
}, { cache: true })

// Setup single-user-cache - created outside benchmark loop
const factory = new Factory()
factory.add('getItems', async (keys) => {
  // Simulate database fetch with 10ms delay
  await delay(10)
  return keys.map(id => ({ id }))
})
const singleUserCache = factory.create({})

// DataLoader benchmark
bench('dataloader', async () => {
  // Create promises in parallel
  const promises = batchedIds.map(id => dataLoader.load(id))

  // Wait for all promises to resolve
  await Promise.all(promises)
})

// Single-user-cache benchmark
bench('single-user-cache', async () => {
  // Create promises in parallel
  const promises = batchedIds.map(id => singleUserCache.getItems(id))

  // Wait for all promises to resolve
  await Promise.all(promises)
})

// Run the benchmark
run({
  avg: true,
  json: false,
  colors: true,
  min_max: true,
  percentiles: true
})

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`single-user-cache` is a lightweight library that provides request batching and caching for a single user request. It's built on similar concepts to [Facebook's DataLoader](https://github.com/facebook/dataloader). The library is particularly useful for batching and caching GraphQL queries.

## Code Structure

The library consists of a few key components:

- `Factory`: The main class that allows you to register data-fetching functions and create cache instances
- `_Cache`: Internal class that stores cache values for a user context
- `_Wrapper`: Internal class that handles the batching and caching logic
- `Query`: A promise-based wrapper for individual queries

The library uses Symbol (`kValues`) for private storage of cache values.

## Commands

### Installing Dependencies

```bash
npm install
```

### Running Tests

```bash
npm test
```

This runs both ESLint and the Node.js built-in test runner.

### Running Individual Tests

To run a specific test:

```bash
node --test --test-name-pattern="test name pattern" test.js
```

## Key Features

1. **Query Batching**: Collects individual queries made in the same tick and batches them into a single request.
2. **Caching**: By default, caches results to avoid duplicate queries.
3. **Custom Serialization**: Supports custom serialization of query keys.
4. **Context Passing**: Passes context to data-fetching functions.
5. **GraphQL Integration**: Works well with GraphQL resolvers.

## Common Usage Patterns

1. Creating a factory and registering data fetching functions
2. Creating a cache instance with context for a user request
3. Using the cache to fetch data 
4. Processing query results
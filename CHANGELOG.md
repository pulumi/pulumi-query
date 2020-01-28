## v0.6.0

### Improvements

- Fix `AsyncQueryable#concat` interface type to accurately reflect the underlying type of the
  implementation.

## v0.5.0

### Improvements

- Allow `xs` and `ys` to be separate types in `xs.concat(ys)`.

## v0.4.0

## v0.3.0

### Improvements

- Re-declare the global `SymbolConstructor` with `asyncIterator`, allowing users targeting ES
  versions earlier than the 2018 to use this library.
- Fix issue preventing double-invoke of queries.
- Fix incorrect `groupJoin` semantics.
- Allow `from` to gracefully handle stray `undefined` passed as argument.

## v0.2.0

### Improvements

- Don't require users to supply `es2018.asynciterable` to `.compilationOptions.libs` when compiling
  against this library.

## v0.1.0

### Major Changes

- Add support for nearly all of the [LINQ standard query operators][linq-ops]. These are implemented
  using the ECMAScript standard [async iterator][async-iter] API.
- Add tests for all query operators.
- Implement `QueryableIterable`, a class wrapping async iterators, and providing
  "convenience methods" for various operators (_e.g._, the `map` in `xs.map(x =>
  x)`).

### Improvements

- Minor fix in polyfill code for `asyncIterable`: don't polyfill on objects where the property is
  readonly.

[linq-ops]: https://docs.microsoft.com/en-us/previous-versions/dotnet/articles/bb394939(v=msdn.10)
[async-iter]: https://github.com/tc39/proposal-async-iteration


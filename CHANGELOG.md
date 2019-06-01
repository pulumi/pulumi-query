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

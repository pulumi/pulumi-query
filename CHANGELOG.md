## Unreleased

### Major Changes

- Add support for nearly all of the [LINQ standard query operators][linq-ops]. These are implemented
  using the ECMAScript standard [async iterator][async-iter] API.
- Add tests for all query operators.
- Implement `QueryableIterable`, a class wrapping async iterators, and providing
  "convenience methods" for various operators (_e.g._, the `map` in `xs.map(x =>
  x)`).

[linq-ops]: https://docs.microsoft.com/en-us/previous-versions/dotnet/articles/bb394939(v=msdn.10)
[async-iter]: https://github.com/tc39/proposal-async-iteration

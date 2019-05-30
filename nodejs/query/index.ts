// Copyright 2016-2019, Pulumi Corporation.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

//
// NOTE: We choose to be purposefully conservative about what details are exposed through these
// interfaces in case we decide to change the implementation drastically later.
//

//
// Polyfill the async iterator per the "caveats" section of the feature release notes:
// https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-3.html#the-for-await-of-statement
//
if (typeof (Symbol as any).asyncIterator === "undefined") {
    (Symbol as any).asyncIterator = Symbol.asyncIterator || Symbol.for("Symbol.asyncIterator");
}

import { AsyncQueryableImpl } from "./asyncQueryable";
import { AsyncQueryable, AsyncQuerySource } from "./interfaces";
import * as sources from "./sources";

export { AsyncQueryable, AsyncQueryableGrouping, OrderKey } from "./interfaces";

/**
 * Creates an `AsyncQueryable` from things that look `Iterable` or `AsyncIterable`, even if they're
 * wrapped in a `Promise`.
 * @param source Object to convert into an `AsyncQueryable`.
 */
export function from<TSource>(source: AsyncQuerySource<TSource>): AsyncQueryable<TSource> {
    return AsyncQueryableImpl.from(source);
}

/**
 * Generates a (potentially infinite) sequence of integral numbers within a range. The first number
 * emitted is `start`, and the last is `stop - 1`. If the enumerated sequence generates zero
 * elements (for example, when `stop <= start + 1`), an exception is thrown.
 * @param start Beginning of the range
 * @param stop Non-inclusive end of the range.
 * @example
 * const squares = await range(0, 3).map(x => x * x).toArray(); // == [0, 1, 4]
 */
export function range(start: number, stop?: number): AsyncQueryable<number> {
    return AsyncQueryableImpl.from(sources.range(start, stop));
}

/**
 * Returns an empty sequence of `TResult`.
 * @example
 * const noNumbers = await empty<number>().toArray(); // == []
 */
export function empty<TResult>(): AsyncIterableIterator<TResult> {
    return AsyncQueryableImpl.from(sources.from([]));
}

/**
 * Generates a (potentially infinite) sequence by repeating a single value.
 * @param t Object to repeat
 * @example
 * const ones = await repeat(1).take(3).toArray(); // == [1, 1, 1]
 */
export function repeat<TSource>(t: TSource /* TODO: add optional count. */) {
    AsyncQueryableImpl.from(
        (async function*() {
            while (true) {
                yield t;
            }
        })(),
    );
}

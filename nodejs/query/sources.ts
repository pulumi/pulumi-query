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

import { AsyncQuerySource, isIterable } from "./interfaces";

function wrapAsyncIterable<T>(
    makeIterable: () => Iterable<T> | AsyncIterable<T>,
): AsyncIterable<T> {
    return {
        [Symbol.asyncIterator]() {
            const iterable = makeIterable();
            if (isIterable(iterable)) {
                const iterator = iterable[Symbol.iterator]();
                return {
                    async next() {
                        return iterator.next();
                    },
                };
            } else {
                return iterable[Symbol.asyncIterator]();
            }
        },
    };
}

export function range(start: number, end?: number): AsyncIterable<number> {
    return wrapAsyncIterable(async function*() {
        let i = start;
        while (true) {
            if (end !== undefined && i >= end) {
                return;
            }
            yield i++;
        }
    });
}

export function from<TSource>(source: AsyncQuerySource<TSource>): AsyncIterable<TSource> {
    return source instanceof Function
        ? wrapAsyncIterable(source)
        : wrapAsyncIterable(async function*() {
              if (isIterable(source)) {
                  for (const t of source) {
                      yield t;
                  }
              } else {
                  for await (const t of source) {
                      yield t;
                  }
              }
          });
}

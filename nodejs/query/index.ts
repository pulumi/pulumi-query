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
(Symbol as any).asyncIterator = Symbol.asyncIterator || Symbol.for("Symbol.asyncIterator");

import { AsyncQueryableImpl } from "./asyncQueryable";
import { AsyncQueryable, AsyncQuerySource } from "./interfaces";
import * as sources from "./sources";

export { AsyncQueryable } from "./interfaces";

export function from<TSource>(source: AsyncQuerySource<TSource>): AsyncQueryable<TSource> {
    return AsyncQueryableImpl.from(source);
}

export function range(start: number, stop?: number): AsyncQueryable<number> {
    return AsyncQueryableImpl.from(sources.range(start, stop));
}

export function empty<TResult>(): AsyncIterableIterator<TResult> {
    return AsyncQueryableImpl.from(sources.from([]));
}

export function singleton<TSource>(t: TSource): AsyncIterableIterator<TSource> {
    return AsyncQueryableImpl.from(sources.from([t]));
}

export function repeat<TSource>(t: TSource) {
    AsyncQueryableImpl.from(
        (async function*() {
            while (true) {
                yield t;
            }
        })(),
    );
}

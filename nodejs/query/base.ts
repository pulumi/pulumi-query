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

import { AsyncQuerySource, GroupedAsyncIterable } from "./interfaces";
import { from } from "./sources";

export abstract class IterableBase<T> implements AsyncIterable<T> {
    constructor(protected readonly source: AsyncQuerySource<T>) {}

    [Symbol.asyncIterator]() {
        return from(this.source)[Symbol.asyncIterator]();
    }
}

export class GroupedAsyncIterableImpl<TKey, TSource> extends IterableBase<TSource>
    implements GroupedAsyncIterable<TKey, TSource> {
    constructor(public readonly key: TKey, core: AsyncIterable<TSource>) {
        super(core);
    }
}

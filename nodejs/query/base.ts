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

import { GroupedAsyncIterableIterator } from "./interfaces";

export abstract class IterableBase<T> implements AsyncIterableIterator<T> {
    constructor(private readonly core: AsyncIterableIterator<T>) {}

    [Symbol.asyncIterator](): AsyncIterableIterator<T> {
        return this;
    }

    public next(value?: any): Promise<IteratorResult<T>> {
        return this.core.next(value);
    }
}

export class GroupedAsyncIterableIteratorImpl<TKey, TSource> extends IterableBase<TSource>
    implements GroupedAsyncIterableIterator<TKey, TSource> {
    constructor(public readonly key: TKey, core: AsyncIterableIterator<TSource>) {
        super(core);
    }
}

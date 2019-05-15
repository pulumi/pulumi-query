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

export function isAsyncIterable<T>(o: any): o is AsyncIterable<T> {
    return typeof o[Symbol.asyncIterator] === "function";
}

export function isIterable<T>(o: any): o is Iterable<T> {
    return typeof o[Symbol.iterator] === "function";
}

export type Operator<TSource, TResult> = (
    source: AsyncIterableIterator<TSource>,
) => AsyncIterableIterator<TResult>;

export type Evaluator<TSource, TResult> = (
    source: AsyncIterableIterator<TSource>,
) => Promise<TResult>;

export type AsyncQuerySource<TSource> =
    | Iterable<TSource>
    | AsyncIterable<TSource>
    | Promise<Iterable<TSource>>
    | Promise<AsyncIterable<TSource>>;

export type OrderKey = string | number;

export interface AsyncQueryable<TSource> extends AsyncIterableIterator<TSource> {
    //
    // Restriction operators.
    //

    filter(f: (t: TSource, i: number) => boolean | Promise<boolean>): AsyncQueryable<TSource>;

    //
    // Projection operators.
    //

    flatMap<TInner, TResult = TInner>(
        selector: (t: TSource, index: number) => AsyncQuerySource<TInner>,
        resultSelector?: (t: TSource, ti: TInner) => TResult | Promise<TResult>,
    ): AsyncQueryable<TResult>;
    map<U>(f: (t: TSource, i: number) => U | Promise<U>): AsyncQueryable<U>;

    //
    // Partitioning operators.
    //

    skip(n: number): AsyncQueryable<TSource>;
    skipWhile(
        predicate: (t: TSource, i: number) => boolean | Promise<boolean>,
    ): AsyncQueryable<TSource>;
    take(n: number): AsyncQueryable<TSource>;
    takeWhile(
        predicate: (t: TSource, i: number) => boolean | Promise<boolean>,
    ): AsyncQueryable<TSource>;

    //
    // Join operators.
    //

    join<TInner, TKey, TResult>(
        inner: AsyncQuerySource<TInner>,
        outerKeySelector: (to: TSource) => TKey | Promise<TKey>,
        innerKeySelector: (ti: TInner) => TKey | Promise<TKey>,
        resultSelector: (to: TSource, ti: TInner) => TResult | Promise<TResult>,
    ): AsyncQueryable<TResult>;

    groupJoin<TInner, TKey, TResult>(
        inner: AsyncQuerySource<TInner>,
        outerKeySelector: (to: TSource) => TKey | Promise<TKey>,
        innerKeySelector: (ti: TInner) => TKey | Promise<TKey>,
        resultSelector: (to: TSource, ti: AsyncQuerySource<TInner>) => TResult | Promise<TResult>,
    ): AsyncQueryable<TResult>;

    //
    // Concatenation operators.
    //

    concat(iter: AsyncQuerySource<TSource>): AsyncQueryable<TSource>;

    //
    // Ordering operators.
    //

    reverse(): AsyncQueryable<TSource>;
    orderBy(keySelector: (t: TSource) => OrderKey | Promise<OrderKey>): AsyncQueryable<TSource>;
    orderByDescending(
        keySelector: (t: TSource) => OrderKey | Promise<OrderKey>,
    ): AsyncQueryable<TSource>;

    //
    // Grouping operators.
    //

    groupBy<TKey, TResult = TSource>(
        keySelector: (t: TSource) => TKey | Promise<TKey>,
        elementSelector?: (t: TSource) => TResult | Promise<TResult>,
    ): AsyncQueryable<Grouping<TKey, TResult>>;

    //
    // Set operators.
    //

    distinct(): AsyncQueryable<TSource>;
    union(second: AsyncQuerySource<TSource>): AsyncQueryable<TSource>;
    intersect(second: AsyncQuerySource<TSource>): AsyncQueryable<TSource>;
    except(second: AsyncQuerySource<TSource>): AsyncQueryable<TSource>;

    //
    // Element operators.
    //

    first(predicate?: (t: TSource) => boolean | Promise<boolean>): Promise<TSource>;
    firstOrDefault(
        defaultValue: TSource,
        predicate?: (t: TSource) => boolean | Promise<boolean>,
    ): Promise<TSource>;
    last(predicate?: (t: TSource) => boolean | Promise<boolean>): Promise<TSource>;
    lastOrDefault(
        defaultValue: TSource,
        predicate?: (t: TSource) => boolean | Promise<boolean>,
    ): Promise<TSource>;
    single(predicate?: (t: TSource) => boolean | Promise<boolean>): Promise<TSource>;
    singleOrDefault(
        defaultValue: TSource,
        predicate?: (t: TSource) => boolean | Promise<boolean>,
    ): Promise<TSource>;
    elementAt(index: number): Promise<TSource>;
    elementAtOrDefault(defaultValue: TSource, index: number | Promise<number>): Promise<TSource>;
    defaultIfEmpty(defaultValue: TSource): AsyncQueryable<TSource>;

    //
    // Quantifiers.
    //

    any(predicate?: (t: TSource) => boolean | Promise<boolean>): Promise<boolean>;
    all(predicate: (t: TSource) => boolean | Promise<boolean>): Promise<boolean>;
    contains(value: TSource): Promise<boolean>;

    //
    // Aggregate operators.
    //

    count(predicate?: (t: TSource) => boolean | Promise<boolean>): Promise<number>;
    sum(): TSource extends number ? Promise<number> : never;
    sum(selector?: (t: TSource) => number | Promise<number>): Promise<number>;
    min(): TSource extends number ? Promise<number> : never;
    min(selector?: (t: TSource) => number | Promise<number>): Promise<number>;
    max(): TSource extends number ? Promise<number> : never;
    max(selector?: (t: TSource) => number | Promise<number>): Promise<number>;
    average(): TSource extends number ? Promise<number> : never;
    average(selector?: (t: TSource) => number | Promise<number>): Promise<number>;
    aggregate<TAccumulate>(
        seed: TAccumulate,
        func: (acc: TAccumulate, t: TSource) => TAccumulate | Promise<TAccumulate>,
    ): Promise<TAccumulate>;

    //
    // Eval operators.
    //

    toArray(): Promise<TSource[]>;
    toMap<TKey, TResult = TSource>(
        keySelector: (t: TSource) => TKey | Promise<TKey>,
        elementSelector?: (t: TSource) => TResult | Promise<TResult>,
    ): Promise<Map<TKey, TResult>>;
    ofType<TResult>(typeGuard: (o: any) => o is TResult): AsyncQueryable<TResult>;

    forEach(f: (t: TSource) => void | Promise<void>): void;

    //
    // Iterable interop operators.
    //

    pipe(): AsyncQueryable<TSource>;
    pipe<TResult>(op: Operator<TSource, TResult>): AsyncQueryable<TResult>;
    pipe<TResult1, TResult2>(
        op1: Operator<TSource, TResult1>,
        op2: Operator<TResult1, TResult2>,
    ): AsyncQueryable<TResult2>;
    pipe<TResult1, TResult2, TResult3>(
        op1: Operator<TSource, TResult1>,
        op2: Operator<TResult1, TResult2>,
        op3: Operator<TResult2, TResult3>,
    ): AsyncQueryable<TResult3>;
    pipe<TResult1, TResult2, TResult3, TResult4>(
        op1: Operator<TSource, TResult1>,
        op2: Operator<TResult1, TResult2>,
        op3: Operator<TResult2, TResult3>,
        op4: Operator<TResult3, TResult4>,
    ): AsyncQueryable<TResult4>;
    pipe<TResult1, TResult2, TResult3, TResult4, TResult5>(
        op1: Operator<TSource, TResult1>,
        op2: Operator<TResult1, TResult2>,
        op3: Operator<TResult2, TResult3>,
        op4: Operator<TResult3, TResult4>,
        op5: Operator<TResult4, TResult5>,
    ): AsyncQueryable<TResult5>;
    pipe<TResult1, TResult2, TResult3, TResult4, TResult5, TResult6>(
        op1: Operator<TSource, TResult1>,
        op2: Operator<TResult1, TResult2>,
        op3: Operator<TResult2, TResult3>,
        op4: Operator<TResult3, TResult4>,
        op5: Operator<TResult4, TResult5>,
        op6: Operator<TResult5, TResult6>,
    ): AsyncQueryable<TResult6>;
    pipe<TResult1, TResult2, TResult3, TResult4, TResult5, TResult6, TResult7>(
        op1: Operator<TSource, TResult1>,
        op2: Operator<TResult1, TResult2>,
        op3: Operator<TResult2, TResult3>,
        op4: Operator<TResult3, TResult4>,
        op5: Operator<TResult4, TResult5>,
        op6: Operator<TResult5, TResult6>,
        op7: Operator<TResult6, TResult7>,
    ): AsyncQueryable<TResult7>;
    pipe<TResult1, TResult2, TResult3, TResult4, TResult5, TResult6, TResult7, TResult8>(
        op1: Operator<TSource, TResult1>,
        op2: Operator<TResult1, TResult2>,
        op3: Operator<TResult2, TResult3>,
        op4: Operator<TResult3, TResult4>,
        op5: Operator<TResult4, TResult5>,
        op6: Operator<TResult5, TResult6>,
        op7: Operator<TResult6, TResult7>,
        op8: Operator<TResult7, TResult8>,
    ): AsyncQueryable<TResult8>;
    pipe<TResult1, TResult2, TResult3, TResult4, TResult5, TResult6, TResult7, TResult8, TResult9>(
        op1: Operator<TSource, TResult1>,
        op2: Operator<TResult1, TResult2>,
        op3: Operator<TResult2, TResult3>,
        op4: Operator<TResult3, TResult4>,
        op5: Operator<TResult4, TResult5>,
        op6: Operator<TResult5, TResult6>,
        op7: Operator<TResult6, TResult7>,
        op8: Operator<TResult7, TResult8>,
        op9: Operator<TResult8, TResult9>,
        ...ops: Operator<any, any>[]
    ): AsyncQueryable<TResult9>;
}

export interface GroupedAsyncIterableIterator<TKey, TSource>
    extends AsyncIterableIterator<TSource> {
    key: TKey;
}

export interface Grouping<TKey, TSource>
    extends GroupedAsyncIterableIterator<TKey, TSource>,
        AsyncQueryable<TSource> {}

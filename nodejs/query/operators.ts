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

import { isBoolean, isNumber, isString } from "util";
import { AsyncQueryableImpl } from "./asyncQueryable";
import { GroupedAsyncIterableImpl } from "./base";
import {
    AsyncIterable,
    AsyncQueryable,
    AsyncQuerySource,
    Evaluator,
    GroupedAsyncIterable,
    Operator,
    OrderKey,
} from "./interfaces";
import { from, range } from "./sources";

//
// Restriction operators.
//

export function filter<TSource>(
    f: (t: TSource, i: number) => boolean | Promise<boolean>,
): Operator<TSource, TSource> {
    return (source: AsyncIterable<TSource>) =>
        from(async function*() {
            for await (const [t, i] of zip(source, range(0))) {
                if (await f(t, i)) {
                    yield t;
                }
            }
        });
}

//
// Projection operators.
//

export function flatMap<TSource, TInner, TResult = TInner>(
    selector: (
        t: TSource,
        index: number,
    ) => AsyncQuerySource<TInner> | Promise<AsyncQuerySource<TInner>>,
    resultSelector: (t: TSource, ti: TInner) => TResult | Promise<TResult> = (t, ti) =>
        <TResult>(<unknown>ti),
): Operator<TSource, TResult> {
    return source =>
        from(async function*() {
            for await (const [t, i] of zip(source, range(0))) {
                const us = selector(t, i);
                for await (const u of from(await us)) {
                    yield await resultSelector(t, u);
                }
            }
        });
}

export function map<TSource, TResult>(
    f: (t: TSource, i: number) => TResult | Promise<TResult>,
): Operator<TSource, TResult> {
    return source =>
        from(async function*() {
            for await (const [t, i] of zip(source, range(0))) {
                yield await f(t, i);
            }
        });
}

//
// Partitioning operators.
//

export function skip<TSource>(n: number): Operator<TSource, TSource> {
    if (n < 0) {
        throw Error("skip was provided a negative number of elements to skip");
    }

    return source =>
        from(async function*() {
            for await (const [t, i] of zip(source, range(1))) {
                if (i > n) {
                    yield t;
                }
            }
        });
}

export function skipWhile<TSource>(
    predicate: (t: TSource, i: number) => boolean | Promise<boolean>,
): Operator<TSource, TSource> {
    return source =>
        from(async function*() {
            let stopSkipping = false;
            for await (const [t, i] of zip(source, range(0))) {
                if (stopSkipping === true) {
                    yield t;
                } else if ((await predicate(t, i)) === false) {
                    stopSkipping = true;
                    yield t;
                }
            }
        });
}

export function take<TSource>(n: number): Operator<TSource, TSource> {
    if (n < 0) {
        throw Error("take was provided a negative number of elements to take");
    }

    return source =>
        from(async function*() {
            for await (const [t, i] of zip(source, range(0))) {
                if (i >= n) {
                    return;
                }
                yield t;
            }
        });
}

export function takeWhile<TSource>(
    predicate: (t: TSource, i: number) => boolean | Promise<boolean>,
): Operator<TSource, TSource> {
    return source =>
        from(async function*() {
            for await (const [t, i] of zip(source, range(0))) {
                if ((await predicate(t, i)) === false) {
                    return;
                }
                yield t;
            }
        });
}

//
// Join operators.
//

async function* joinHelper<TOuter, TInner, TKey, TResult>(
    outer: AsyncIterable<TOuter>,
    inner: AsyncIterable<TInner>,
    outerKeySelector: (to: TOuter) => TKey | Promise<TKey>,
    innerKeySelector: (ti: TInner) => TKey | Promise<TKey>,
): AsyncIterable<[TOuter, TInner[]]> {
    const inners = new Map<TKey, TInner[]>();

    for await (const t of inner) {
        const key = await innerKeySelector(t);
        const val = <TInner[]>inners.get(key);
        if (inners.has(key)) {
            val.push(t);
        } else {
            inners.set(key, [t]);
        }
    }

    for await (const t of outer) {
        const key = await outerKeySelector(t);
        if (key === undefined) {
            continue;
        } else if (inners.has(key)) {
            const innerValues = <TInner[]>inners.get(key);
            yield [t, innerValues];
        }
    }
}

export function join<TOuter, TInner, TKey, TResult>(
    inner: AsyncIterable<TInner>,
    outerKeySelector: (to: TOuter) => TKey | Promise<TKey>,
    innerKeySelector: (ti: TInner) => TKey | Promise<TKey>,
    resultSelector: (to: TOuter, ti: TInner) => TResult | Promise<TResult>,
): Operator<TOuter, TResult> {
    return outer =>
        from(async function*() {
            for await (const [o, inners] of joinHelper(
                outer,
                inner,
                outerKeySelector,
                innerKeySelector,
            )) {
                for (const i of inners) {
                    yield await resultSelector(o, i);
                }
            }
        });
}

async function* groupJoinHelper<TOuter, TInner, TKey, TResult>(
    outer: AsyncIterable<TOuter>,
    inner: AsyncIterable<TInner>,
    outerKeySelector: (to: TOuter) => TKey | Promise<TKey>,
    innerKeySelector: (ti: TInner) => TKey | Promise<TKey>,
): AsyncIterable<[TOuter, TInner[]]> {
    const inners = new Map<TKey, TInner[]>();

    for await (const t of inner) {
        const key = await innerKeySelector(t);
        const val = <TInner[]>inners.get(key);
        if (inners.has(key)) {
            val.push(t);
        } else {
            inners.set(key, [t]);
        }
    }

    for await (const t of outer) {
        const key = await outerKeySelector(t);
        if (key === undefined) {
            continue;
        } else if (inners.has(key)) {
            const innerValues = <TInner[]>inners.get(key);
            yield [t, innerValues];
        } else {
            yield [t, []];
        }
    }
}

export function groupJoin<TOuter, TInner, TKey, TResult>(
    inner: AsyncIterable<TInner>,
    outerKeySelector: (to: TOuter) => TKey | Promise<TKey>,
    innerKeySelector: (ti: TInner) => TKey | Promise<TKey>,
    resultSelector: (to: TOuter, ti: AsyncQueryable<TInner>) => TResult | Promise<TResult>,
): Operator<TOuter, TResult> {
    return outer =>
        from(async function*() {
            for await (const [o, inners] of groupJoinHelper(
                outer,
                inner,
                outerKeySelector,
                innerKeySelector,
            )) {
                yield await resultSelector(o, AsyncQueryableImpl.from(inners));
            }
        });
}

//
// Concatenation operators.
//

export function concat<TSource, TSource2 = TSource>(
    iter: AsyncIterable<TSource2>,
): Operator<TSource, TSource | TSource2> {
    return source =>
        from(async function*() {
            for await (const t of source) {
                yield t;
            }

            for await (const t of iter) {
                yield t;
            }
        });
}

//
// Ordering operators.
//

export function orderBy<TSource>(
    keySelector: (t: TSource) => OrderKey | Promise<OrderKey>,
): Operator<TSource, TSource> {
    return source =>
        from(async function*() {
            //
            // NOTE: This horrible little function is necessary because the default behavior of
            // JavaScript's `Array#sort` is to coerce every element in the array into string, and then
            // sort those strings lexically.
            //
            // This, of course, is completely unacceptable. Approximately 0 users call `.sort` on an
            // array of `Object` with the intention that they be sorted in this manner. The right thing
            // to do is to simply assume this is a user error and throw an exception.
            //
            // If the user actually wants to sort an array of `Object` by their stringified
            // representation, let them pass us a key function that performs this conversion explicitly.
            // There is no particular need for Brendan Eich's problems from 30 years ago to become our
            // users' problems today.
            //

            let lastKey: OrderKey | undefined;
            const ts = await map<TSource, [OrderKey, TSource]>(async function(
                t,
            ): Promise<[OrderKey, TSource]> {
                const key = await keySelector(t);
                if (lastKey === undefined) {
                    lastKey = key;
                } else {
                    if (isNumber(key) && isString(key)) {
                        throw Error("keySelector must produce a number or a string");
                    }

                    if (typeof lastKey !== typeof key) {
                        throw Error(
                            `keySelector must produce keys all of the same type, but found ` +
                                `${typeof key} and ${typeof lastKey}`,
                        );
                    }
                }

                return [key, t];
            })(source);

            const keyed = await toArray<[OrderKey, TSource]>()(ts);
            const comparator = <any>(
                (isNumber(lastKey)
                    ? (a: number, b: number) => a - b
                    : (a: string, b: string) => a.localeCompare(b))
            );

            const sorted = keyed.sort(([k1], [k2]) => comparator(k1, k2));
            for (const [, t] of sorted) {
                yield t;
            }
        });
}

export function orderByDescending<TSource>(
    keySelector: (t: TSource) => OrderKey | Promise<OrderKey>,
): Operator<TSource, TSource> {
    return source =>
        from(function() {
            return reverse<TSource>()(orderBy(keySelector)(source));
        });
}

export function reverse<TSource>(): Operator<TSource, TSource> {
    return source =>
        from(async function*() {
            const ts: TSource[] = [];
            for await (const t of source) {
                ts.push(t);
            }

            for (const t of ts.reverse()) {
                yield t;
            }
        });
}

//
// Grouping operators.
//

export function groupBy<TSource, TKey, TResult = TSource>(
    keySelector: (t: TSource) => TKey | Promise<TKey>,
    elementSelector?: (t: TSource) => TResult | Promise<TResult>,
): (source: AsyncIterable<TSource>) => AsyncIterable<GroupedAsyncIterable<TKey, TResult>> {
    return source =>
        from(async function*() {
            if (elementSelector === undefined) {
                elementSelector = t => <TResult>(<unknown>t);
            }

            const groups = new Map<TKey, TResult[]>();
            for await (const t of source) {
                const key = await keySelector(t);
                const val = await elementSelector(t);

                if (!groups.has(key)) {
                    groups.set(key, [val]);
                } else {
                    const group = <TResult[]>groups.get(key);
                    group.push(val);
                }
            }

            for (const [key, group] of groups) {
                yield new GroupedAsyncIterableImpl(key, from(() => group));
            }
        });
}

//
// Set operators.
//

export function distinct<TSource>(): Operator<TSource, TSource> {
    return source =>
        from(async function*() {
            const dist = new Set<TSource>();
            for await (const t of source) {
                if (!dist.has(t)) {
                    dist.add(t);
                    yield t;
                }
            }
        });
}

export function union<TSource>(second: AsyncIterable<TSource>): Operator<TSource, TSource> {
    return source =>
        from(async function*() {
            const dist = new Set<TSource>();
            for await (const t of source) {
                if (!dist.has(t)) {
                    dist.add(t);
                    yield t;
                }
            }

            for await (const t of second) {
                if (!dist.has(t)) {
                    dist.add(t);
                    yield t;
                }
            }
        });
}

export function intersect<TSource>(second: AsyncIterable<TSource>): Operator<TSource, TSource> {
    return source =>
        from(async function*() {
            const dist = new Set<TSource>();
            for await (const t of source) {
                dist.add(t);
            }

            const emitted = new Set<TSource>();
            for await (const t of second) {
                if (dist.has(t) && !emitted.has(t)) {
                    emitted.add(t);
                    yield t;
                }
            }
        });
}

export function except<TSource>(second: AsyncIterable<TSource>): Operator<TSource, TSource> {
    return source =>
        from(async function*() {
            const dist = new Set<TSource>();
            for await (const t of source) {
                dist.add(t);
            }

            for await (const t of second) {
                if (dist.has(t)) {
                    dist.delete(t);
                } else {
                    dist.add(t);
                }
            }

            for (const t of dist) {
                yield t;
            }
        });
}

//
// Conversion operators.
//

export function toArray<TSource>(): Evaluator<TSource, TSource[]> {
    return async function(source) {
        const ret: TSource[] = [];
        for await (const t of source) {
            ret.push(t);
        }
        return ret;
    };
}

export function toMap<TKey, TSource, TResult = TSource>(
    keySelector: (t: TSource) => TKey | Promise<TKey>,
    elementSelector?: (t: TSource) => TResult | Promise<TResult>,
): Evaluator<TSource, Map<TKey, TResult>> {
    return async function(source) {
        if (elementSelector === undefined) {
            elementSelector = x => <TResult>(<unknown>x);
        }

        const ret = new Map<TKey, TResult>();
        for await (const t of source) {
            const key = await keySelector(t);
            if (key === undefined) {
                throw Error("key selector can't produce a null value");
            }
            const val = await elementSelector(t);
            ret.set(key, val);
        }
        return ret;
    };
}

export function ofType<TSource, TResult extends TSource>(
    typeGuard: (o: TSource) => o is TResult,
): Operator<TSource, TResult> {
    return source =>
        from(async function*() {
            for await (const t of source) {
                if (typeGuard(t)) {
                    yield t;
                }
            }
        });
}

//
// Element operators.
//

export function first<TSource>(
    predicate?: (t: TSource) => boolean | Promise<boolean>,
): Evaluator<TSource, TSource> {
    return async function(source) {
        if (predicate === undefined) {
            predicate = t => true;
        }

        for await (const t of source) {
            if ((await predicate(t)) === true) {
                return t;
            }
        }

        return Promise.reject("first could not find any elements that match predicate");
    };
}

export function firstOrDefault<TSource>(
    defaultValue: TSource,
    predicate?: (t: TSource) => boolean | Promise<boolean>,
): Evaluator<TSource, TSource> {
    return async function(source) {
        if (predicate === undefined) {
            predicate = t => true;
        }

        for await (const t of source) {
            if ((await predicate(t)) === true) {
                return t;
            }
        }

        return defaultValue;
    };
}

export function last<TSource>(
    predicate?: (t: TSource) => boolean | Promise<boolean>,
): Evaluator<TSource, TSource> {
    return async function(source) {
        if (predicate === undefined) {
            predicate = t => true;
        }

        let curr: TSource | undefined;
        for await (const t of source) {
            if ((await predicate(t)) === true) {
                curr = t;
            }
        }

        if (curr === undefined) {
            return Promise.reject("last could not find any elements that match predicate");
        } else {
            return curr;
        }
    };
}

export function lastOrDefault<TSource>(
    defaultValue: TSource,
    predicate?: (t: TSource) => boolean | Promise<boolean>,
): Evaluator<TSource, TSource> {
    return async function(source) {
        if (predicate === undefined) {
            predicate = t => true;
        }

        let curr: TSource | undefined;
        for await (const t of source) {
            if ((await predicate(t)) === true) {
                curr = t;
            }
        }

        if (curr === undefined) {
            return defaultValue;
        } else {
            return curr;
        }
    };
}

export function single<TSource>(
    predicate?: (t: TSource) => boolean | Promise<boolean>,
): Evaluator<TSource, TSource> {
    return async function(source) {
        if (predicate === undefined) {
            predicate = t => true;
        }

        const seq: TSource[] = await toArray<TSource>()(filter(predicate)(source));
        if (seq.length === 0) {
            throw Error("single did not find any elements matching the predicate");
        } else if (seq.length > 1) {
            throw Error("single found multiple elements matching the predicate");
        }

        return seq[0];
    };
}

export function singleOrDefault<TSource>(
    defaultValue: TSource,
    predicate?: (t: TSource) => boolean | Promise<boolean>,
): Evaluator<TSource, TSource> {
    return async function(source) {
        if (predicate === undefined) {
            predicate = t => true;
        }

        const seq: TSource[] = await toArray<TSource>()(filter(predicate)(source));
        if (seq.length === 0) {
            return defaultValue;
        } else if (seq.length > 1) {
            throw Error("single found multiple elements matching the predicate");
        } else {
            return seq[0];
        }
    };
}

export function elementAt<TSource>(index: number): Evaluator<TSource, TSource> {
    return async function(source) {
        // TODO: Maybe support `Array` here if we ever support sync iterables. This would allow us
        // to access that index directly.

        for await (const [t, i] of zip(source, range(0))) {
            if (i === index) {
                return t;
            }
        }

        throw Error(
            `elementAt tried to find item at index ${index}, but sequence had fewer elements`,
        );
    };
}

export function elementAtOrDefault<TSource>(
    defaultValue: TSource,
    index: number,
): Evaluator<TSource, TSource> {
    return async function(source) {
        // TODO: Maybe support `Array` here if we ever support sync iterables. This would allow us
        // to access that index directly.

        for await (const [t, i] of zip(source, range(0))) {
            if (i === index) {
                return t;
            }
        }

        return defaultValue;
    };
}

export function defaultIfEmpty<TSource>(defaultValue: TSource): Operator<TSource, TSource> {
    return source =>
        from(async function*() {
            let sequenceEmpty = true;
            for await (const t of source) {
                sequenceEmpty = false;
                yield t;
            }

            if (sequenceEmpty) {
                yield defaultValue;
            }
        });
}

//
// Quantifiers.
//

export function any<TSource>(
    predicate?: (t: TSource) => boolean | Promise<boolean>,
): Evaluator<TSource, boolean> {
    return async function(source) {
        if (predicate === undefined) {
            predicate = t => true;
        }

        for await (const t of source) {
            if ((await predicate(t)) === true) {
                return true;
            }
        }

        return false;
    };
}

export function all<TSource>(
    predicate: (t: TSource) => boolean | Promise<boolean>,
): Evaluator<TSource, boolean> {
    return async function(source) {
        for await (const t of source) {
            if ((await predicate(t)) === false) {
                return false;
            }
        }

        return true;
    };
}

export function contains<TSource>(value: TSource): Evaluator<TSource, boolean> {
    return async function(source) {
        const dist = new Set<TSource>([value]);
        for await (const t of source) {
            if (dist.has(t)) {
                return true;
            }
        }
        return false;
    };
}

//
// Aggregate operators.
//

export function count<TSource>(
    predicate?: (t: TSource) => boolean | Promise<boolean>,
): Evaluator<TSource, number> {
    return async function(source) {
        if (predicate === undefined) {
            predicate = t => true;
        }

        let n = 0;
        for await (const t of source) {
            if ((await predicate(t)) === true) {
                n++;
            }
        }

        return n;
    };
}

export function sum<TSource>(): TSource extends number ? Promise<number> : never;
export function sum<TSource>(
    selector?: (t: TSource) => number | Promise<number>,
): Evaluator<TSource, number>;
export function sum(selector?: (t: any) => number | Promise<number>): any {
    return async function(source: AsyncIterable<any>) {
        // If selector is undefined, the source should emit `number`.
        if (selector === undefined) {
            selector = t => t;
        }

        let total = 0;
        for await (const t of source) {
            const toSum = await selector(t);
            if (!isNumber(toSum)) {
                throw Error("Can't sum things that aren't numbers");
            }
            total += toSum;
        }

        return total;
    };
}

export function min<TSource>(): TSource extends number ? Promise<number> : never;
export function min<TSource>(
    selector?: (t: TSource) => number | Promise<number>,
): Evaluator<TSource, number>;
export function min(selector?: (t: any) => number | Promise<number>): any {
    return async function(source: AsyncIterable<any>) {
        // If selector is undefined, the source should emit `number`.
        if (selector === undefined) {
            selector = t => t;
        }

        let minimum: number | undefined = undefined;
        for await (const t of source) {
            const curr = await selector(t);
            if (minimum === undefined) {
                minimum = curr;
            }
            if (!isNumber(curr)) {
                throw Error("min can't find the minimum of things that aren't numbers");
            }

            if (minimum > curr) {
                minimum = curr;
            }
        }

        if (minimum === undefined) {
            throw Error("min can't be called on an empty sequence");
        }
        return minimum;
    };
}

export function max<TSource>(): TSource extends number ? Promise<number> : never;
export function max<TSource>(
    selector?: (t: TSource) => number | Promise<number>,
): Evaluator<TSource, number>;
export function max(selector?: (t: any) => number | Promise<number>): any {
    return async function(source: AsyncIterable<any>) {
        // If selector is undefined, the source should emit `number`.
        if (selector === undefined) {
            selector = t => t;
        }

        let maximum: number | undefined = undefined;
        for await (const t of source) {
            const curr = await selector(t);
            if (maximum === undefined) {
                maximum = curr;
            }
            if (!isNumber(curr)) {
                throw Error("max can't find the maximum of things that aren't numbers");
            }

            if (maximum < curr) {
                maximum = curr;
            }
        }

        if (maximum === undefined) {
            throw Error("max can't be called on an empty sequence");
        }
        return maximum;
    };
}

export function average<TSource>(): TSource extends number ? Promise<number> : never;
export function average<TSource>(
    selector?: (t: TSource) => number | Promise<number>,
): Evaluator<TSource, number>;
export function average(selector?: (t: any) => number | Promise<number>): any {
    return async function(source: AsyncIterable<any>) {
        // If selector is undefined, the source should emit `number`.
        if (selector === undefined) {
            selector = t => t;
        }

        let total = 0;
        let cnt = 0;
        for await (const t of source) {
            const toSum = await selector(t);
            if (!isNumber(toSum)) {
                throw Error("Can't sum things that aren't numbers");
            }
            total += toSum;
            cnt++;
        }

        if (cnt === 0) {
            return Promise.reject("Can't compute average of empty sequence");
        }

        return total / cnt;
    };
}

export function aggregate<TSource, TAccumulate>(
    seed: TAccumulate,
    func: (acc: TAccumulate, t: TSource) => TAccumulate | Promise<TAccumulate>,
): Evaluator<TSource, TAccumulate> {
    return async function(source) {
        let acc = seed;
        for await (const t of source) {
            acc = await func(acc, t);
        }
        return acc;
    };
}

//
// Misc.
//

export function zip<TSource1, TSource2, TResult = [TSource1, TSource2]>(
    source1: AsyncIterable<TSource1>,
    source2: AsyncIterable<TSource2>,
    resultSelector: (t1: TSource1, t2: TSource2) => TResult | Promise<TResult> = (t1, t2) =>
        <TResult>(<unknown>[t1, t2]),
): AsyncIterable<TResult> {
    return from(async function*() {
        const iterator1 = source1[Symbol.asyncIterator]();
        const iterator2 = source2[Symbol.asyncIterator]();
        while (true) {
            const result1 = await iterator1.next();
            const result2 = await iterator2.next();
            if (result1.done || result2.done) {
                return;
            } else {
                yield await resultSelector(result1.value, result2.value);
            }
        }
    });
}

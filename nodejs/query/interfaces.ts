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

    /**
     * Filters out all elements in a sequence for which `predicate` does not return true.
     * @param predicate
     * @example
     * await range(0, 3).filter(x => x < 2).toArray(); // == [0, 1]
     */
    filter(
        predicate: (t: TSource, i: number) => boolean | Promise<boolean>,
    ): AsyncQueryable<TSource>;

    //
    // Projection operators.
    //

    /**
     * Transforms each element in a sequence of `TSource` to some number of `TResult`, flattening
     * the result into a single sequence of `TResult`.
     *
     * `transform` performs this transformation. An optional transformation,
     * `intermediateTransform`, pairs each element of the flattened sequence with the input that was
     * passed to `transform` to generate it, and returning some arbitrary transformation. See
     * examples for where this is useful.
     * @param transform Function performing the transformation of one `TSource` element into many
     * `TResult`.
     * @param intermediateTransform Optionally allows transformation of each element of the
     * flattened list resulting from `transform`.
     * @example
     * await from([[1], [2], [3]]).flatMap(x => x).toArray(); // == [1, 2, 3]
     * @example
     * // Take a sequence of customers, then for each order, produce a tuple `[customer, order]`.
     * await customers.flatMap(customer => customer.orders, (customer, order) => [customer, order]);
     */
    flatMap<TInner, TResult = TInner>(
        transform: (t: TSource, index: number) => AsyncQuerySource<TInner>, // TODO: Make this iterable.
        resultTransform?: (t: TSource, ti: TInner) => TResult | Promise<TResult>,
    ): AsyncQueryable<TResult>;

    /**
     * Transforms a sequence of `TSource` into a sequence of `TResult` by calling `transform` on
     * every element in the sequence.
     * @param transform Function performing the transformation of `TSource` to `TResult`.
     * @example
     * await range(0, 2).map(x => x * x).toArray(); // == [0, 1, 4]
     */
    map<TResult>(
        transform: (t: TSource, i: number) => TResult | Promise<TResult>,
    ): AsyncQueryable<TResult>;

    //
    // Partitioning operators.
    //

    /**
     * Skips `n` elements of a sequence, then yields the remainder of the sequence.
     * @param n Number of elements to skip
     * @example
     * await range(0, 3).skip(2).toArray(); // == [2]
     */
    skip(n: number): AsyncQueryable<TSource>;

    /**
     * Skips elements in a sequence while `predicate` returns `true` and then yields the rest of the
     * sequence without testing `predicate` again.
     * @param predicate Tests whether we should keep skipping elements
     * @example
     * await from([1, 2, 3, 4]).skipWhile(x => x < 2).toArray() // == [2, 3, 4]
     */
    skipWhile(
        predicate: (t: TSource, i: number) => boolean | Promise<boolean>,
    ): AsyncQueryable<TSource>;

    /**
     * Takes `n` elements of a sequence, then skips the remainder of the sequence.
     * @param n Number of elements to take from the sequence
     * @example
     * await range(0, 3).take(2).toArray(); // == [0, 1]
     */
    take(n: number): AsyncQueryable<TSource>;

    /**
     * Takes  elements in a sequence while `predicate` returns `true` and then skips the rest of
     * the sequence without testing `predicate` again.
     * @param predicate Tests whether we should keep taking elements
     * @example
     * await from([1, 2, 3, 4]).takeWhile(x => x < 2).toArray() // == [1]
     */
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

    /**
     * Concatenates two sequences.
     * @param second Sequence to concatenate to `this` sequence.
     */
    concat(second: AsyncQuerySource<TSource>): AsyncQueryable<TSource>;

    //
    // Ordering operators.
    //

    /**
     * Enumerates the elements of a sequence in reverse order.
     */
    reverse(): AsyncQueryable<TSource>;

    /**
     * Sorts the elements of a sequence in ascending order.
     *
     * Unlike JavaScript's `Array#sort`, which coerces all objects to string and sorts them
     * lexically, this method requires `keySelector` to perform any conversions explicitly. Among
     * other things, this means that numbers are sorted numerically rather than lexically.
     * @param keySelector Maps an element of the sequence to the key used for sorting.
     */
    orderBy(keySelector: (t: TSource) => OrderKey | Promise<OrderKey>): AsyncQueryable<TSource>;

    /**
     * Sorts the elements of a sequence in descending order.
     *
     * Unlike JavaScript's `Array#sort`, which coerces all objects to string and sorts them
     * lexically, this method requires `keySelector` to perform any conversions explicitly. Among
     * other things, this means that numbers are sorted numerically rather than lexically.
     * @param keySelector Maps an element of the sequence to the key used for sorting.
     */
    orderByDescending(
        keySelector: (t: TSource) => OrderKey | Promise<OrderKey>,
    ): AsyncQueryable<TSource>;

    //
    // Grouping operators.
    //

    /**
     * Collect elements in a sequence into groups whose keys match.
     * @param keySelector Maps an element of the sequence into the key used for grouping.
     * @param elementSelector Optionally transforms each element of the sequence from `TSource` to
     * `TResult`.
     * @example
     * await from([1, 2, 1]).groupBy(x => x).map(g => g.toArray()).toArray(); // [[1, 1], [2]]
     */
    groupBy<TKey, TResult = TSource>(
        keySelector: (t: TSource) => TKey | Promise<TKey>,
        elementSelector?: (t: TSource) => TResult | Promise<TResult>,
    ): AsyncQueryable<AsyncQueryableGrouping<TKey, TResult>>;

    //
    // Set operators.
    //

    /**
     * Suppresses duplicate elements in a sequence.
     */
    distinct(): AsyncQueryable<TSource>;

    /**
     * Produces the set union of two sequences.
     * @param second Sequence to union with `this` sequence.
     * @example
     * await from([1, 2, 3]).union([1, 1, 1, 1, 1]).toArray(); // == [1, 2, 3]
     */
    union(second: AsyncQuerySource<TSource>): AsyncQueryable<TSource>;

    /**
     * Produces the set intersection of two sequences.
     * @param second Sequence to intersect with `this` sequence.
     * @example
     * await from([1, 2, 3]).intersection([1, 1, 1, 1, 1]).toArray(); // == [1]
     */
    intersect(second: AsyncQuerySource<TSource>): AsyncQueryable<TSource>;

    /**
     * Produces the set difference of two sequences.
     * @param second Sequence to diff with `this` sequence.
     * @example
     * await from([1, 2]).except([1, 1, 1, 2, 3, 1, 1]).toArray(); // == [3]
     */
    except(second: AsyncQuerySource<TSource>): AsyncQueryable<TSource>;

    //
    // Element operators.
    //

    /**
     * Find first element in sequence, or first element in sequence that satisfies `predicate`. If
     * sequence is empty or no elements satisfy this condition, throw an exception.
     * @param predicate Optional test for elements in the sequence.
     */
    first(predicate?: (t: TSource) => boolean | Promise<boolean>): Promise<TSource>;

    /**
     * Find first element in sequence, or first element in sequence that satisfies `predicate`, or
     * return provided default value.
     * @param defaultValue Default value to return if element cannot be found.
     * @param predicate Optional test for elements in the sequence.
     */
    firstOrDefault(
        defaultValue: TSource,
        predicate?: (t: TSource) => boolean | Promise<boolean>,
    ): Promise<TSource>;

    /**
     * Find last element in sequence, or last element in sequence that satisfies `predicate`. If
     * sequence is empty or no elements satisfy this condition, throw an exception.
     * @param predicate Optional test for elements in the sequence.
     */
    last(predicate?: (t: TSource) => boolean | Promise<boolean>): Promise<TSource>;

    /**
     * Find last element in sequence, or last element in sequence that satisfies `predicate`, or
     * return provided default value.
     * @param defaultValue Default value to return if element cannot be found.
     * @param predicate Optional test for elements in the sequence.
     */
    lastOrDefault(
        defaultValue: TSource,
        predicate?: (t: TSource) => boolean | Promise<boolean>,
    ): Promise<TSource>;

    /**
     * Return single element in sequence, or single element in sequence that satisfies `predicate`.
     * If sequence is empty or no elements satisfy this condition, throw an exception.
     * @param predicate Optional test for elements in the sequence.
     */
    single(predicate?: (t: TSource) => boolean | Promise<boolean>): Promise<TSource>;

    /**
     * Find single element in sequence, or single element in sequence that satisfies `predicate`, or
     * return provided default value.
     * @param defaultValue Default value to return if element cannot be found.
     * @param predicate Optional test for elements in the sequence.
     */
    singleOrDefault(
        defaultValue: TSource,
        predicate?: (t: TSource) => boolean | Promise<boolean>,
    ): Promise<TSource>;

    /**
     * Return element at `index` in sequence. If `index` is out of range, throw an exception.
     * @param index Zero-based index of the element to return.
     */
    elementAt(index: number): Promise<TSource>;

    /**
     * Return element at `index` in sequence, or the provided default value if the index does not exist.
     * @param defaultValue Default value to return if element cannot be found.
     * @param index Zero-based index of the element to return.
     */
    elementAtOrDefault(defaultValue: TSource, index: number | Promise<number>): Promise<TSource>;

    /**
     * Return `this` sequence, or a sequence containing only `defaultValue` if the sequence is
     * empty.
     * @param defaultValue Default value to return if sequence is empty.
     */
    defaultIfEmpty(defaultValue: TSource): AsyncQueryable<TSource>;

    //
    // Quantifiers.
    //

    /**
     * Retruns `true` if any element of a sequence exists or satisfies `predicate`.
     * @param predicate Boolean function to check against elements of the sequence.
     */
    any(predicate?: (t: TSource) => boolean | Promise<boolean>): Promise<boolean>;

    /**
     * Returns `true` if all elements of a sequence satisfy `predicate`.
     * @param predicate Boolean function to check against elements of the sequence.
     */
    all(predicate: (t: TSource) => boolean | Promise<boolean>): Promise<boolean>;

    /**
     * Returns `true` of sequence contains element equal to `value`.
     * @param value Element to check the sequence contains.
     */
    contains(value: TSource): Promise<boolean>;

    //
    // Aggregate operators.
    //

    /**
     * Counts the number of elements in a sequence, or the number of elements that satisfy
     * `predicate`.
     * @param predicate Function to check against elements of the sequence.
     */
    count(predicate?: (t: TSource) => boolean | Promise<boolean>): Promise<number>;

    /**
     * Sums all the numbers in a sequence.
     */
    sum(): TSource extends number ? Promise<number> : never;

    /**
     * Applies `selector` to each element in a sequence, and then sums the resulting numbers.
     * @param selector Function mapping elements of a sequence to numbers.
     */
    sum(selector?: (t: TSource) => number | Promise<number>): Promise<number>;

    /**
     * Finds the minimum number in a sequence.
     */
    min(): TSource extends number ? Promise<number> : never;

    /**
     * Applies `selector` to each element in a sequence, and then finds the minimum of the resulting
     * numbers.
     * @param selector Function mapping elements of a sequence to numbers.
     */
    min(selector?: (t: TSource) => number | Promise<number>): Promise<number>;

    /**
     * Finds the maximum number in a sequence.
     */
    max(): TSource extends number ? Promise<number> : never;

    /**
     * Applies `selector` to each element in a sequence, and then finds the maximum of the resulting
     * numbers.
     * @param selector Function mapping elements of a sequence to numbers.
     */
    max(selector?: (t: TSource) => number | Promise<number>): Promise<number>;

    /**
     * Averages the numbers of a sequence.
     */
    average(): TSource extends number ? Promise<number> : never;

    /**
     * Applies `selector` to each element in a sequence, and then averages the resulting numbers.
     * @param selector Function mapping elements of a sequence to numbers.
     */
    average(selector?: (t: TSource) => number | Promise<number>): Promise<number>;

    /**
     * Accumulates a value over a sequence. `func` is applied to each element in the sequence, an
     * the result of `func` becomes the `acc` argument in the next application. The first `acc`
     * takes the value `seed`.
     * @param seed Value of `acc` in the first call to `func`.
     * @param func Accumulates a result.
     */
    aggregate<TAccumulate>(
        seed: TAccumulate,
        func: (acc: TAccumulate, t: TSource) => TAccumulate | Promise<TAccumulate>,
    ): Promise<TAccumulate>;

    //
    // Eval operators.
    //

    /**
     * Transforms a sequence of `TSource` to a `Promise<TSource[]>`.
     */
    toArray(): Promise<TSource[]>;

    /**
     * Transforms a sequence into a `Map`.
     * @param keySelector Maps elements in the sequence to keys that will be used in the resulting
     * `Map`.
     * @param elementSelector Optionally maps elements in the sequence into the values used in teh
     * resulting `Map`.
     */
    toMap<TKey, TResult = TSource>(
        keySelector: (t: TSource) => TKey | Promise<TKey>,
        elementSelector?: (t: TSource) => TResult | Promise<TResult>,
    ): Promise<Map<TKey, TResult>>;

    /**
     * Filter out everything in the sequence that is not of type `TResult`, returning a sequence of
     * type `TResult`.
     * @param typeGuard Checks whether element is of type `TResult`.
     */
    ofType<TResult>(typeGuard: (o: any) => o is TResult): AsyncQueryable<TResult>;

    /**
     * Evaluate a function `f` on each element of a sequence.
     * @param f Function to run on each element of the sequence.
     */
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

export interface AsyncQueryableGrouping<TKey, TSource>
    extends GroupedAsyncIterableIterator<TKey, TSource>,
        AsyncQueryable<TSource> {}

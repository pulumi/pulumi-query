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

import * as assert from "assert";

import { from, range } from "..";
import { AsyncQueryableImpl } from "../asyncQueryable";
import { isAsyncIterable, Operator } from "../interfaces";

function assertRejects(done: MochaDone, p: Promise<any>) {
    p.then(() => {
        done(new Error("Expected method to reject."));
    })
        .catch(err => {
            assert.notDeepEqual(err, undefined);
            done();
        })
        .catch(done);
}

describe("IterablePromise sources", () => {
    describe("from", () => {
        it("can be evaluated twice", async () => {
            const xs = from([1, 2, 3]);

            const eval1 = await xs.toArray();
            assert.deepEqual(eval1, [1, 2, 3]);
            const count1 = await xs.count();
            assert.deepEqual(count1, 3);

            const eval2 = await xs.toArray();
            assert.deepEqual(eval2, [1, 2, 3]);
            const count2 = await xs.count();
            assert.deepEqual(count2, 3);

            const ms = from(new Map<string, string>([["foo", "foo"], ["bar", "bar"]]));

            const eval3 = await ms.toArray();
            assert.deepEqual(eval3, [["foo", "foo"], ["bar", "bar"]]);
            const count3 = await ms.count();
            assert.deepEqual(count3, 2);

            const eval4 = await ms.toArray();
            assert.deepEqual(eval4, [["foo", "foo"], ["bar", "bar"]]);
            const count4 = await ms.count();
            assert.deepEqual(count4, 2);

            const groups = ms.groupBy(([k, v]) => k, ([k, v]) => v);
            assert.deepEqual(await groups.count(), 2);
            assert.deepEqual(await groups.count(), 2);

            const flattened1 = ms.flatMap(vs => vs);
            assert.deepEqual(await flattened1.count(), 4);
            assert.deepEqual(await flattened1.count(), 4);

            const flattened2 = ms.flatMap(vs => range(0, 5));
            assert.deepEqual(await flattened2.count(), 10);
            assert.deepEqual(await flattened2.count(), 10);
        });
    });

    describe("range", () => {
        //
        // TODO: Throw error when range overlaps.
        //
        it("produces an empty array for overlapping ranges", async () => {
            let xs = range(0, 0);
            assert.deepEqual(await xs.toArray(), []);
            assert.deepEqual(await xs.count(), 0);
            assert.deepEqual(await xs.count(), 0);

            xs = range(0, -1);
            assert.deepEqual(await xs.toArray(), []);
            assert.deepEqual(await xs.count(), 0);
            assert.deepEqual(await xs.count(), 0);
        });

        it("produces an array of one for boundary case", async () => {
            const xs = range(0, 1);
            assert.deepEqual(await xs.toArray(), [0]);
            assert.deepEqual(await xs.count(), 1);
            assert.deepEqual(await xs.count(), 1);
        });

        it("can produce a range including negative numbers", async () => {
            const xs = range(-3, 2);
            assert.deepEqual(await xs.toArray(), [-3, -2, -1, 0, 1]);
            assert.deepEqual(await xs.count(), 5);
            assert.deepEqual(await xs.count(), 5);
        });

        it("is lazily evaluated by take when range is infinite", async () => {
            const xs = range(0).take(5);
            assert.deepEqual(await xs.toArray(), [0, 1, 2, 3, 4]);
            assert.deepEqual(await xs.count(), 5);
            assert.deepEqual(await xs.count(), 5);
        });

        it("is lazily transformed and filtered when range is infinite", async () => {
            const xs = range(0)
                .map(x => x + 2)
                // If filter is bigger than the take window, we enumerate all numbers and hang
                // forever.
                .filter(x => x <= 10)
                .take(7)
                .map(x => x - 2)
                .filter(x => x > 3);
            assert.deepEqual(await xs.toArray(), [4, 5, 6]);
            assert.deepEqual(await xs.count(), 3);
            assert.deepEqual(await xs.count(), 3);
        });

        it("is lazily flatMap'd when range is infinite", async () => {
            const xs = await range(0)
                // If filter is bigger than the take window, we enumerate all numbers and hang
                // forever.
                .flatMap(x => (x <= 10 ? [x, x] : []))
                .take(5);
            assert.deepEqual(await xs.toArray(), [0, 0, 1, 1, 2]);
            assert.deepEqual(await xs.count(), 5);
            assert.deepEqual(await xs.count(), 5);
        });
    });
});

describe("IterablePromise restriction operators", () => {
    describe("filter", () => {
        it("produces [] when all elements are filtered out", async () => {
            const xs = AsyncQueryableImpl.from([1, 2, 3, 4]).filter(x => x < 0);
            assert.deepEqual(await xs.toArray(), []);
            assert.deepEqual(await xs.count(), 0);
            assert.deepEqual(await xs.count(), 0);
        });

        it("produces an non-empty array when some elements are filtered out", async () => {
            const xs = AsyncQueryableImpl.from([1, 2, 3, 4]).filter(x => x >= 3);
            assert.deepEqual(await xs.toArray(), [3, 4]);
            assert.deepEqual(await xs.count(), 2);
            assert.deepEqual(await xs.count(), 2);
        });
    });
});

describe("IterablePromise projection operators", () => {
    describe("map", () => {
        it("x => x does identity transformation", async () => {
            const xs = AsyncQueryableImpl.from([1, 2, 3, 4]).map(x => x);
            assert.deepEqual(await xs.toArray(), [1, 2, 3, 4]);
            assert.deepEqual(await xs.count(), 4);
            assert.deepEqual(await xs.count(), 4);
        });

        it("x => x+1 adds one to every element", async () => {
            const xs = AsyncQueryableImpl.from([1, 2, 3, 4]).map(x => x + 1);
            assert.deepEqual(await xs.toArray(), [2, 3, 4, 5]);
            assert.deepEqual(await xs.count(), 4);
            assert.deepEqual(await xs.count(), 4);
        });
    });

    describe("flatMap", () => {
        it("produces [] when all elements are filtered out", async () => {
            const xs = AsyncQueryableImpl.from([1, 2, 3, 4]).flatMap(x => []);
            assert.deepEqual(await xs.toArray(), []);
            assert.deepEqual(await xs.count(), 0);
            assert.deepEqual(await xs.count(), 0);
        });

        it("can add elements to an enumerable", async () => {
            const xs = AsyncQueryableImpl.from([1, 2, 3, 4]).flatMap(x => [x, x]);
            assert.deepEqual(await xs.toArray(), [1, 1, 2, 2, 3, 3, 4, 4]);
            assert.deepEqual(await xs.count(), 8);
            assert.deepEqual(await xs.count(), 8);
        });
    });
});

describe("IterablePromise partitioning operators", () => {
    describe("skip", () => {
        it("produces [] when all elements are skipped", async () => {
            let xs = AsyncQueryableImpl.from([1, 2, 3, 4]).skip(4);
            assert.deepEqual(await xs.toArray(), []);
            assert.deepEqual(await xs.count(), 0);
            assert.deepEqual(await xs.count(), 0);

            xs = AsyncQueryableImpl.from([]).skip(4);
            assert.deepEqual(await xs.toArray(), []);
            assert.deepEqual(await xs.count(), 0);
            assert.deepEqual(await xs.count(), 0);

            xs = AsyncQueryableImpl.from(
                (function*() {
                    for (const x of []) {
                        yield x;
                    }
                })(),
            ).skip(4);
            assert.deepEqual(await xs.toArray(), []);
            assert.deepEqual(await xs.count(), 0);
            assert.deepEqual(await xs.count(), 0);

            xs = AsyncQueryableImpl.from([]).skip(0);
            assert.deepEqual(await xs.toArray(), []);
            assert.deepEqual(await xs.count(), 0);
            assert.deepEqual(await xs.count(), 0);

            xs = AsyncQueryableImpl.from(
                (function*() {
                    for (const x of []) {
                        yield x;
                    }
                })(),
            ).skip(0);
            assert.deepEqual(await xs.toArray(), []);
            assert.deepEqual(await xs.count(), 0);
            assert.deepEqual(await xs.count(), 0);
        });

        it("produces non-empty array when not all elements are skipped", async () => {
            let xs = AsyncQueryableImpl.from([1, 2, 3, 4, 5]).skip(4);
            assert.deepEqual(await xs.toArray(), [5]);
            assert.deepEqual(await xs.count(), 1);
            assert.deepEqual(await xs.count(), 1);

            xs = AsyncQueryableImpl.from([1, 2, 3, 4, 5]).skip(0);
            assert.deepEqual(await xs.toArray(), [1, 2, 3, 4, 5]);
            assert.deepEqual(await xs.count(), 5);
            assert.deepEqual(await xs.count(), 5);
        });

        it("throws exception when negative number is provided for n, part 1", async () => {
            try {
                AsyncQueryableImpl.from([1, 2, 3, 4, 5])
                    .skip(-1)
                    .toArray();
            } catch (e) {
                return;
            }
            assert.fail();
        });

        it("throws exception when negative number is provided for n, part 2", async () => {
            try {
                AsyncQueryableImpl.from([])
                    .skip(-1)
                    .toArray();
            } catch (e) {
                return;
            }
        });
    });

    describe("skipWhile", () => {
        it("produces [] when all elements are skipped", async () => {
            let xs = AsyncQueryableImpl.from([1, 2, 3, 4]).skipWhile(x => true);
            assert.deepEqual(await xs.toArray(), []);
            assert.deepEqual(await xs.count(), 0);
            assert.deepEqual(await xs.count(), 0);

            xs = AsyncQueryableImpl.from([]).skipWhile(x => false);
            assert.deepEqual(await xs.toArray(), []);
            assert.deepEqual(await xs.count(), 0);
            assert.deepEqual(await xs.count(), 0);

            xs = AsyncQueryableImpl.from([]).skipWhile(x => true);
            assert.deepEqual(await xs.toArray(), []);
            assert.deepEqual(await xs.count(), 0);
            assert.deepEqual(await xs.count(), 0);
        });

        it("produces non-empty array when not all elements are skipped", async () => {
            let xs = AsyncQueryableImpl.from([1, 2, 3, 4]).skipWhile(x => x < 2);
            assert.deepEqual(await xs.toArray(), [2, 3, 4]);
            assert.deepEqual(await xs.count(), 3);
            assert.deepEqual(await xs.count(), 3);

            xs = AsyncQueryableImpl.from([1, 2, 3, 4]).skipWhile((x, i) => i < 1);
            assert.deepEqual(await xs.toArray(), [2, 3, 4]);
            assert.deepEqual(await xs.count(), 3);
            assert.deepEqual(await xs.count(), 3);
        });

        it("does not invoke the predicate again after it returns false one time", async () => {
            const xs = AsyncQueryableImpl.from([1, 2, 3, 4, 5]).skipWhile(x => x < 2 || x > 3);
            assert.deepEqual(await xs.toArray(), [2, 3, 4, 5]);
            assert.deepEqual(await xs.count(), 4);
            assert.deepEqual(await xs.count(), 4);
        });
    });

    describe("take", () => {
        it("produces [] when no elements are taken", async () => {
            let xs = AsyncQueryableImpl.from([1, 2, 3, 4]).take(0);
            assert.deepEqual(await xs.toArray(), []);
            assert.deepEqual(await xs.count(), 0);
            assert.deepEqual(await xs.count(), 0);

            xs = AsyncQueryableImpl.from([]).take(4);
            assert.deepEqual(await xs.toArray(), []);
            assert.deepEqual(await xs.count(), 0);
            assert.deepEqual(await xs.count(), 0);

            xs = AsyncQueryableImpl.from([]).take(0);
            assert.deepEqual(await xs.toArray(), []);
            assert.deepEqual(await xs.count(), 0);
            assert.deepEqual(await xs.count(), 0);
        });

        it("produces non-empty array when some elements are taken", async () => {
            let xs = AsyncQueryableImpl.from([1, 2, 3, 4, 5]).take(4);
            assert.deepEqual(await xs.toArray(), [1, 2, 3, 4]);
            assert.deepEqual(await xs.count(), 4);
            assert.deepEqual(await xs.count(), 4);

            xs = AsyncQueryableImpl.from([1, 2, 3, 4, 5]).take(8);
            assert.deepEqual(await xs.toArray(), [1, 2, 3, 4, 5]);
            assert.deepEqual(await xs.count(), 5);
            assert.deepEqual(await xs.count(), 5);

            xs = await AsyncQueryableImpl.from([1, 2, 3, 4, 5]).take(5);
            assert.deepEqual(await xs.toArray(), [1, 2, 3, 4, 5]);
            assert.deepEqual(await xs.count(), 5);
            assert.deepEqual(await xs.count(), 5);
        });

        it("throws exception when negative number is provided for n, part 1", async () => {
            try {
                await AsyncQueryableImpl.from([1, 2, 3, 4, 5])
                    .take(-1)
                    .toArray();
            } catch (e) {
                return;
            }
            assert.fail();
        });

        it("throws exception when negative number is provided for n, part 2", async () => {
            try {
                await AsyncQueryableImpl.from([])
                    .take(-1)
                    .toArray();
            } catch (e) {
                return;
            }
            assert.fail();
        });
    });

    describe("takeWhile", () => {
        it("produces [] when no elements are taken", async () => {
            let xs = AsyncQueryableImpl.from([1, 2, 3, 4]).takeWhile(x => false);
            assert.deepEqual(await xs.toArray(), []);
            assert.deepEqual(await xs.count(), 0);
            assert.deepEqual(await xs.count(), 0);

            xs = await AsyncQueryableImpl.from([]).takeWhile(x => true);
            assert.deepEqual(await xs.toArray(), []);
            assert.deepEqual(await xs.count(), 0);
            assert.deepEqual(await xs.count(), 0);

            xs = await AsyncQueryableImpl.from([]).takeWhile(x => false);
            assert.deepEqual(await xs.toArray(), []);
            assert.deepEqual(await xs.count(), 0);
            assert.deepEqual(await xs.count(), 0);
        });

        it("produces non-empty array when some elements are taken", async () => {
            let xs = AsyncQueryableImpl.from([1, 2, 3, 4]).takeWhile(x => x <= 2);
            assert.deepEqual(await xs.toArray(), [1, 2]);
            assert.deepEqual(await xs.count(), 2);
            assert.deepEqual(await xs.count(), 2);

            xs = await AsyncQueryableImpl.from([1, 2, 3, 4]).takeWhile((x, i) => i <= 1);
            assert.deepEqual(await xs.toArray(), [1, 2]);
            assert.deepEqual(await xs.count(), 2);
            assert.deepEqual(await xs.count(), 2);
        });

        it("does not invoke the predicate again after it returns false one time", async () => {
            const xs = AsyncQueryableImpl.from([1, 2, 3, 4, 5]).takeWhile(x => x <= 2 || x > 4);
            assert.deepEqual(await xs.toArray(), [1, 2]);
            assert.deepEqual(await xs.count(), 2);
            assert.deepEqual(await xs.count(), 2);
        });
    });
});

describe("IterablePromise join operators", () => {
    describe("join", () => {
        it("produces [] when no elements are taken", async () => {
            let xs = AsyncQueryableImpl.from([]).join([1, 2, 3], x => x, x => x, (x, y) => [x, y]);
            assert.deepEqual(await xs.toArray(), []);
            assert.deepEqual(await xs.count(), 0);
            assert.deepEqual(await xs.count(), 0);

            xs = AsyncQueryableImpl.from([1, 2, 3]).join([], x => x, x => x, (x, y) => [x, y]);
            assert.deepEqual(await xs.toArray(), []);
            assert.deepEqual(await xs.count(), 0);
            assert.deepEqual(await xs.count(), 0);
        });

        it("joins non-empty sets", async () => {
            const xs = AsyncQueryableImpl.from([1, 2, 3, 4, 5]).join(
                [1, 2, 3],
                x => x,
                x => x,
                (x, y) => [x, y],
            );
            assert.deepEqual(await xs.toArray(), [[1, 1], [2, 2], [3, 3]]);
            assert.deepEqual(await xs.count(), 3);
            assert.deepEqual(await xs.count(), 3);
        });

        it("ignores joins when key selector produces undefined", async () => {
            let xs = AsyncQueryableImpl.from([1, 2, 3, 4, 5]).join(
                [1, 2, 3],
                x => (x === 2 ? undefined : x),
                x => x,
                (x, y) => [x, y],
            );
            assert.deepEqual(await xs.toArray(), [[1, 1], [3, 3]]);
            assert.deepEqual(await xs.count(), 2);
            assert.deepEqual(await xs.count(), 2);

            xs = await AsyncQueryableImpl.from([1, 2, 3, 4, 5]).join(
                [1, 2, 3],
                x => x,
                x => (x === 2 ? undefined : x),
                (x, y) => [x, y],
            );
            assert.deepEqual(await xs.toArray(), [[1, 1], [3, 3]]);
            assert.deepEqual(await xs.count(), 2);
            assert.deepEqual(await xs.count(), 2);

            xs = await AsyncQueryableImpl.from([1, 2, 3, 4, 5]).join(
                [1, 2, 3],
                x => (x === 2 ? null : x),
                x => x,
                (x, y) => [x, y],
            );
            assert.deepEqual(await xs.toArray(), [[1, 1], [3, 3]]);
            assert.deepEqual(await xs.count(), 2);
            assert.deepEqual(await xs.count(), 2);

            xs = await AsyncQueryableImpl.from([1, 2, 3, 4, 5]).join(
                [1, 2, 3],
                x => x,
                x => (x === 2 ? null : x),
                (x, y) => [x, y],
            );
            assert.deepEqual(await xs.toArray(), [[1, 1], [3, 3]]);
            assert.deepEqual(await xs.count(), 2);
            assert.deepEqual(await xs.count(), 2);
        });

        it("joins multiple inner records to one outer record", async () => {
            let xs = await AsyncQueryableImpl.from([1, 2, 2, 3, 4, 5]).join(
                [1, 2],
                x => x,
                x => x,
                (x, y) => [x, y],
            );
            assert.deepEqual(await xs.toArray(), [[1, 1], [2, 2], [2, 2]]);
            assert.deepEqual(await xs.count(), 3);
            assert.deepEqual(await xs.count(), 3);

            xs = await AsyncQueryableImpl.from([1, 2]).join(
                [1, 2, 2, 3, 4, 5],
                x => x,
                x => x,
                (x, y) => [x, y],
            );
            assert.deepEqual(await xs.toArray(), [[1, 1], [2, 2], [2, 2]]);
            assert.deepEqual(await xs.count(), 3);
            assert.deepEqual(await xs.count(), 3);

            xs = await AsyncQueryableImpl.from([1, 2, 2]).join(
                [1, 2, 2, 3, 4, 5],
                x => x,
                x => x,
                (x, y) => [x, y],
            );
            assert.deepEqual(await xs.toArray(), [[1, 1], [2, 2], [2, 2], [2, 2], [2, 2]]);
            assert.deepEqual(await xs.count(), 5);
            assert.deepEqual(await xs.count(), 5);
        });
    });
});

describe("IterablePromise concatenation operators", () => {
    describe("concat", () => {
        //
        // These tests exist, in part, to make sure that type inference works for the complex types
        // in the signatures of `concat` and `from`.
        //

        it("concats T[]", async () => {
            let xs = AsyncQueryableImpl.from([1, 2]).concat([3, 4]);
            assert.deepEqual(await xs.toArray(), [1, 2, 3, 4]);
            assert.deepEqual(await xs.count(), 4);
            assert.deepEqual(await xs.count(), 4);

            xs = AsyncQueryableImpl.from<number>([]).concat([3, 4]);
            assert.deepEqual(await xs.toArray(), [3, 4]);
            assert.deepEqual(await xs.count(), 2);
            assert.deepEqual(await xs.count(), 2);

            xs = AsyncQueryableImpl.from([1, 2]).concat([]);
            assert.deepEqual(await xs.toArray(), [1, 2]);
            assert.deepEqual(await xs.count(), 2);
            assert.deepEqual(await xs.count(), 2);
        });

        it("concats Promise<T[]>", async () => {
            let xs = AsyncQueryableImpl.from([1, 2]).concat([3, 4]);
            assert.deepEqual(await xs.toArray(), [1, 2, 3, 4]);
            assert.deepEqual(await xs.count(), 4);
            assert.deepEqual(await xs.count(), 4);

            xs = AsyncQueryableImpl.from([1, 2]).concat([3, 4]);
            assert.deepEqual(await xs.toArray(), [1, 2, 3, 4]);
            assert.deepEqual(await xs.count(), 4);
            assert.deepEqual(await xs.count(), 4);

            xs = AsyncQueryableImpl.from<number>([]).concat([3, 4]);
            assert.deepEqual(await xs.toArray(), [3, 4]);
            assert.deepEqual(await xs.count(), 2);
            assert.deepEqual(await xs.count(), 2);

            xs = AsyncQueryableImpl.from<number>([]).concat([3, 4]);
            assert.deepEqual(await xs.toArray(), [3, 4]);
            assert.deepEqual(await xs.count(), 2);
            assert.deepEqual(await xs.count(), 2);

            xs = AsyncQueryableImpl.from([1, 2]).concat([]);
            assert.deepEqual(await xs.toArray(), [1, 2]);
            assert.deepEqual(await xs.count(), 2);
            assert.deepEqual(await xs.count(), 2);

            xs = AsyncQueryableImpl.from([1, 2]).concat([]);
            assert.deepEqual(await xs.toArray(), [1, 2]);
            assert.deepEqual(await xs.count(), 2);
            assert.deepEqual(await xs.count(), 2);
        });

        it("concats iterators", async () => {
            //
            // TODO: Make `from` take generator functions.
            //

            let xs = AsyncQueryableImpl.from(
                from(function*() {
                    for (const x of [1, 2]) {
                        yield x;
                    }
                }),
            ).concat([3, 4]);
            assert.deepEqual(await xs.toArray(), [1, 2, 3, 4]);
            assert.deepEqual(await xs.toArray(), [1, 2, 3, 4]);
            assert.deepEqual(await xs.count(), 4);
            assert.deepEqual(await xs.count(), 4);

            xs = AsyncQueryableImpl.from([1, 2]).concat(
                from(function*() {
                    for (const x of [3, 4]) {
                        yield x;
                    }
                }),
            );
            assert.deepEqual(await xs.toArray(), [1, 2, 3, 4]);
            assert.deepEqual(await xs.count(), 4);
            assert.deepEqual(await xs.count(), 4);

            xs = AsyncQueryableImpl.from<number>(
                from(function*() {
                    for (const x of []) {
                        yield x;
                    }
                }),
            ).concat([3, 4]);
            assert.deepEqual(await xs.toArray(), [3, 4]);
            assert.deepEqual(await xs.count(), 2);
            assert.deepEqual(await xs.count(), 2);

            xs = AsyncQueryableImpl.from<number>([]).concat(
                from(function*() {
                    for (const x of [3, 4]) {
                        yield x;
                    }
                }),
            );
            assert.deepEqual(await xs.toArray(), [3, 4]);
            assert.deepEqual(await xs.count(), 2);
            assert.deepEqual(await xs.count(), 2);

            xs = AsyncQueryableImpl.from(
                from(function*() {
                    for (const x of [1, 2]) {
                        yield x;
                    }
                }),
            ).concat([]);
            assert.deepEqual(await xs.toArray(), [1, 2]);
            assert.deepEqual(await xs.count(), 2);
            assert.deepEqual(await xs.count(), 2);

            xs = AsyncQueryableImpl.from([1, 2]).concat(
                from(function*() {
                    for (const x of []) {
                        yield x;
                    }
                }),
            );
            assert.deepEqual(await xs.toArray(), [1, 2]);
            assert.deepEqual(await xs.count(), 2);
            assert.deepEqual(await xs.count(), 2);
        });
    });
});

describe("IterablePromise ordering operators", () => {
    describe("reverse", () => {
        it("produces [] for empty array", async () => {
            let xs = AsyncQueryableImpl.from([]).reverse();
            assert.deepEqual(await xs.toArray(), []);
            assert.deepEqual(await xs.count(), 0);
            assert.deepEqual(await xs.count(), 0);

            xs = await AsyncQueryableImpl.from(
                (function*() {
                    for (const x of []) {
                        yield x;
                    }
                })(),
            ).reverse();
            assert.deepEqual(await xs.toArray(), []);
            assert.deepEqual(await xs.count(), 0);
            assert.deepEqual(await xs.count(), 0);
        });
    });

    describe("orderBy", () => {
        it("correctly sorts number keys", async () => {
            let xs = AsyncQueryableImpl.from<number>([]).orderBy(x => x);
            assert.deepEqual(await xs.toArray(), []);
            assert.deepEqual(await xs.count(), 0);
            assert.deepEqual(await xs.count(), 0);

            xs = AsyncQueryableImpl.from([2, 3, 1, 14]).orderBy(x => x);
            assert.deepEqual(await xs.toArray(), [1, 2, 3, 14]);
            assert.deepEqual(await xs.count(), 4);
            assert.deepEqual(await xs.count(), 4);
        });

        it("lexically sorts string keys", async () => {
            const xs = AsyncQueryableImpl.from([2, 3, 1, 14]).orderBy(x => x.toString());
            assert.deepEqual(await xs.toArray(), [1, 14, 2, 3]);
            assert.deepEqual(await xs.count(), 4);
            assert.deepEqual(await xs.count(), 4);
        });

        it("rejects if key function returns something other than number | string", done => {
            assertRejects(
                done,
                AsyncQueryableImpl.from([2, 3, 1, 14])
                    .orderBy(() => <any>[2])
                    .toArray(),
            );
        });

        it("rejects if key function does not return only keys of one type", done => {
            assertRejects(
                done,
                AsyncQueryableImpl.from([2, 3, 1, 14])
                    .orderBy(x => {
                        if (x === 2) {
                            return "2";
                        }
                        return x;
                    })
                    .toArray(),
            );
        });
    });
});

describe("IterablePromise grouping operators", () => {
    describe("groupBy", () => {
        it("produces [] for empty array", async () => {
            let xs = AsyncQueryableImpl.from([]).groupBy(x => x);
            assert.deepEqual(await xs.toArray(), []);
            assert.deepEqual(await xs.count(), 0);
            assert.deepEqual(await xs.count(), 0);

            xs = AsyncQueryableImpl.from(
                (function*() {
                    for (const x of []) {
                        yield x;
                    }
                })(),
            ).groupBy(x => x);
            assert.deepEqual(await xs.toArray(), []);
            assert.deepEqual(await xs.count(), 0);
            assert.deepEqual(await xs.count(), 0);
        });

        it("produces non-empty groups when array is not empty", async () => {
            let xs = AsyncQueryableImpl.from([1])
                .groupBy(x => x)
                .map(g => g.toArray());
            assert.deepEqual(await xs.toArray(), [[1]]);
            assert.deepEqual(await xs.count(), 1);
            assert.deepEqual(await xs.count(), 1);

            xs = AsyncQueryableImpl.from(
                from(function*() {
                    for (const x of [1]) {
                        yield x;
                    }
                }),
            )
                .groupBy(x => x)
                .map(g => g.toArray());
            assert.deepEqual(await xs.toArray(), [[1]]);
            assert.deepEqual(await xs.count(), 1);
            assert.deepEqual(await xs.count(), 1);

            xs = AsyncQueryableImpl.from([1, 2])
                .groupBy(x => x)
                .map(g => g.toArray());
            assert.deepEqual(await xs.toArray(), [[1], [2]]);
            assert.deepEqual(await xs.count(), 2);
            assert.deepEqual(await xs.count(), 2);

            xs = AsyncQueryableImpl.from(
                from(function*() {
                    for (const x of [1, 2]) {
                        yield x;
                    }
                }),
            )
                .groupBy(x => x)
                .map(g => g.toArray());
            assert.deepEqual(await xs.toArray(), [[1], [2]]);
            assert.deepEqual(await xs.count(), 2);
            assert.deepEqual(await xs.count(), 2);

            xs = AsyncQueryableImpl.from([1, 2, 1])
                .groupBy(x => x)
                .map(g => g.toArray());
            assert.deepEqual(await xs.toArray(), [[1, 1], [2]]);
            assert.deepEqual(await xs.count(), 2);
            assert.deepEqual(await xs.count(), 2);

            xs = AsyncQueryableImpl.from(
                from(function*() {
                    for (const x of [1, 2, 1]) {
                        yield x;
                    }
                }),
            )
                .groupBy(x => x)
                .map(g => g.toArray());
            assert.deepEqual(await xs.toArray(), [[1, 1], [2]]);
            assert.deepEqual(await xs.count(), 2);
            assert.deepEqual(await xs.count(), 2);

            const ys = AsyncQueryableImpl.from([
                { foo: "bar", bar: 1 },
                { foo: "baz" },
                { foo: undefined },
                { foo: "bar", bar: 2 },
            ])
                .groupBy(x => x.foo)
                .map(g => g.toArray());
            assert.deepEqual(await ys.toArray(), [
                [{ foo: "bar", bar: 1 }, { foo: "bar", bar: 2 }],
                [{ foo: "baz" }],
                [{ foo: undefined }],
            ]);
            assert.deepEqual(await ys.count(), 3);
            assert.deepEqual(await ys.count(), 3);
        });

        it("produces projected elements when result selector is used", async () => {
            const ys = AsyncQueryableImpl.from([
                { foo: "bar", bar: 1 },
                { foo: "baz" },
                { foo: undefined },
                { foo: "bar", bar: 2 },
            ])
                .groupBy(x => x.foo, x => x.foo)
                .map(g => g.toArray());
            assert.deepEqual(await ys.toArray(), [["bar", "bar"], ["baz"], [undefined]]);
            assert.deepEqual(await ys.count(), 3);
            assert.deepEqual(await ys.count(), 3);
        });
    });
});

describe("IterablePromise set operators", () => {
    describe("distinct", () => {
        it("produces [] for empty array", async () => {
            const xs = AsyncQueryableImpl.from([]).distinct();
            assert.deepEqual(await xs.toArray(), []);
            assert.deepEqual(await xs.count(), 0);
            assert.deepEqual(await xs.count(), 0);
        });

        it("produces non-empty set when array is not empty", async () => {
            let xs = AsyncQueryableImpl.from([1, 2, 3]).distinct();
            assert.deepEqual(await xs.toArray(), [1, 2, 3]);
            assert.deepEqual(await xs.count(), 3);
            assert.deepEqual(await xs.count(), 3);

            xs = AsyncQueryableImpl.from([1, 1, 1, 2, 3, 1, 1]).distinct();
            assert.deepEqual(await xs.toArray(), [1, 2, 3]);
            assert.deepEqual(await xs.count(), 3);
            assert.deepEqual(await xs.count(), 3);
        });
    });

    describe("union", () => {
        it("produces [] for empty array", async () => {
            const xs = AsyncQueryableImpl.from([]).union([]);
            assert.deepEqual(await xs.toArray(), []);
            assert.deepEqual(await xs.count(), 0);
            assert.deepEqual(await xs.count(), 0);
        });

        it("produces non-empty set when array is not empty", async () => {
            let xs = AsyncQueryableImpl.from([1, 2, 3]).union([]);
            assert.deepEqual(await xs.toArray(), [1, 2, 3]);
            assert.deepEqual(await xs.count(), 3);
            assert.deepEqual(await xs.count(), 3);

            xs = AsyncQueryableImpl.from<number>([]).union([1, 1, 1, 2, 3, 1, 1]);
            assert.deepEqual(await xs.toArray(), [1, 2, 3]);
            assert.deepEqual(await xs.count(), 3);
            assert.deepEqual(await xs.count(), 3);

            xs = AsyncQueryableImpl.from([1, 2, 3]).union([1, 1, 1, 2, 3, 1, 1]);
            assert.deepEqual(await xs.toArray(), [1, 2, 3]);
            assert.deepEqual(await xs.count(), 3);
            assert.deepEqual(await xs.count(), 3);

            xs = AsyncQueryableImpl.from([1, 1, 1, 2, 3, 1, 1]).union([1, 2, 3]);
            assert.deepEqual(await xs.toArray(), [1, 2, 3]);
            assert.deepEqual(await xs.count(), 3);
            assert.deepEqual(await xs.count(), 3);

            xs = AsyncQueryableImpl.from([1, 1, 1, 2, 3, 1, 1, 4, 4, 5, 4]).union([1, 2, 3]);
            assert.deepEqual(await xs.toArray(), [1, 2, 3, 4, 5]);
            assert.deepEqual(await xs.count(), 5);
            assert.deepEqual(await xs.count(), 5);
        });
    });

    describe("intersect", () => {
        it("produces [] when there is no set intersection", async () => {
            let xs = AsyncQueryableImpl.from<number>([]).intersect([]);
            assert.deepEqual(await xs.toArray(), []);
            assert.deepEqual(await xs.count(), 0);
            assert.deepEqual(await xs.count(), 0);

            xs = AsyncQueryableImpl.from([1, 2, 3]).intersect([]);
            assert.deepEqual(await xs.toArray(), []);
            assert.deepEqual(await xs.count(), 0);
            assert.deepEqual(await xs.count(), 0);

            xs = AsyncQueryableImpl.from<number>([]).intersect([1, 2, 3]);
            assert.deepEqual(await xs.toArray(), []);
            assert.deepEqual(await xs.count(), 0);
            assert.deepEqual(await xs.count(), 0);

            xs = AsyncQueryableImpl.from<number>([1, 2, 3]).intersect([4, 5, 6]);
            assert.deepEqual(await xs.toArray(), []);
            assert.deepEqual(await xs.count(), 0);
            assert.deepEqual(await xs.count(), 0);
        });

        it("produces non-empty set when intersection is not empty", async () => {
            let xs = AsyncQueryableImpl.from([1, 2, 3]).intersect([1]);
            assert.deepEqual(await xs.toArray(), [1]);
            assert.deepEqual(await xs.count(), 1);
            assert.deepEqual(await xs.count(), 1);

            xs = AsyncQueryableImpl.from<number>([1, 2]).intersect([1, 1, 1, 2, 3, 1, 1]);
            assert.deepEqual(await xs.toArray(), [1, 2]);
            assert.deepEqual(await xs.count(), 2);
            assert.deepEqual(await xs.count(), 2);

            xs = AsyncQueryableImpl.from<number>([1, 1, 1, 2, 3, 1, 1]).intersect([1, 2]);
            assert.deepEqual(await xs.toArray(), [1, 2]);
            assert.deepEqual(await xs.count(), 2);
            assert.deepEqual(await xs.count(), 2);

            xs = AsyncQueryableImpl.from([1, 1, 1, 2, 3, 1, 1]).intersect([1, 2, 3]);
            assert.deepEqual(await xs.toArray(), [1, 2, 3]);
            assert.deepEqual(await xs.count(), 3);
            assert.deepEqual(await xs.count(), 3);
        });
    });

    describe("except", () => {
        it("produces [] when there is no set difference", async () => {
            let xs = AsyncQueryableImpl.from<number>([]).except([]);
            assert.deepEqual(await xs.toArray(), []);
            assert.deepEqual(await xs.count(), 0);
            assert.deepEqual(await xs.count(), 0);

            xs = AsyncQueryableImpl.from([1, 2, 3]).except([1, 2, 3]);
            assert.deepEqual(await xs.toArray(), []);
            assert.deepEqual(await xs.count(), 0);
            assert.deepEqual(await xs.count(), 0);

            xs = AsyncQueryableImpl.from([1, 2, 3]).except([1, 1, 1, 2, 3, 1, 1]);
            assert.deepEqual(await xs.toArray(), []);
            assert.deepEqual(await xs.count(), 0);
            assert.deepEqual(await xs.count(), 0);

            xs = AsyncQueryableImpl.from([1, 1, 1, 2, 3, 1, 1]).except([1, 2, 3]);
            assert.deepEqual(await xs.toArray(), []);
            assert.deepEqual(await xs.count(), 0);
            assert.deepEqual(await xs.count(), 0);
        });

        it("produces non-empty set when set difference is not empty", async () => {
            let xs = AsyncQueryableImpl.from([1, 2, 3]).except([1]);
            assert.deepEqual(await xs.toArray(), [2, 3]);
            assert.deepEqual(await xs.count(), 2);
            assert.deepEqual(await xs.count(), 2);

            xs = AsyncQueryableImpl.from<number>([1, 2]).except([1, 1, 1, 2, 3, 1, 1]);
            assert.deepEqual(await xs.toArray(), [3]);
            assert.deepEqual(await xs.count(), 1);
            assert.deepEqual(await xs.count(), 1);

            xs = AsyncQueryableImpl.from<number>([1, 1, 1, 2, 3, 1, 1]).except([1, 2]);
            assert.deepEqual(await xs.toArray(), [3]);
            assert.deepEqual(await xs.count(), 1);
            assert.deepEqual(await xs.count(), 1);
        });
    });
});

describe("IterablePromise element operators", () => {
    describe("first", () => {
        it("throws error if enumerable is empty", done => {
            assertRejects(done, AsyncQueryableImpl.from([]).first());
        });

        it("throws error if predicate specifies non-existent element", done => {
            assertRejects(done, AsyncQueryableImpl.from([1, 2, 3]).first(x => x === 4));
        });

        it("finds first element of sequence", async () => {
            let xs = AsyncQueryableImpl.from([1, 2, 3]);
            assert.deepEqual(await xs.first(), 1);
            assert.deepEqual(await xs.first(), 1);

            xs = AsyncQueryableImpl.from(
                from(function*() {
                    for (const x of [1, 2, 3]) {
                        yield x;
                    }
                }),
            );
            assert.deepEqual(await xs.first(), 1);
            assert.deepEqual(await xs.first(), 1);
        });
    });

    describe("firstOrDefault", () => {
        it("default value populated if enumerable is empty", async () => {
            let xs = AsyncQueryableImpl.from<number>([]);
            assert.deepEqual(await xs.firstOrDefault(99), 99);
            assert.deepEqual(await xs.firstOrDefault(99), 99);

            xs = AsyncQueryableImpl.from<number>(
                (function*() {
                    for (const x of []) {
                        yield x;
                    }
                })(),
            );
            assert.deepEqual(await xs.firstOrDefault(99), 99);
            assert.deepEqual(await xs.firstOrDefault(99), 99);
        });

        it("default value if predicate specifies non-existent element", async () => {
            let xs = AsyncQueryableImpl.from([1, 2, 3]);
            assert.deepEqual(await xs.firstOrDefault(99, x => x === 4), 99);
            assert.deepEqual(await xs.firstOrDefault(99, x => x === 4), 99);

            xs = AsyncQueryableImpl.from(
                (function*() {
                    for (const x of [1, 2, 3]) {
                        yield x;
                    }
                })(),
            );
            assert.deepEqual(await xs.firstOrDefault(99, x => x === 4), 99);
            assert.deepEqual(await xs.firstOrDefault(99, x => x === 4), 99);
        });

        it("finds first element of sequence", async () => {
            let xs = AsyncQueryableImpl.from([1, 2, 3]);
            assert.deepEqual(await xs.firstOrDefault(99), 1);
            assert.deepEqual(await xs.firstOrDefault(99), 1);

            xs = AsyncQueryableImpl.from(
                from(function*() {
                    for (const x of [1, 2, 3]) {
                        yield x;
                    }
                }),
            );
            assert.deepEqual(await xs.firstOrDefault(99), 1);
            assert.deepEqual(await xs.firstOrDefault(99), 1);
        });
    });

    describe("last", () => {
        it("throws error if enumerable is empty", done => {
            assertRejects(done, AsyncQueryableImpl.from([]).last());
        });

        it("throws error if predicate specifies non-existent element", done => {
            assertRejects(done, AsyncQueryableImpl.from([1, 2, 3]).last(x => x === 4));
        });

        it("finds last element of sequence", async () => {
            let xs = AsyncQueryableImpl.from([1, 2, 3]);
            assert.deepEqual(await xs.last(), 3);
            assert.deepEqual(await xs.last(), 3);

            xs = AsyncQueryableImpl.from(
                from(function*() {
                    for (const x of [1, 2, 3]) {
                        yield x;
                    }
                }),
            );
            assert.deepEqual(await xs.last(), 3);
            assert.deepEqual(await xs.last(), 3);
        });
    });

    describe("lastOrDefault", () => {
        it("default value populated if enumerable is empty", async () => {
            let xs = AsyncQueryableImpl.from<number>([]);
            assert.deepEqual(await xs.lastOrDefault(99), 99);
            assert.deepEqual(await xs.lastOrDefault(99), 99);

            xs = AsyncQueryableImpl.from<number>(
                from(function*() {
                    for (const x of []) {
                        yield x;
                    }
                }),
            );
            assert.deepEqual(await xs.lastOrDefault(99), 99);
            assert.deepEqual(await xs.lastOrDefault(99), 99);
        });

        it("default value if predicate specifies non-existent element", async () => {
            let xs = AsyncQueryableImpl.from([1, 2, 3]);
            assert.deepEqual(await xs.lastOrDefault(99, x => x === 4), 99);
            assert.deepEqual(await xs.lastOrDefault(99, x => x === 4), 99);

            xs = AsyncQueryableImpl.from(
                from(function*() {
                    for (const x of [1, 2, 3]) {
                        yield x;
                    }
                }),
            );
            assert.deepEqual(await xs.lastOrDefault(99, x => x === 4), 99);
            assert.deepEqual(await xs.lastOrDefault(99, x => x === 4), 99);
        });

        it("finds first element of sequence", async () => {
            let xs = AsyncQueryableImpl.from([1, 2, 3]);
            assert.deepEqual(await xs.lastOrDefault(99), 3);
            assert.deepEqual(await xs.lastOrDefault(99), 3);

            xs = AsyncQueryableImpl.from(
                from(function*() {
                    for (const x of [1, 2, 3]) {
                        yield x;
                    }
                }),
            );
            assert.deepEqual(await xs.lastOrDefault(99), 3);
            assert.deepEqual(await xs.lastOrDefault(99), 3);
        });
    });

    describe("single", () => {
        it("throws error if enumerable is empty", done => {
            assertRejects(done, AsyncQueryableImpl.from([]).single());
        });

        it("throws error if enumerable has more than 1 element", done => {
            assertRejects(done, AsyncQueryableImpl.from([1, 2]).single());
        });

        it("throws error if predicate specifies non-existent element", done => {
            assertRejects(done, AsyncQueryableImpl.from([1, 2, 3]).single(x => x === 4));
        });

        it("throws error if predicate specifies multiple elements", done => {
            assertRejects(done, AsyncQueryableImpl.from([1, 2, 2, 3]).single(x => x === 2));
        });

        it("finds single element of sequence", async () => {
            let xs = AsyncQueryableImpl.from([1, 2, 3]);
            assert.deepEqual(await xs.single(x => x === 2), 2);
            assert.deepEqual(await xs.single(x => x === 2), 2);

            xs = AsyncQueryableImpl.from(
                from(function*() {
                    for (const x of [1, 2, 3]) {
                        yield x;
                    }
                }),
            );
            assert.deepEqual(await xs.single(x => x === 2), 2);
            assert.deepEqual(await xs.single(x => x === 2), 2);

            xs = AsyncQueryableImpl.from([1]);
            assert.deepEqual(await xs.single(), 1);
            assert.deepEqual(await xs.single(), 1);

            xs = AsyncQueryableImpl.from(
                from(function*() {
                    for (const x of [1]) {
                        yield x;
                    }
                }),
            );
            assert.deepEqual(await xs.single(), 1);
            assert.deepEqual(await xs.single(), 1);
        });
    });

    describe("singleOrDefault", () => {
        it("default value if enumerable is empty", async () => {
            let xs = AsyncQueryableImpl.from<number>([]);
            assert.deepEqual(await xs.singleOrDefault(99), 99);
            assert.deepEqual(await xs.singleOrDefault(99), 99);

            xs = AsyncQueryableImpl.from(
                from(function*() {
                    for (const x of [99]) {
                        yield x;
                    }
                }),
            );
            assert.deepEqual(await xs.singleOrDefault(99), 99);
            assert.deepEqual(await xs.singleOrDefault(99), 99);
        });

        it("throw error if enumerable has more than 1 element and default predicate", done => {
            assertRejects(done, AsyncQueryableImpl.from([1, 2]).singleOrDefault(99));
        });

        it("default value if predicate specifies non-existent element", async () => {
            let xs = AsyncQueryableImpl.from([1, 2, 3]);
            assert.deepEqual(await xs.singleOrDefault(99, x => x === 4), 99);
            assert.deepEqual(await xs.singleOrDefault(99, x => x === 4), 99);

            xs = AsyncQueryableImpl.from(
                from(function*() {
                    for (const x of [1, 2, 3]) {
                        yield x;
                    }
                }),
            );
            assert.deepEqual(await xs.singleOrDefault(99, x => x === 4), 99);
            assert.deepEqual(await xs.singleOrDefault(99, x => x === 4), 99);
        });

        it("throws error if predicate specifies multiple elements", done => {
            assertRejects(
                done,
                AsyncQueryableImpl.from([1, 2, 2, 3]).singleOrDefault(99, x => x === 2),
            );
        });

        it("finds single element of sequence", async () => {
            let xs = AsyncQueryableImpl.from([1, 2, 3]);
            assert.deepEqual(await xs.singleOrDefault(99, x => x === 2), 2);
            assert.deepEqual(await xs.singleOrDefault(99, x => x === 2), 2);

            xs = AsyncQueryableImpl.from(
                from(function*() {
                    for (const x of [1, 2, 3]) {
                        yield x;
                    }
                }),
            );
            assert.deepEqual(await xs.singleOrDefault(99, x => x === 2), 2);
            assert.deepEqual(await xs.singleOrDefault(99, x => x === 2), 2);

            xs = AsyncQueryableImpl.from([1]);
            assert.deepEqual(await xs.singleOrDefault(99), 1);
            assert.deepEqual(await xs.singleOrDefault(99), 1);

            xs = AsyncQueryableImpl.from(
                from(function*() {
                    for (const x of [1]) {
                        yield x;
                    }
                }),
            );
            assert.deepEqual(await xs.singleOrDefault(99), 1);
            assert.deepEqual(await xs.singleOrDefault(99), 1);
        });
    });

    describe("elementAt", () => {
        it("finds element at in-range index", async () => {
            const xs = AsyncQueryableImpl.from([1, 2, 3]);
            assert.deepEqual(await xs.elementAt(1), 2);
            assert.deepEqual(await xs.elementAt(1), 2);
        });

        it("throws error if index is out-of-range", done => {
            assertRejects(done, AsyncQueryableImpl.from([1, 2, 3]).elementAt(3));
        });

        it("throws error if index is out-of-range", done => {
            assertRejects(done, AsyncQueryableImpl.from([]).elementAt(0));
        });

        it("throws error if index is out-of-range", done => {
            assertRejects(done, AsyncQueryableImpl.from([]).elementAt(-1));
        });

        it("throws error if index is out-of-range", done => {
            assertRejects(
                done,
                AsyncQueryableImpl.from(
                    (function*() {
                        for (const x of [1]) {
                            yield x;
                        }
                    })(),
                ).elementAt(-1),
            );
        });
    });

    describe("elementAtOrDefault", () => {
        it("finds element at in-range index", async () => {
            const xs = await AsyncQueryableImpl.from([1, 2, 3]);
            assert.deepEqual(await xs.elementAtOrDefault(99, 1), 2);
            assert.deepEqual(await xs.elementAtOrDefault(99, 1), 2);
        });

        it("default value if index is out-of-range", async () => {
            let xs = AsyncQueryableImpl.from([1, 2, 3]);
            assert.deepEqual(await xs.elementAtOrDefault(99, 3), 99);
            assert.deepEqual(await xs.elementAtOrDefault(99, 3), 99);

            xs = AsyncQueryableImpl.from<number>([]);
            assert.deepEqual(await xs.elementAtOrDefault(99, 0), 99);
            assert.deepEqual(await xs.elementAtOrDefault(99, 0), 99);

            xs = AsyncQueryableImpl.from<number>([]);
            assert.deepEqual(await xs.elementAtOrDefault(99, -1), 99);
            assert.deepEqual(await xs.elementAtOrDefault(99, -1), 99);
        });
    });

    describe("defaultIfEmpty", () => {
        it("default value if empty", async () => {
            const xs = AsyncQueryableImpl.from<number>([]).defaultIfEmpty(99);
            assert.deepEqual(await xs.toArray(), [99]);
            assert.deepEqual(await xs.count(), 1);
            assert.deepEqual(await xs.count(), 1);
        });

        it("identity if not empty", async () => {
            const xs = AsyncQueryableImpl.from([1, 2, 3]).defaultIfEmpty(99);
            assert.deepEqual(await xs.toArray(), [1, 2, 3]);
            assert.deepEqual(await xs.count(), 3);
            assert.deepEqual(await xs.count(), 3);
        });
    });
});

describe("IterablePromise quantifier operators", () => {
    describe("any", () => {
        it("false if nothing satisfies predicate", async () => {
            let res = AsyncQueryableImpl.from<number>([]);
            assert.deepEqual(await res.any(x => x > 3), false);

            res = AsyncQueryableImpl.from([1]);
            assert.deepEqual(await res.any(x => x > 3), false);
            assert.deepEqual(await res.any(x => x > 3), false);
        });

        it("true if >= 1 thing satisfies predicate", async () => {
            let res = AsyncQueryableImpl.from([4]);
            assert.deepEqual(await res.any(x => x > 3), true);
            assert.deepEqual(await res.any(x => x > 3), true);

            res = AsyncQueryableImpl.from([4, 5]);
            assert.deepEqual(await res.any(x => x > 3), true);
            assert.deepEqual(await res.any(x => x > 3), true);

            res = AsyncQueryableImpl.from([3, 4, 5]);
            assert.deepEqual(await res.any(x => x > 3), true);
            assert.deepEqual(await res.any(x => x > 3), true);
        });
    });

    describe("all", () => {
        it("empty sequence satisfies predicate", async () => {
            let res = AsyncQueryableImpl.from<number>([]);
            assert.deepEqual(await res.all(x => x > 3), true);
            assert.deepEqual(await res.all(x => x > 3), true);

            res = AsyncQueryableImpl.from(
                from(function*() {
                    for (const x of []) {
                        yield x;
                    }
                }),
            );
            assert.deepEqual(await res.all(x => x > 3), true);
            assert.deepEqual(await res.all(x => x > 3), true);
        });

        it("returns false when not everything satisfies predicate", async () => {
            let res = AsyncQueryableImpl.from([1, 2, 3]);
            assert.deepEqual(await res.all(x => x > 2), false);
            assert.deepEqual(await res.all(x => x > 2), false);

            res = AsyncQueryableImpl.from(
                from(function*() {
                    for (const x of [1, 2, 3]) {
                        yield x;
                    }
                }),
            );
            assert.deepEqual(await res.all(x => x > 2), false);
            assert.deepEqual(await res.all(x => x > 2), false);
        });

        it("returns false when not everything satisfies predicate", async () => {
            let res = AsyncQueryableImpl.from([2, 3]);
            assert.deepEqual(await res.all(x => x >= 2), true);
            assert.deepEqual(await res.all(x => x >= 2), true);

            res = AsyncQueryableImpl.from(
                from(function*() {
                    for (const x of [2, 3]) {
                        yield x;
                    }
                }),
            );
            assert.deepEqual(await res.all(x => x >= 2), true);
            assert.deepEqual(await res.all(x => x >= 2), true);
        });
    });

    describe("contains", () => {
        it("returns true if sequence contains value", async () => {
            let res = AsyncQueryableImpl.from<number>([]);
            assert.deepEqual(await res.contains(3), false);
            assert.deepEqual(await res.contains(3), false);

            res = AsyncQueryableImpl.from<number>([1, 2]);
            assert.deepEqual(await res.contains(3), false);
        });

        it("returns true if sequence contains value", async () => {
            let res = AsyncQueryableImpl.from<number>([3]);
            assert.deepEqual(await res.contains(3), true);
            assert.deepEqual(await res.contains(3), true);

            res = AsyncQueryableImpl.from<number>([2, 3, 4]);
            assert.deepEqual(await res.contains(3), true);
            assert.deepEqual(await res.contains(3), true);
        });
    });
});

describe("IterablePromise aggregate operators", () => {
    describe("count", () => {
        it("returns 0 for empty lists", async () => {
            let res = AsyncQueryableImpl.from<number>([]);
            assert.deepEqual(await res.count(), 0);
            assert.deepEqual(await res.count(), 0);

            res = AsyncQueryableImpl.from<number>(
                from(function*() {
                    for (const x of []) {
                        yield x;
                    }
                }),
            );
            assert.deepEqual(await res.count(), 0);
            assert.deepEqual(await res.count(), 0);
        });

        it("returns > 1 count for non-empty lists", async () => {
            let res = AsyncQueryableImpl.from([1]);
            assert.deepEqual(await res.count(), 1);
            assert.deepEqual(await res.count(), 1);

            res = AsyncQueryableImpl.from([1, 2]);
            assert.deepEqual(await res.count(), 2);
            assert.deepEqual(await res.count(), 2);
        });
    });

    describe("sum", () => {
        it("returns 0 for empty array", async () => {
            const res = AsyncQueryableImpl.from<number>([]);
            assert.deepEqual(await res.sum(), 0);
            assert.deepEqual(await res.sum(), 0);
        });

        it("correctly calculates the sum of array of numbers", async () => {
            const res = AsyncQueryableImpl.from([1, 2, 3, 4, 5]);
            assert.deepEqual(await res.sum(), 15);
            assert.deepEqual(await res.sum(), 15);
        });

        it("throws when summing non-numbers", done => {
            assertRejects(
                done,
                AsyncQueryableImpl.from([{ foo: 1 }, { foo: 2 }, { foo: 3 }]).sum(),
            );
        });

        it("correctly calculates the sum using key func", async () => {
            const res = AsyncQueryableImpl.from([{ foo: 1 }, { foo: 2 }, { foo: 3 }]);
            assert.deepEqual(await res.sum(x => x.foo), 6);
            assert.deepEqual(await res.sum(x => x.foo), 6);
        });
    });

    describe("min", () => {
        it("throws for empty lists", done => {
            assertRejects(done, AsyncQueryableImpl.from<number>([]).min());
        });

        it("correctly finds min for array of numbers", async () => {
            let res = AsyncQueryableImpl.from([1]);
            assert.deepEqual(await res.min(), 1);
            assert.deepEqual(await res.min(), 1);

            res = AsyncQueryableImpl.from([1, -1]);
            assert.deepEqual(await res.min(), -1);
            assert.deepEqual(await res.min(), -1);
        });

        it("throws when finding min of non-numbers", done => {
            assertRejects(
                done,
                AsyncQueryableImpl.from([{ foo: 1 }, { foo: 2 }, { foo: 3 }]).min(),
            );
        });

        it("correctly calculates the min using key func", async () => {
            const res = AsyncQueryableImpl.from([{ foo: 1 }, { foo: 2 }, { foo: 3 }]);
            assert.deepEqual(await res.min(x => x.foo), 1);
            assert.deepEqual(await res.min(x => x.foo), 1);
        });
    });

    describe("max", () => {
        it("throws for empty lists", done => {
            assertRejects(done, AsyncQueryableImpl.from<number>([]).max());
        });

        it("correctly finds max for array of numbers", async () => {
            let res = AsyncQueryableImpl.from([1]);
            assert.deepEqual(await res.max(), 1);
            assert.deepEqual(await res.max(), 1);

            res = AsyncQueryableImpl.from([1, -1]);
            assert.deepEqual(await res.max(), 1);
            assert.deepEqual(await res.max(), 1);
        });

        it("throws when finding max of non-numbers", done => {
            assertRejects(
                done,
                AsyncQueryableImpl.from([{ foo: 1 }, { foo: 2 }, { foo: 3 }]).max(),
            );
        });

        it("correctly calculates the max using key func", async () => {
            const res = AsyncQueryableImpl.from([{ foo: 1 }, { foo: 2 }, { foo: 3 }]);
            assert.deepEqual(await res.max(x => x.foo), 3);
            assert.deepEqual(await res.max(x => x.foo), 3);
        });
    });

    describe("average", () => {
        it("throws for empty lists", done => {
            assertRejects(done, AsyncQueryableImpl.from<number>([]).average());
        });

        it("correctly finds average for array of numbers", async () => {
            let res = AsyncQueryableImpl.from([1]);
            assert.deepEqual(await res.average(), 1);
            assert.deepEqual(await res.average(), 1);

            res = AsyncQueryableImpl.from([1, -1]);
            assert.deepEqual(await res.average(), 0);
            assert.deepEqual(await res.average(), 0);
        });

        it("throws when finding average of non-numbers", done => {
            assertRejects(
                done,
                AsyncQueryableImpl.from([{ foo: 1 }, { foo: 2 }, { foo: 3 }]).average(),
            );
        });

        it("correctly calculates the average using key func", async () => {
            const res = AsyncQueryableImpl.from([{ foo: 1 }, { foo: 2 }, { foo: 3 }]);
            assert.deepEqual(await res.average(x => x.foo), 2);
            assert.deepEqual(await res.average(x => x.foo), 2);
        });
    });

    describe("aggregate", () => {
        it("throws for empty lists", async () => {
            const res = AsyncQueryableImpl.from<number>([]);
            assert.deepEqual(await res.aggregate(0, acc => acc + 13), 0);
            assert.deepEqual(await res.aggregate(0, acc => acc + 13), 0);
        });

        it("aggregates (+) over array of numbers", async () => {
            let res = AsyncQueryableImpl.from<any>([1]);
            assert.deepEqual(await res.aggregate(0, (acc, i) => acc + i), 1);
            assert.deepEqual(await res.aggregate(0, (acc, i) => acc + i), 1);

            res = AsyncQueryableImpl.from([1, -1]);
            assert.deepEqual(await res.aggregate(0, (acc, i) => acc + i), 0);
            assert.deepEqual(await res.aggregate(0, (acc, i) => acc + i), 0);

            res = AsyncQueryableImpl.from([{ foo: 1 }, { foo: 2 }, { foo: 3 }]);
            assert.deepEqual(await res.aggregate(0, (acc, o) => acc + o.foo), 6);
            assert.deepEqual(await res.aggregate(0, (acc, o) => acc + o.foo), 6);
        });
    });
});

describe("IterablePromise eval operators", () => {
    describe("toArray", () => {
        it("returns empty array for empty enumerable", async () => {
            const xs = AsyncQueryableImpl.from([]);
            assert.deepEqual(await xs.toArray(), []);
            assert.deepEqual(await xs.toArray(), []);
        });
    });
});

describe("IterablePromise iterable interop operators", () => {
    describe("pipe", () => {
        it("allows composition of multiple async iterators", async () => {
            const xs = AsyncQueryableImpl.from([1, 2, 3, 4]).pipe(
                async function*(source) {
                    for await (const t of source) {
                        if (t > 2) {
                            yield t;
                        }
                    }
                },
                async function*(source) {
                    for await (const t of source) {
                        yield t + 2;
                    }
                },
            );
            assert.deepEqual(await xs.toArray(), [5, 6]);
            assert.deepEqual(await xs.toArray(), [5, 6]);
        });
    });
});

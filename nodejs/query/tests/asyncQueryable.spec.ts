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

import { range } from "..";
import { AsyncQueryableImpl } from "../asyncQueryable";

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
    describe("range", () => {
        it("produces an empty array for overlapping ranges", async () => {
            let xs = await range(0, 0).toArray();
            assert.deepEqual(xs, []);

            xs = await range(0, -1).toArray();
            assert.deepEqual(xs, []);
        });

        it("produces an array of one for boundary case", async () => {
            const xs = await range(0, 1).toArray();
            assert.deepEqual(xs, [0]);
        });

        it("can produce a range including negative numbers", async () => {
            const xs = await range(-3, 2).toArray();
            assert.deepEqual(xs, [-3, -2, -1, 0, 1]);
        });

        it("is lazily evaluated by take when range is infinite", async () => {
            const xs = await range(0)
                .take(5)
                .toArray();
            assert.deepEqual(xs, [0, 1, 2, 3, 4]);
        });

        it("is lazily transformed and filtered when range is infinite", async () => {
            const xs = await range(0)
                .map(x => x + 2)
                // If filter is bigger than the take window, we enumerate all numbers and hang
                // forever.
                .filter(x => x <= 10)
                .take(7)
                .map(x => x - 2)
                .filter(x => x > 3)
                .toArray();
            assert.deepEqual(xs, [4, 5, 6]);
        });

        it("is lazily flatMap'd when range is infinite", async () => {
            const xs = await range(0)
                // If filter is bigger than the take window, we enumerate all numbers and hang
                // forever.
                .flatMap(x => (x <= 10 ? [x, x] : []))
                .take(5)
                .toArray();
            assert.deepEqual(xs, [0, 0, 1, 1, 2]);
        });
    });
});

describe("IterablePromise restriction operators", () => {
    describe("filter", () => {
        it("produces [] when all elements are filtered out", async () => {
            const xs = await AsyncQueryableImpl.from([1, 2, 3, 4])
                .filter(x => x < 0)
                .toArray();
            assert.deepEqual(xs, []);
        });

        it("produces an non-empty array when some elements are filtered out", async () => {
            const xs = await AsyncQueryableImpl.from([1, 2, 3, 4])
                .filter(x => x >= 3)
                .toArray();
            assert.deepEqual(xs, [3, 4]);
        });
    });
});

describe("IterablePromise projection operators", () => {
    describe("map", () => {
        it("x => x does identity transformation", async () => {
            const xs = await AsyncQueryableImpl.from([1, 2, 3, 4])
                .map(x => x)
                .toArray();
            assert.deepEqual(xs, [1, 2, 3, 4]);
        });

        it("x => x+1 adds one to every element", async () => {
            const xs = await AsyncQueryableImpl.from([1, 2, 3, 4])
                .map(x => x + 1)
                .toArray();
            assert.deepEqual(xs, [2, 3, 4, 5]);
        });
    });

    describe("flatMap", () => {
        it("produces [] when all elements are filtered out", async () => {
            const xs = await AsyncQueryableImpl.from([1, 2, 3, 4])
                .flatMap(x => [])
                .toArray();
            assert.deepEqual(xs, []);
        });

        it("can add elements to an enumerable", async () => {
            const xs = await AsyncQueryableImpl.from([1, 2, 3, 4])
                .flatMap(x => [x, x])
                .toArray();
            assert.deepEqual(xs, [1, 1, 2, 2, 3, 3, 4, 4]);
        });
    });
});

describe("IterablePromise partitioning operators", () => {
    describe("skip", () => {
        it("produces [] when all elements are skipped", async () => {
            let xs = await AsyncQueryableImpl.from([1, 2, 3, 4])
                .skip(4)
                .toArray();
            assert.deepEqual(xs, []);

            xs = await AsyncQueryableImpl.from([])
                .skip(4)
                .toArray();
            assert.deepEqual(xs, []);

            xs = await AsyncQueryableImpl.from(
                (function*() {
                    for (const x of []) {
                        yield x;
                    }
                })(),
            )
                .skip(4)
                .toArray();
            assert.deepEqual(xs, []);

            xs = await AsyncQueryableImpl.from([])
                .skip(0)
                .toArray();
            assert.deepEqual(xs, []);

            xs = await AsyncQueryableImpl.from(
                (function*() {
                    for (const x of []) {
                        yield x;
                    }
                })(),
            )
                .skip(0)
                .toArray();
            assert.deepEqual(xs, []);
        });

        it("produces non-empty array when not all elements are skipped", async () => {
            let xs = await AsyncQueryableImpl.from([1, 2, 3, 4, 5])
                .skip(4)
                .toArray();
            assert.deepEqual(xs, [5]);

            xs = await AsyncQueryableImpl.from([1, 2, 3, 4, 5])
                .skip(0)
                .toArray();
            assert.deepEqual(xs, [1, 2, 3, 4, 5]);
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
            let xs = await AsyncQueryableImpl.from([1, 2, 3, 4])
                .skipWhile(x => true)
                .toArray();
            assert.deepEqual(xs, []);

            xs = await AsyncQueryableImpl.from([])
                .skipWhile(x => false)
                .toArray();
            assert.deepEqual(xs, []);

            xs = await AsyncQueryableImpl.from([])
                .skipWhile(x => true)
                .toArray();
            assert.deepEqual(xs, []);
        });

        it("produces non-empty array when not all elements are skipped", async () => {
            let xs = await AsyncQueryableImpl.from([1, 2, 3, 4])
                .skipWhile(x => x < 2)
                .toArray();
            assert.deepEqual(xs, [2, 3, 4]);

            xs = await AsyncQueryableImpl.from([1, 2, 3, 4])
                .skipWhile((x, i) => i < 1)
                .toArray();
            assert.deepEqual(xs, [2, 3, 4]);
        });

        it("does not invoke the predicate again after it returns false one time", async () => {
            const xs = await AsyncQueryableImpl.from([1, 2, 3, 4, 5])
                .skipWhile(x => x < 2 || x > 3)
                .toArray();
            assert.deepEqual(xs, [2, 3, 4, 5]);
        });
    });

    describe("take", () => {
        it("produces [] when no elements are taken", async () => {
            let xs = await AsyncQueryableImpl.from([1, 2, 3, 4])
                .take(0)
                .toArray();
            assert.deepEqual(xs, []);

            xs = await AsyncQueryableImpl.from([])
                .take(4)
                .toArray();
            assert.deepEqual(xs, []);

            xs = await AsyncQueryableImpl.from([])
                .take(0)
                .toArray();
            assert.deepEqual(xs, []);
        });

        it("produces non-empty array when some elements are taken", async () => {
            let xs = await AsyncQueryableImpl.from([1, 2, 3, 4, 5])
                .take(4)
                .toArray();
            assert.deepEqual(xs, [1, 2, 3, 4]);

            xs = await AsyncQueryableImpl.from([1, 2, 3, 4, 5])
                .take(8)
                .toArray();
            assert.deepEqual(xs, [1, 2, 3, 4, 5]);

            xs = await AsyncQueryableImpl.from([1, 2, 3, 4, 5])
                .take(5)
                .toArray();
            assert.deepEqual(xs, [1, 2, 3, 4, 5]);
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
            let xs = await AsyncQueryableImpl.from([1, 2, 3, 4])
                .takeWhile(x => false)
                .toArray();
            assert.deepEqual(xs, []);

            xs = await AsyncQueryableImpl.from([])
                .takeWhile(x => true)
                .toArray();
            assert.deepEqual(xs, []);

            xs = await AsyncQueryableImpl.from([])
                .takeWhile(x => false)
                .toArray();
            assert.deepEqual(xs, []);
        });

        it("produces non-empty array when some elements are taken", async () => {
            let xs = await AsyncQueryableImpl.from([1, 2, 3, 4])
                .takeWhile(x => x <= 2)
                .toArray();
            assert.deepEqual(xs, [1, 2]);

            xs = await AsyncQueryableImpl.from([1, 2, 3, 4])
                .takeWhile((x, i) => i <= 1)
                .toArray();
            assert.deepEqual(xs, [1, 2]);
        });

        it("does not invoke the predicate again after it returns false one time", async () => {
            const xs = await AsyncQueryableImpl.from([1, 2, 3, 4, 5])
                .takeWhile(x => x <= 2 || x > 4)
                .toArray();
            assert.deepEqual(xs, [1, 2]);
        });
    });
});

describe("IterablePromise join operators", () => {
    describe("join", () => {
        it("produces [] when no elements are taken", async () => {
            let xs = await AsyncQueryableImpl.from([])
                .join([1, 2, 3], x => x, x => x, (x, y) => [x, y])
                .toArray();
            assert.deepEqual(xs, []);

            xs = await AsyncQueryableImpl.from([1, 2, 3])
                .join([], x => x, x => x, (x, y) => [x, y])
                .toArray();
            assert.deepEqual(xs, []);
        });

        it("joins non-empty sets", async () => {
            const xs = await AsyncQueryableImpl.from([1, 2, 3, 4, 5])
                .join([1, 2, 3], x => x, x => x, (x, y) => [x, y])
                .toArray();
            assert.deepEqual(xs, [[1, 1], [2, 2], [3, 3]]);
        });

        it("ignores joins when key selector produces undefined", async () => {
            let xs = await AsyncQueryableImpl.from([1, 2, 3, 4, 5])
                .join([1, 2, 3], x => (x === 2 ? undefined : x), x => x, (x, y) => [x, y])
                .toArray();
            assert.deepEqual(xs, [[1, 1], [3, 3]]);

            xs = await AsyncQueryableImpl.from([1, 2, 3, 4, 5])
                .join([1, 2, 3], x => x, x => (x === 2 ? undefined : x), (x, y) => [x, y])
                .toArray();
            assert.deepEqual(xs, [[1, 1], [3, 3]]);

            xs = await AsyncQueryableImpl.from([1, 2, 3, 4, 5])
                .join([1, 2, 3], x => (x === 2 ? null : x), x => x, (x, y) => [x, y])
                .toArray();
            assert.deepEqual(xs, [[1, 1], [3, 3]]);

            xs = await AsyncQueryableImpl.from([1, 2, 3, 4, 5])
                .join([1, 2, 3], x => x, x => (x === 2 ? null : x), (x, y) => [x, y])
                .toArray();
            assert.deepEqual(xs, [[1, 1], [3, 3]]);
        });

        it("joins multiple inner records to one outer record", async () => {
            let xs = await AsyncQueryableImpl.from([1, 2, 2, 3, 4, 5])
                .join([1, 2], x => x, x => x, (x, y) => [x, y])
                .toArray();
            assert.deepEqual(xs, [[1, 1], [2, 2], [2, 2]]);

            xs = await AsyncQueryableImpl.from([1, 2])
                .join([1, 2, 2, 3, 4, 5], x => x, x => x, (x, y) => [x, y])
                .toArray();
            assert.deepEqual(xs, [[1, 1], [2, 2], [2, 2]]);

            xs = await AsyncQueryableImpl.from([1, 2, 2])
                .join([1, 2, 2, 3, 4, 5], x => x, x => x, (x, y) => [x, y])
                .toArray();
            assert.deepEqual(xs, [[1, 1], [2, 2], [2, 2], [2, 2], [2, 2]]);
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
            let xs = await AsyncQueryableImpl.from([1, 2])
                .concat([3, 4])
                .toArray();
            assert.deepEqual(xs, [1, 2, 3, 4]);

            xs = await AsyncQueryableImpl.from<number>([])
                .concat([3, 4])
                .toArray();
            assert.deepEqual(xs, [3, 4]);

            xs = await AsyncQueryableImpl.from([1, 2])
                .concat([])
                .toArray();
            assert.deepEqual(xs, [1, 2]);
        });

        it("concats Promise<T[]>", async () => {
            let xs = await AsyncQueryableImpl.from(Promise.resolve([1, 2]))
                .concat([3, 4])
                .toArray();
            assert.deepEqual(xs, [1, 2, 3, 4]);

            xs = await AsyncQueryableImpl.from([1, 2])
                .concat(Promise.resolve([3, 4]))
                .toArray();
            assert.deepEqual(xs, [1, 2, 3, 4]);

            xs = await AsyncQueryableImpl.from<number>(Promise.resolve([]))
                .concat([3, 4])
                .toArray();
            assert.deepEqual(xs, [3, 4]);

            xs = await AsyncQueryableImpl.from<number>([])
                .concat(Promise.resolve([3, 4]))
                .toArray();
            assert.deepEqual(xs, [3, 4]);

            xs = await AsyncQueryableImpl.from(Promise.resolve([1, 2]))
                .concat([])
                .toArray();
            assert.deepEqual(xs, [1, 2]);

            xs = await AsyncQueryableImpl.from([1, 2])
                .concat(Promise.resolve([]))
                .toArray();
            assert.deepEqual(xs, [1, 2]);
        });

        it("concats iterators", async () => {
            let xs = await AsyncQueryableImpl.from(
                (function*() {
                    for (const x of [1, 2]) {
                        yield x;
                    }
                })(),
            )
                .concat([3, 4])
                .toArray();
            assert.deepEqual(xs, [1, 2, 3, 4]);

            xs = await AsyncQueryableImpl.from([1, 2])
                .concat(
                    (function*() {
                        for (const x of [3, 4]) {
                            yield x;
                        }
                    })(),
                )
                .toArray();
            assert.deepEqual(xs, [1, 2, 3, 4]);

            xs = await AsyncQueryableImpl.from<number>(
                (function*() {
                    for (const x of []) {
                        yield x;
                    }
                })(),
            )
                .concat([3, 4])
                .toArray();
            assert.deepEqual(xs, [3, 4]);

            xs = await AsyncQueryableImpl.from<number>([])
                .concat(
                    (function*() {
                        for (const x of [3, 4]) {
                            yield x;
                        }
                    })(),
                )
                .toArray();
            assert.deepEqual(xs, [3, 4]);

            xs = await AsyncQueryableImpl.from(
                (function*() {
                    for (const x of [1, 2]) {
                        yield x;
                    }
                })(),
            )
                .concat([])
                .toArray();
            assert.deepEqual(xs, [1, 2]);

            xs = await AsyncQueryableImpl.from([1, 2])
                .concat(
                    (function*() {
                        for (const x of []) {
                            yield x;
                        }
                    })(),
                )
                .toArray();
            assert.deepEqual(xs, [1, 2]);
        });
    });
});

describe("IterablePromise ordering operators", () => {
    describe("reverse", () => {
        it("produces [] for empty array", async () => {
            let xs = await AsyncQueryableImpl.from([])
                .reverse()
                .toArray();
            assert.deepEqual(xs, []);

            xs = await AsyncQueryableImpl.from(
                (function*() {
                    for (const x of []) {
                        yield x;
                    }
                })(),
            )
                .reverse()
                .toArray();
            assert.deepEqual(xs, []);
        });
    });

    describe("orderBy", () => {
        it("correctly sorts number keys", async () => {
            let xs = await AsyncQueryableImpl.from<number>([])
                .orderBy(x => x)
                .toArray();
            assert.deepEqual(xs, []);

            xs = await AsyncQueryableImpl.from([2, 3, 1, 14])
                .orderBy(x => x)
                .toArray();
            assert.deepEqual(xs, [1, 2, 3, 14]);
        });

        it("lexically sorts string keys", async () => {
            const xs = await AsyncQueryableImpl.from([2, 3, 1, 14])
                .orderBy(x => x.toString())
                .toArray();
            assert.deepEqual(xs, [1, 14, 2, 3]);
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
            let xs = await AsyncQueryableImpl.from([])
                .groupBy(x => x)
                .toArray();
            assert.deepEqual(xs, []);

            xs = await AsyncQueryableImpl.from(
                (function*() {
                    for (const x of []) {
                        yield x;
                    }
                })(),
            )
                .groupBy(x => x)
                .toArray();
            assert.deepEqual(xs, []);
        });

        it("produces non-empty groups when array is not empty", async () => {
            let xs = await AsyncQueryableImpl.from([1])
                .groupBy(x => x)
                .map(g => g.toArray())
                .toArray();
            assert.deepEqual(xs, [[1]]);

            xs = await AsyncQueryableImpl.from(
                (function*() {
                    for (const x of [1]) {
                        yield x;
                    }
                })(),
            )
                .groupBy(x => x)
                .map(g => g.toArray())
                .toArray();
            assert.deepEqual(xs, [[1]]);

            xs = await AsyncQueryableImpl.from([1, 2])
                .groupBy(x => x)
                .map(g => g.toArray())
                .toArray();
            assert.deepEqual(xs, [[1], [2]]);

            xs = await AsyncQueryableImpl.from(
                (function*() {
                    for (const x of [1, 2]) {
                        yield x;
                    }
                })(),
            )
                .groupBy(x => x)
                .map(g => g.toArray())
                .toArray();
            assert.deepEqual(xs, [[1], [2]]);

            xs = await AsyncQueryableImpl.from([1, 2, 1])
                .groupBy(x => x)
                .map(g => g.toArray())
                .toArray();
            assert.deepEqual(xs, [[1, 1], [2]]);

            xs = await AsyncQueryableImpl.from(
                (function*() {
                    for (const x of [1, 2, 1]) {
                        yield x;
                    }
                })(),
            )
                .groupBy(x => x)
                .map(g => g.toArray())
                .toArray();
            assert.deepEqual(xs, [[1, 1], [2]]);

            const ys = await AsyncQueryableImpl.from([
                { foo: "bar", bar: 1 },
                { foo: "baz" },
                { foo: undefined },
                { foo: "bar", bar: 2 },
            ])
                .groupBy(x => x.foo)
                .map(g => g.toArray())
                .toArray();
            assert.deepEqual(ys, [
                [{ foo: "bar", bar: 1 }, { foo: "bar", bar: 2 }],
                [{ foo: "baz" }],
                [{ foo: undefined }],
            ]);
        });

        it("produces projected elements when result selector is used", async () => {
            const ys = await AsyncQueryableImpl.from([
                { foo: "bar", bar: 1 },
                { foo: "baz" },
                { foo: undefined },
                { foo: "bar", bar: 2 },
            ])
                .groupBy(x => x.foo, x => x.foo)
                .map(g => g.toArray())
                .toArray();
            assert.deepEqual(ys, [["bar", "bar"], ["baz"], [undefined]]);
        });
    });
});

describe("IterablePromise set operators", () => {
    describe("distinct", () => {
        it("produces [] for empty array", async () => {
            const xs = await AsyncQueryableImpl.from([])
                .distinct()
                .toArray();
            assert.deepEqual(xs, []);
        });

        it("produces non-empty set when array is not empty", async () => {
            let xs = await AsyncQueryableImpl.from([1, 2, 3])
                .distinct()
                .toArray();
            assert.deepEqual(xs, [1, 2, 3]);

            xs = await AsyncQueryableImpl.from([1, 1, 1, 2, 3, 1, 1])
                .distinct()
                .toArray();
            assert.deepEqual(xs, [1, 2, 3]);
        });
    });

    describe("union", () => {
        it("produces [] for empty array", async () => {
            const xs = await AsyncQueryableImpl.from([])
                .union([])
                .toArray();
            assert.deepEqual(xs, []);
        });

        it("produces non-empty set when array is not empty", async () => {
            let xs = await AsyncQueryableImpl.from([1, 2, 3])
                .union([])
                .toArray();
            assert.deepEqual(xs, [1, 2, 3]);

            xs = await AsyncQueryableImpl.from<number>([])
                .union([1, 1, 1, 2, 3, 1, 1])
                .toArray();
            assert.deepEqual(xs, [1, 2, 3]);

            xs = await AsyncQueryableImpl.from([1, 2, 3])
                .union([1, 1, 1, 2, 3, 1, 1])
                .toArray();
            assert.deepEqual(xs, [1, 2, 3]);

            xs = await AsyncQueryableImpl.from([1, 1, 1, 2, 3, 1, 1])
                .union([1, 2, 3])
                .toArray();
            assert.deepEqual(xs, [1, 2, 3]);

            xs = await AsyncQueryableImpl.from([1, 1, 1, 2, 3, 1, 1, 4, 4, 5, 4])
                .union([1, 2, 3])
                .toArray();
            assert.deepEqual(xs, [1, 2, 3, 4, 5]);
        });
    });

    describe("intersect", () => {
        it("produces [] when there is no set intersection", async () => {
            let xs = await AsyncQueryableImpl.from<number>([])
                .intersect([])
                .toArray();
            assert.deepEqual(xs, []);

            xs = await AsyncQueryableImpl.from([1, 2, 3])
                .intersect([])
                .toArray();
            assert.deepEqual(xs, []);

            xs = await AsyncQueryableImpl.from<number>([])
                .intersect([1, 2, 3])
                .toArray();
            assert.deepEqual(xs, []);

            xs = await AsyncQueryableImpl.from<number>([1, 2, 3])
                .intersect([4, 5, 6])
                .toArray();
            assert.deepEqual(xs, []);
        });

        it("produces non-empty set when intersection is not empty", async () => {
            let xs = await AsyncQueryableImpl.from([1, 2, 3])
                .intersect([1])
                .toArray();
            assert.deepEqual(xs, [1]);

            xs = await AsyncQueryableImpl.from<number>([1, 2])
                .intersect([1, 1, 1, 2, 3, 1, 1])
                .toArray();
            assert.deepEqual(xs, [1, 2]);

            xs = await AsyncQueryableImpl.from<number>([1, 1, 1, 2, 3, 1, 1])
                .intersect([1, 2])
                .toArray();
            assert.deepEqual(xs, [1, 2]);

            xs = await AsyncQueryableImpl.from([1, 1, 1, 2, 3, 1, 1])
                .intersect([1, 2, 3])
                .toArray();
            assert.deepEqual(xs, [1, 2, 3]);
        });
    });

    describe("except", () => {
        it("produces [] when there is no set difference", async () => {
            let xs = await AsyncQueryableImpl.from<number>([])
                .except([])
                .toArray();
            assert.deepEqual(xs, []);

            xs = await AsyncQueryableImpl.from([1, 2, 3])
                .except([1, 2, 3])
                .toArray();
            assert.deepEqual(xs, []);

            xs = await AsyncQueryableImpl.from([1, 2, 3])
                .except([1, 1, 1, 2, 3, 1, 1])
                .toArray();
            assert.deepEqual(xs, []);

            xs = await AsyncQueryableImpl.from([1, 1, 1, 2, 3, 1, 1])
                .except([1, 2, 3])
                .toArray();
            assert.deepEqual(xs, []);
        });

        it("produces non-empty set when set difference is not empty", async () => {
            let xs = await AsyncQueryableImpl.from([1, 2, 3])
                .except([1])
                .toArray();
            assert.deepEqual(xs, [2, 3]);

            xs = await AsyncQueryableImpl.from<number>([1, 2])
                .except([1, 1, 1, 2, 3, 1, 1])
                .toArray();
            assert.deepEqual(xs, [3]);

            xs = await AsyncQueryableImpl.from<number>([1, 1, 1, 2, 3, 1, 1])
                .except([1, 2])
                .toArray();
            assert.deepEqual(xs, [3]);
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
            let xs = await AsyncQueryableImpl.from([1, 2, 3]).first();
            assert.deepEqual(xs, 1);

            xs = await AsyncQueryableImpl.from(
                (function*() {
                    for (const x of [1, 2, 3]) {
                        yield x;
                    }
                })(),
            ).first();
            assert.deepEqual(xs, 1);
        });
    });

    describe("firstOrDefault", () => {
        it("default value populated if enumerable is empty", async () => {
            let xs = await AsyncQueryableImpl.from<number>([]).firstOrDefault(99);
            assert.deepEqual(xs, 99);

            xs = await AsyncQueryableImpl.from<number>(
                (function*() {
                    for (const x of []) {
                        yield x;
                    }
                })(),
            ).firstOrDefault(99);
            assert.deepEqual(xs, 99);
        });

        it("default value if predicate specifies non-existent element", async () => {
            let xs = await AsyncQueryableImpl.from([1, 2, 3]).firstOrDefault(99, x => x === 4);
            assert.deepEqual(xs, 99);

            xs = await AsyncQueryableImpl.from(
                (function*() {
                    for (const x of [1, 2, 3]) {
                        yield x;
                    }
                })(),
            ).firstOrDefault(99, x => x === 4);
            assert.deepEqual(xs, 99);
        });

        it("finds first element of sequence", async () => {
            let xs = await AsyncQueryableImpl.from([1, 2, 3]).firstOrDefault(99);
            assert.deepEqual(xs, 1);

            xs = await AsyncQueryableImpl.from(
                (function*() {
                    for (const x of [1, 2, 3]) {
                        yield x;
                    }
                })(),
            ).firstOrDefault(99);
            assert.deepEqual(xs, 1);
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
            let xs = await AsyncQueryableImpl.from([1, 2, 3]).last();
            assert.deepEqual(xs, 3);

            xs = await AsyncQueryableImpl.from(
                (function*() {
                    for (const x of [1, 2, 3]) {
                        yield x;
                    }
                })(),
            ).last();
            assert.deepEqual(xs, 3);
        });
    });

    describe("lastOrDefault", () => {
        it("default value populated if enumerable is empty", async () => {
            let xs = await AsyncQueryableImpl.from<number>([]).lastOrDefault(99);
            assert.deepEqual(xs, 99);

            xs = await AsyncQueryableImpl.from<number>(
                (function*() {
                    for (const x of []) {
                        yield x;
                    }
                })(),
            ).lastOrDefault(99);
            assert.deepEqual(xs, 99);
        });

        it("default value if predicate specifies non-existent element", async () => {
            let xs = await AsyncQueryableImpl.from([1, 2, 3]).firstOrDefault(99, x => x === 4);
            assert.deepEqual(xs, 99);

            xs = await AsyncQueryableImpl.from(
                (function*() {
                    for (const x of [1, 2, 3]) {
                        yield x;
                    }
                })(),
            ).firstOrDefault(99, x => x === 4);
            assert.deepEqual(xs, 99);
        });

        it("finds first element of sequence", async () => {
            let xs = await AsyncQueryableImpl.from([1, 2, 3]).lastOrDefault(99);
            assert.deepEqual(xs, 3);

            xs = await AsyncQueryableImpl.from(
                (function*() {
                    for (const x of [1, 2, 3]) {
                        yield x;
                    }
                })(),
            ).lastOrDefault(99);
            assert.deepEqual(xs, 3);
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
            let xs = await AsyncQueryableImpl.from([1, 2, 3]).single(x => x === 2);
            assert.deepEqual(xs, 2);

            xs = await AsyncQueryableImpl.from(
                (function*() {
                    for (const x of [1, 2, 3]) {
                        yield x;
                    }
                })(),
            ).single(x => x === 2);
            assert.deepEqual(xs, 2);

            xs = await AsyncQueryableImpl.from([1]).single();
            assert.deepEqual(xs, 1);

            xs = await AsyncQueryableImpl.from(
                (function*() {
                    for (const x of [1]) {
                        yield x;
                    }
                })(),
            ).single();
            assert.deepEqual(xs, 1);
        });
    });

    describe("singleOrDefault", () => {
        it("default value if enumerable is empty", async () => {
            let xs = await AsyncQueryableImpl.from<number>([]).singleOrDefault(99);
            assert.deepEqual(xs, 99);

            xs = await AsyncQueryableImpl.from(
                (function*() {
                    for (const x of [99]) {
                        yield x;
                    }
                })(),
            ).singleOrDefault(99);
            assert.deepEqual(xs, 99);
        });

        it("throw error if enumerable has more than 1 element and default predicate", done => {
            assertRejects(done, AsyncQueryableImpl.from([1, 2]).singleOrDefault(99));
        });

        it("default value if predicate specifies non-existent element", async () => {
            let xs = await AsyncQueryableImpl.from([1, 2, 3]).singleOrDefault(99, x => x === 4);
            assert.deepEqual(xs, 99);

            xs = await AsyncQueryableImpl.from(
                (function*() {
                    for (const x of [1, 2, 3]) {
                        yield x;
                    }
                })(),
            ).singleOrDefault(99, x => x === 4);
            assert.deepEqual(xs, 99);
        });

        it("throws error if predicate specifies multiple elements", done => {
            assertRejects(
                done,
                AsyncQueryableImpl.from([1, 2, 2, 3]).singleOrDefault(99, x => x === 2),
            );
        });

        it("finds single element of sequence", async () => {
            let xs = await AsyncQueryableImpl.from([1, 2, 3]).singleOrDefault(99, x => x === 2);
            assert.deepEqual(xs, 2);

            xs = await AsyncQueryableImpl.from(
                (function*() {
                    for (const x of [1, 2, 3]) {
                        yield x;
                    }
                })(),
            ).singleOrDefault(99, x => x === 2);
            assert.deepEqual(xs, 2);

            xs = await AsyncQueryableImpl.from([1]).singleOrDefault(99);
            assert.deepEqual(xs, 1);

            xs = await AsyncQueryableImpl.from(
                (function*() {
                    for (const x of [1]) {
                        yield x;
                    }
                })(),
            ).singleOrDefault(99);
            assert.deepEqual(xs, 1);
        });
    });

    describe("elementAt", () => {
        it("finds element at in-range index", async () => {
            const xs = await AsyncQueryableImpl.from([1, 2, 3]).elementAt(1);
            assert.deepEqual(xs, 2);
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
            const xs = await AsyncQueryableImpl.from([1, 2, 3]).elementAtOrDefault(99, 1);
            assert.deepEqual(xs, 2);
        });

        it("default value if index is out-of-range", async () => {
            let xs = await AsyncQueryableImpl.from([1, 2, 3]).elementAtOrDefault(99, 3);
            assert.deepEqual(xs, 99);

            xs = await AsyncQueryableImpl.from<number>([]).elementAtOrDefault(99, 0);
            assert.deepEqual(xs, 99);

            xs = await AsyncQueryableImpl.from<number>([]).elementAtOrDefault(99, -1);
            assert.deepEqual(xs, 99);
        });
    });

    describe("defaultIfEmpty", () => {
        it("default value if empty", async () => {
            const xs = await AsyncQueryableImpl.from<number>([])
                .defaultIfEmpty(99)
                .toArray();
            assert.deepEqual(xs, [99]);
        });

        it("identity if not empty", async () => {
            const xs = await AsyncQueryableImpl.from([1, 2, 3])
                .defaultIfEmpty(99)
                .toArray();
            assert.deepEqual(xs, [1, 2, 3]);
        });
    });
});

describe("IterablePromise quantifier operators", () => {
    describe("any", () => {
        it("false if nothing satisfies predicate", async () => {
            let res = await AsyncQueryableImpl.from<number>([]).any(x => x > 3);
            assert.deepEqual(res, false);

            res = await AsyncQueryableImpl.from([1]).any(x => x > 3);
            assert.deepEqual(res, false);
        });

        it("true if >= 1 thing satisfies predicate", async () => {
            let res = await AsyncQueryableImpl.from([4]).any(x => x > 3);
            assert.deepEqual(res, true);

            res = await AsyncQueryableImpl.from([4, 5]).any(x => x > 3);
            assert.deepEqual(res, true);

            res = await AsyncQueryableImpl.from([3, 4, 5]).any(x => x > 3);
            assert.deepEqual(res, true);
        });
    });

    describe("all", () => {
        it("empty sequence satisfies predicate", async () => {
            let res = await AsyncQueryableImpl.from<number>([]).all(x => x > 3);
            assert.deepEqual(res, true);

            res = await AsyncQueryableImpl.from(
                (function*() {
                    for (const x of []) {
                        yield x;
                    }
                })(),
            ).all(x => x > 3);
            assert.deepEqual(res, true);
        });

        it("returns false when not everything satisfies predicate", async () => {
            let res = await AsyncQueryableImpl.from([1, 2, 3]).all(x => x > 2);
            assert.deepEqual(res, false);

            res = await AsyncQueryableImpl.from(
                (function*() {
                    for (const x of [1, 2, 3]) {
                        yield x;
                    }
                })(),
            ).all(x => x > 2);
            assert.deepEqual(res, false);
        });

        it("returns false when not everything satisfies predicate", async () => {
            let res = await AsyncQueryableImpl.from([2, 3]).all(x => x >= 2);
            assert.deepEqual(res, true);

            res = await AsyncQueryableImpl.from(
                (function*() {
                    for (const x of [2, 3]) {
                        yield x;
                    }
                })(),
            ).all(x => x >= 2);
            assert.deepEqual(res, true);
        });
    });

    describe("contains", () => {
        it("returns true if sequence contains value", async () => {
            let res = await AsyncQueryableImpl.from<number>([]).contains(3);
            assert.deepEqual(res, false);

            res = await AsyncQueryableImpl.from<number>([1, 2]).contains(3);
            assert.deepEqual(res, false);
        });

        it("returns true if sequence contains value", async () => {
            let res = await AsyncQueryableImpl.from<number>([3]).contains(3);
            assert.deepEqual(res, true);

            res = await AsyncQueryableImpl.from<number>([2, 3, 4]).contains(3);
            assert.deepEqual(res, true);
        });
    });
});

describe("IterablePromise aggregate operators", () => {
    describe("count", () => {
        it("returns 0 for empty lists", async () => {
            let res = await AsyncQueryableImpl.from<number>([]).count();
            assert.deepEqual(res, 0);

            res = await AsyncQueryableImpl.from<number>(
                (function*() {
                    for (const x of []) {
                        yield x;
                    }
                })(),
            ).count();
            assert.deepEqual(res, 0);
        });

        it("returns > 1 count for non-empty lists", async () => {
            let res = await AsyncQueryableImpl.from([1]).count();
            assert.deepEqual(res, 1);

            res = await AsyncQueryableImpl.from([1, 2]).count();
            assert.deepEqual(res, 2);
        });
    });

    describe("sum", () => {
        it("returns 0 for empty array", async () => {
            const res = await AsyncQueryableImpl.from<number>([]).sum();
            assert.deepEqual(res, 0);
        });

        it("correctly calculates the sum of array of numbers", async () => {
            const res = await AsyncQueryableImpl.from([1, 2, 3, 4, 5]).sum();
            assert.deepEqual(res, 15);
        });

        it("throws when summing non-numbers", done => {
            assertRejects(
                done,
                AsyncQueryableImpl.from([{ foo: 1 }, { foo: 2 }, { foo: 3 }]).sum(),
            );
        });

        it("correctly calculates the sum using key func", async () => {
            const res = await AsyncQueryableImpl.from([{ foo: 1 }, { foo: 2 }, { foo: 3 }]).sum(
                x => x.foo,
            );
            assert.deepEqual(res, 6);
        });
    });

    describe("min", () => {
        it("throws for empty lists", done => {
            assertRejects(done, AsyncQueryableImpl.from<number>([]).min());
        });

        it("correctly finds min for array of numbers", async () => {
            let res = await AsyncQueryableImpl.from([1]).min();
            assert.deepEqual(res, 1);

            res = await AsyncQueryableImpl.from([1, -1]).min();
            assert.deepEqual(res, -1);
        });

        it("throws when finding min of non-numbers", done => {
            assertRejects(
                done,
                AsyncQueryableImpl.from([{ foo: 1 }, { foo: 2 }, { foo: 3 }]).min(),
            );
        });

        it("correctly calculates the min using key func", async () => {
            const res = await AsyncQueryableImpl.from([{ foo: 1 }, { foo: 2 }, { foo: 3 }]).min(
                x => x.foo,
            );
            assert.deepEqual(res, 1);
        });
    });

    describe("max", () => {
        it("throws for empty lists", done => {
            assertRejects(done, AsyncQueryableImpl.from<number>([]).max());
        });

        it("correctly finds max for array of numbers", async () => {
            let res = await AsyncQueryableImpl.from([1]).max();
            assert.deepEqual(res, 1);

            res = await AsyncQueryableImpl.from([1, -1]).max();
            assert.deepEqual(res, 1);
        });

        it("throws when finding max of non-numbers", done => {
            assertRejects(
                done,
                AsyncQueryableImpl.from([{ foo: 1 }, { foo: 2 }, { foo: 3 }]).max(),
            );
        });

        it("correctly calculates the max using key func", async () => {
            const res = await AsyncQueryableImpl.from([{ foo: 1 }, { foo: 2 }, { foo: 3 }]).max(
                x => x.foo,
            );
            assert.deepEqual(res, 3);
        });
    });

    describe("average", () => {
        it("throws for empty lists", done => {
            assertRejects(done, AsyncQueryableImpl.from<number>([]).average());
        });

        it("correctly finds average for array of numbers", async () => {
            let res = await AsyncQueryableImpl.from([1]).average();
            assert.deepEqual(res, 1);

            res = await AsyncQueryableImpl.from([1, -1]).average();
            assert.deepEqual(res, 0);
        });

        it("throws when finding average of non-numbers", done => {
            assertRejects(
                done,
                AsyncQueryableImpl.from([{ foo: 1 }, { foo: 2 }, { foo: 3 }]).average(),
            );
        });

        it("correctly calculates the average using key func", async () => {
            const res = await AsyncQueryableImpl.from([{ foo: 1 }, { foo: 2 }, { foo: 3 }]).average(
                x => x.foo,
            );
            assert.deepEqual(res, 2);
        });
    });

    describe("aggregate", () => {
        it("throws for empty lists", async () => {
            const res = await AsyncQueryableImpl.from<number>([]).aggregate(0, acc => acc + 13);
            assert.deepEqual(res, 0);
        });

        it("aggregates (+) over array of numbers", async () => {
            let res = await AsyncQueryableImpl.from([1]).aggregate(0, (acc, i) => acc + i);
            assert.deepEqual(res, 1);

            res = await AsyncQueryableImpl.from([1, -1]).aggregate(0, (acc, i) => acc + i);
            assert.deepEqual(res, 0);

            res = await AsyncQueryableImpl.from([{ foo: 1 }, { foo: 2 }, { foo: 3 }]).aggregate(
                0,
                (acc, o) => acc + o.foo,
            );
            assert.deepEqual(res, 6);
        });
    });
});

describe("IterablePromise eval operators", () => {
    describe("toArray", () => {
        it("returns empty array for empty enumerable", async () => {
            const xs = await AsyncQueryableImpl.from([]).toArray();
            assert.deepEqual(xs, []);
        });
    });
});

describe("IterablePromise iterable interop operators", () => {
    describe("pipe", () => {
        it("allows composition of multiple async iterators", async () => {
            const xs = await AsyncQueryableImpl.from([1, 2, 3, 4])
                .pipe(
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
                )
                .toArray();
            assert.deepEqual(xs, [5, 6]);
        });
    });
});

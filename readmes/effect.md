# Effect.js - How It Works Under the Hood

## JS Generators - The Foundation

A generator function (`function*`) returns an iterator that can be **paused and resumed**.

```javascript
function* counter() {
  console.log('start');
  yield 1; // pause here, return 1
  console.log('resumed');
  yield 2; // pause here, return 2
  console.log('done');
}

const gen = counter(); // nothing runs yet
gen.next(); // logs "start",    returns { value: 1, done: false }
gen.next(); // logs "resumed",  returns { value: 2, done: false }
gen.next(); // logs "done",     returns { value: undefined, done: true }
```

### yield is a two-way channel

The caller can **send values back** into the generator:

```javascript
function* adder() {
  const a = yield 'give me a'; // pauses, receives what next() passes
  const b = yield 'give me b';
  return a + b;
}

const g = adder();
g.next(); // { value: 'give me a', done: false }
g.next(10); // sends 10 -> a=10, { value: 'give me b', done: false }
g.next(20); // sends 20 -> b=20, { value: 30, done: true }
```

### gen.throw(err) - injecting errors at the yield point

```javascript
function* safe() {
  try {
    const val = yield 'waiting';
    console.log(val);
  } catch (e) {
    console.log('caught:', e.message);
  }
}

const g = safe();
g.next(); // { value: 'waiting', done: false }
g.throw(new Error('boom')); // logs "caught: boom"
```

### yield\* - delegation

`yield*` delegates to another generator, flattening it:

```javascript
function* inner() {
  yield 1;
  yield 2;
}

function* outer() {
  yield 0;
  yield* inner(); // delegates to inner, yields 1, 2
  yield 3;
}

[...outer()]; // [0, 1, 2, 3]
```

## How Effect Uses Generators

Effect repurposes the generator machinery. When you `yield*` an Effect inside `Effect.gen`, the runner suspends the generator, executes the Effect, and either:

- resumes with the success value via `gen.next(value)`
- or aborts with the error via `gen.throw(error)`

It's the same trick that made `co` and similar libraries work before `async/await` existed.

### The Runner Pattern

A **runner** is an orchestrator function that drives the generator. The core loop is always the same: pull the next yielded Effect, execute it, feed the result back via `next()` or `throw()`.

Here's the idea in its simplest form (sync, no real Effect library):

```javascript
function runSync(generatorFn) {
  const gen = generatorFn();

  function step(result) {
    if (result.done) return result.value;

    const effect = result.value;

    try {
      const value = executeEffect(effect);
      return step(gen.next(value)); // send success back
    } catch (err) {
      return step(gen.throw(err)); // send error back
    }
  }

  return step(gen.next());
}
```

Now the real version — same loop, but async. This is what `Effect.runPromise` does conceptually:

```javascript
function runPromise(effect) {
  return new Promise((resolve, reject) => {
    const gen = effect.generator();

    function step(result) {
      if (result.done) {
        resolve(result.value);
        return;
      }

      const nextEffect = result.value;

      nextEffect
        .execute()
        .then((value) => step(gen.next(value)))
        .catch((err) => {
          try {
            step(gen.throw(err)); // let generator catch it
          } catch (uncaught) {
            reject(uncaught); // generator didn't catch -> reject
          }
        });
    }

    try {
      step(gen.next());
    } catch (err) {
      reject(err);
    }
  });
}
```

If the generator has a `try/catch` (like `catchAll`), `gen.throw()` lands there. If not, it bubbles up and the whole promise rejects.

## Effect.gen vs Effect.runPromise

```
Effect.gen       -> "here's a generator describing what to do" (builds the Effect)
Effect.runPromise -> "now actually do it" (the runner that executes it)
```

**Effects are lazy.** `Effect.gen`, `pipe`, `flatMap` are all just building a description. Nothing runs until `runPromise` walks that description and performs the side effects.

```typescript
// build the program (nothing runs yet)
const program = pipe(
  costCheck,
  Effect.flatMap((costResult) => sendSms(costResult)),
  Effect.catchAll(...),
  Effect.provide(FetchHttpClient.layer)
);

// NOW run it
return Effect.runPromise(program);
```

## pipe

`pipe` chains transformations left-to-right:

```typescript
const response =
  yield *
  pipe(
    client.execute(request), // 1. make HTTP request (returns an Effect)
    Effect.scoped, // 2. auto-cleanup resources when done
    Effect.mapError(
      (
        error // 3. if it fails, wrap as SmsRuNetworkError
      ) => new SmsRuNetworkError({ cause: error })
    )
  );
```

`yield*` then unwraps the resulting Effect - either returns the success value into `response`, or short-circuits the `Effect.gen` block with the error (which propagates up to `catchAll`).

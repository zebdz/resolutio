# Async Iterables and `for await...of`

## Example: reading file lines

```typescript
async function readAllLines(filePath: string): Promise<string[]> {
  const rl = readline.createInterface({
    input: createReadStream(filePath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });
  const lines: string[] = [];
  for await (const line of rl) {
    lines.push(line);
  }
  return lines;
}
```

`readline.createInterface` returns an **async iterable** — it emits lines one at a time as they're read from the stream. Each iteration awaits the next line.

`for await...of` is the async equivalent of `for...of`. Instead of consuming values that are already available, it awaits each value as it becomes ready.

## Sync vs async generators

```typescript
// Sync — values available immediately
function* syncGen() {
  yield 1;
  yield 2;
}
for (const n of syncGen()) { ... }

// Async — can await between yields
async function* asyncGen() {
  const res = await fetch('/api/page/1');
  yield await res.json();

  const more = await fetch('/api/page/2');
  yield await more.json();
}
for await (const data of asyncGen()) { ... }
```

## What implements the async iterator protocol?

Anything with a `[Symbol.asyncIterator]()` method:

- `readline` interfaces (line-by-line file reading)
- Node.js `Readable` streams
- Custom async generators (`async function*`)

## `ReadableStream` underlying source

Related pattern — the Web Streams API `start(controller)`:

```typescript
new ReadableStream({
  start(controller) {
    // called once when the stream is constructed
    // controller.enqueue(data) — push data into the stream
    // controller.close() — end the stream
  },
});
```

Not an async iterable, but a similar concept: data is produced over time and consumed as it arrives.

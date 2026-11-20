/** Keep browser rehearsal writes on an explicitly selected loopback test database. */
export function localSealDatabase() {
  const connection = process.env.POLL_TEST_DATABASE_URL;
  const url = connection && new URL(connection);

  if (
    !url ||
    !['postgresql:', 'postgres:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    !/^\/[a-zA-Z0-9_]+_test$/.test(url.pathname) ||
    url.search
  ) {
    throw new Error(
      'POLL_TEST_DATABASE_URL must identify a disposable loopback _test database.'
    );
  }

  return connection;
}

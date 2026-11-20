/** Next's Node startup hook. A rejected register() can leave next start listening,
 * so explicitly exit on invalid settings before accepting poll or worker requests. */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { readAnchorConfig } =
      await import('./infrastructure/anchor/anchorProviderFactory');
    const config = readAnchorConfig(process.env);

    if (!config.success) {
      console.error('Invalid anchor configuration:', config.error);
      process.exit(1);
    }
  }
}

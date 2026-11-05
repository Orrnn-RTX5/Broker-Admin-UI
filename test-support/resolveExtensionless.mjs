// Test-only ESM resolver. Admin services import sibling modules without a file extension (for example '../lib/api'), which
// plain node ESM does not resolve. Only a failed relative resolution without an extension is retried with '.js' appended.
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[cm]?js$/.test(specifier)) {
      return nextResolve(new URL(`${specifier}.js`, context.parentURL).href, context);
    }
    throw error;
  }
}

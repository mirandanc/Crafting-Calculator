import { handleRequest } from '@worker/proxy';

// The Workers runtime requires the module's default export to be the handler, so this is the one
// place a default export is allowed. All logic lives in proxy.ts.
export default {
  fetch(request, env, ctx): Promise<Response> {
    return handleRequest(request, {
      env,
      assets: env.ASSETS,
      cache: caches.default,
      waitUntil: (promise) => ctx.waitUntil(promise),
    });
  },
} satisfies ExportedHandler<Env>;

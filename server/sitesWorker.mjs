export default {
  async fetch(request, env) {
    if (!env?.ASSETS?.fetch) {
      return new Response("Static assets binding is unavailable.", { status: 503 });
    }
    return env.ASSETS.fetch(request);
  },
};

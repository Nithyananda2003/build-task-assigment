import handler from '../server/vercel-handler.js';
export default {fetch: request => handler.fetch(request)};

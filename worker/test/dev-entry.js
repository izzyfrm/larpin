// Local test harness only (never deployed): swaps Workers AI for a stub so the
// review pipeline can be exercised offline. The stub reads a marker appended to the file.
import worker from '../src/index.js';

const fakeAI = {
  async run(_model, input) {
    const dataUrl = input.messages[1].content[1].image_url.url;
    const tail = atob(dataUrl.split(',')[1]).slice(-16);
    if (tail.includes('ERROR-TEST')) throw new Error('stubbed outage');
    if (tail.includes('GIBBERISH')) return { response: 'I cannot help with that.' };
    return { response: `Sure! {"category":"${tail.includes('UNSAFE-TEST') ? 'sexual' : tail.includes('MINOR-TEST') ? 'minor_sexualized' : 'none'}"}` };
  },
};
const wrap = (env) => ({ ...env, AI: fakeAI, DB: env.DB, MEDIA: env.MEDIA });

export default {
  fetch: (req, env, ctx) => worker.fetch(req, wrap(env), ctx),
  scheduled: (event, env, ctx) => worker.scheduled(event, wrap(env), ctx),
};

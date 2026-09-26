importScripts('https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js');
const core = import('./simulation-core.js');
self.onmessage = async ({ data }) => {
  try {
    const { runSimulation } = await core;
    for (let number = 1; number <= data.config.runs; number++) {
      const seed = data.config.runs === 1 ? data.config.seed : `${data.config.seed}/${number}`;
      const result = runSimulation({ ...data.config, seed }, progress => {
        self.postMessage({ id: data.id, type: 'progress', number, seed, ...progress });
      });
      self.postMessage({ id: data.id, type: 'result', result: { number, ...result } });
    }
    self.postMessage({ id: data.id, type: 'done' });
  } catch (error) {
    self.postMessage({ id: data.id, type: 'error', message: error.message || String(error) });
  }
};

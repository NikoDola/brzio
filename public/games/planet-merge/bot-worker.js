// The same pinned Matter version as play.html. Search runs off the UI thread.
importScripts('https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js');
const planner = import('./bot-planner.js');
self.onmessage = async ({ data }) => {
  try {
    const { planMove } = await planner;
    self.postMessage({ id: data.id, move: planMove(data.snapshot) });
  } catch (error) {
    self.postMessage({ id: data.id, error: error.message || String(error) });
  }
};

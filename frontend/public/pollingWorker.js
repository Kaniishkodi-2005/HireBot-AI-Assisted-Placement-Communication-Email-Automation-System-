// Web Worker for background polling
// This runs on a separate thread and is NOT throttled by the browser when tabs are inactive.
// It sends a 'tick' message every 30 seconds to trigger the main thread's fetch logic.

let intervalId = null;

self.onmessage = (e) => {
  if (e.data === 'start') {
    if (intervalId) clearInterval(intervalId);

    // Immediate tick
    // self.postMessage('tick');

    // Start interval
    intervalId = setInterval(() => {
      self.postMessage('tick');
    }, 5000); // 5 seconds for instant notifications
  } else if (e.data === 'stop') {
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
  }
};

'use strict';

/** Periodic background jobs that never overlap and never crash the bot. */

const timers = [];

/**
 * @param {string} name
 * @param {number} minutes
 * @param {() => Promise<void>} job
 * @param {{ firstRunAfterMs?: number }} [options]
 */
function every(name, minutes, job, { firstRunAfterMs = 60_000 } = {}) {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await job();
    } catch (err) {
      console.error(`[Scheduler] ${name} failed:`, err?.message ?? err);
    } finally {
      running = false;
    }
  };
  const first = setTimeout(run, firstRunAfterMs + Math.floor(Math.random() * 15_000));
  const interval = setInterval(run, Math.max(1, minutes) * 60_000);
  first.unref?.();
  interval.unref?.();
  timers.push(first, interval);
  return run;
}

function stopAll() {
  for (const timer of timers.splice(0)) clearTimeout(timer);
}

module.exports = { every, stopAll };

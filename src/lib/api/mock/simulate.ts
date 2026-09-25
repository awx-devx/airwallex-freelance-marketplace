type Job = { fn: () => void; timer?: ReturnType<typeof setTimeout> };

const jobs = new Set<Job>();

export const SETTLE_MS = 2_500;

export function scheduleMockJob(fn: () => void, delayMs: number) {
  const job: Job = { fn };
  jobs.add(job);
  if (process.env.VITEST) return;
  job.timer = setTimeout(() => {
    jobs.delete(job);
    fn();
  }, delayMs);
}

export function flushMockWebhooks() {
  const batch = [...jobs];
  jobs.clear();
  for (const job of batch) {
    if (job.timer) clearTimeout(job.timer);
    job.fn();
  }
}

export function resetMockJobs() {
  for (const job of jobs) {
    if (job.timer) clearTimeout(job.timer);
  }
  jobs.clear();
}

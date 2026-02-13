// src/lib/plans.ts
export const PLAN_LIMITS = {
  free: {
    maxActiveJobs: 1,
    analytics: false,
  },
  starter: {
    maxActiveJobs: 5,
    analytics: true,
  },
  professional: {
    maxActiveJobs: 20,
    analytics: true,
  },
  enterprise: {
    maxActiveJobs: Infinity,
    analytics: true,
  },
};

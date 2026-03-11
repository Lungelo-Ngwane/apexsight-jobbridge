// src/lib/plans.ts
export const PLAN_LIMITS = {
  free: {
    maxActiveJobs: 1,
    analytics: false,
  },
  starter: {
    maxActiveJobs: 2,
    analytics: true,
  },
  professional: {
    maxActiveJobs: 3,
    analytics: true,
  },
  enterprise: {
    maxActiveJobs: 4,
    analytics: true,
  },
};

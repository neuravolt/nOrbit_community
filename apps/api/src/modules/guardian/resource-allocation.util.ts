export function calculateWebsiteMetrics(_input: any): any {
  return {
    cpu: { utilizationPercent: 0, rawPercent: 0 },
    ram: { usedMB: 0, allocatedMB: 0 },
    storage: { usedGB: 0, allocatedGB: 0, breakdown: [] },
  };
}

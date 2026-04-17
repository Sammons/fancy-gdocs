export function batchSplit<T>(requests: T[], limit = 1000): T[][] {
  if (requests.length === 0) return [];
  const out: T[][] = [];
  for (let i = 0; i < requests.length; i += limit) {
    out.push(requests.slice(i, i + limit));
  }
  return out;
}

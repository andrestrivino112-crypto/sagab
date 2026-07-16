export function calcAvg(t: string, c: string, e: string): number | null {
  const [tv, cv, ev] = [parseFloat(t), parseFloat(c), parseFloat(e)];
  if ([tv,cv,ev].some(isNaN)) return null;
  if ([tv,cv,ev].some(v => v < 0 || v > 10)) return null;
  return Math.round((tv * 0.2 + cv * 0.2 + ev * 0.6) * 100) / 100;
}
export function isValid(v: string) { if (!v) return true; const n = parseFloat(v); return !isNaN(n) && n >= 0 && n <= 10; }
export function isComplete(v: string) { if (!v) return false; const n = parseFloat(v); return !isNaN(n) && n >= 0 && n <= 10; }
export function initials(name: string) { return name.split(" ").map(n => n[0]).slice(0,2).join(""); }
export function barColor(v: number) { return v >= 8 ? "#2E7D32" : v < 7 ? "#C62828" : "#2E75B6"; }

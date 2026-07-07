function expandToken(token) {
  if (/^-?\d+(\.\d+)?$/.test(token)) return token;
  if (/^-?\d+(\.\d+)?e\d+$/i.test(token)) {
    const val = Number(token);
    return isNaN(val) ? token : String(val);
  }
  const suffixMatch = token.match(/^(-?\d+(\.\d+)?)(k|m|b)$/i);
  if (suffixMatch) {
    const num = parseFloat(suffixMatch[1]);
    const suffix = suffixMatch[3].toLowerCase();
    const multipliers = {
      k: 1_000,
      m: 1_000_000,
      b: 1_000_000_000
    };
    return String(num * (multipliers[suffix] || 1));
  }
  return token;
}
function parseAmount(input) {
  if (!input || typeof input !== 'string') return NaN;
  let expr = input.trim().toLowerCase();
  if (!expr) return NaN;
  const simpleNum = Number(expr);
  if (!isNaN(simpleNum)) {
    const result = Math.floor(simpleNum);
    return result > 0 ? result : NaN;
  }
  const suffixOnly = expr.match(/^(\d+(\.\d+)?)(k|m|b)$/i);
  if (suffixOnly) {
    const expanded = expandToken(expr);
    const val = Math.floor(Number(expanded));
    return val > 0 ? val : NaN;
  }
  if (/[a-df-jl-z]/i.test(expr.replace(/e\d/gi, ''))) return NaN;
  const tokens = expr.match(/(\d+(\.\d+)?(e\d+)?(k|m|b)?|[+\-*/%])/gi);
  if (!tokens) return NaN;
  const expanded = tokens.map(t => {
    if (/^[+\-*/%]$/.test(t)) return t;
    return expandToken(t);
  }).join('');
  if (/[^0-9.+\-*/%\s]/.test(expanded)) return NaN;
  if (/[+\-*/%]{2,}/.test(expanded)) return NaN;
  if (/[*/%]$/.test(expanded) || /^[*/%]/.test(expanded)) return NaN;
  try {
    const fn = new Function(`"use strict"; return (${expanded});`);
    const result = fn();
    if (typeof result !== 'number' || !isFinite(result)) return NaN;
    const floored = Math.floor(result);
    return floored > 0 ? floored : NaN;
  } catch {
    return NaN;
  }
}
function formatAmount(num) {
  if (num === undefined || num === null) return '0';
  if (num >= 1_000_000_000) {
    const val = num / 1_000_000_000;
    return (val % 1 === 0 ? val.toString() : val.toFixed(2).replace(/\.?0+$/, '')) + 'b';
  }
  if (num >= 1_000_000) {
    const val = num / 1_000_000;
    return (val % 1 === 0 ? val.toString() : val.toFixed(2).replace(/\.?0+$/, '')) + 'm';
  }
  if (num >= 1_000) {
    const val = num / 1_000;
    return (val % 1 === 0 ? val.toString() : val.toFixed(2).replace(/\.?0+$/, '')) + 'k';
  }
  return num.toLocaleString();
}
module.exports = {
  parseAmount,
  formatAmount,
  expandToken
};
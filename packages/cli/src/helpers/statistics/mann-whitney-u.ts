const jStat = require('jStat').jStat;

interface RankSummary {
  set: string
  val: number,
  rank?: number
}


/*
 * Standard ranking
 *
 * The MIT License, Copyright (c) 2014 Ben Magyar
 */
function standard(array: RankSummary[], key: string) {
  // sort the array
  array = array.sort((a: RankSummary, b: RankSummary) => {
    // @ts-ignore
    const x = a[key];
    // @ts-ignore
    const y = b[key];
    return ((x < y) ? -1 : ((x > y) ? 1 : 0));
  });
  // assign a naive ranking
  for (let i = 1; i < array.length + 1; i++) {
    array[i - 1].rank = i;
  }
  return array;
}

/*
 * Fractional ranking
 *
 * The MIT License, Copyright (c) 2014 Ben Magyar
 */
function fractional(array: RankSummary[], key: string) {
  array = standard(array, key);
  // now apply fractional
  let pos = 0;
  while (pos < array.length) {
    let sum = 0;
    let i = 0;
    // @ts-ignore
    for (i = 0; array[pos + i + 1] && (array[pos + i][key] === array[pos + i + 1][key]); i++) {
      // @ts-ignore
      sum += array[pos + i].rank;
    }
    // @ts-ignore
    sum += array[pos + i].rank;
    const endPos = pos + i + 1;
    for (pos; pos < endPos; pos++) {
      array[pos].rank = sum / (i + 1);
    }
    pos = endPos;
  }
  return array;
}

function rank(x: number[], y: number[]) {
  const combined = [];
  let nx = x.length;
  let ny = y.length;
  let ranked;
  while (nx--) {
    combined.push({
      set: 'x',
      val: x[nx],
    });
  }
  while (ny--) {
    combined.push({
      set: 'y',
      val: y[ny],
    });
  }
  ranked = fractional(combined, 'val');
  return ranked;
}

// @ts-ignore
function statistic(x, y) {
  const ranked = rank(x, y);
  const nr = ranked.length;
  const nx = x.length;
  const ny = y.length;
  const rankSums = {
    x: 0,
    y: 0,
  };
  let i = 0;
  let t = 0;
  let nt = 1;
  let tcf;
  let ux;
  let uy;

  while (i < nr) {
    if (i > 0) {
      if (ranked[i].val === ranked[i - 1].val) {
        nt++;
      } else {
        if (nt > 1) {
          t += Math.pow(nt, 3) - nt;
          nt = 1;
        }
      }
    }
    // @ts-ignore
    rankSums[ranked[i].set] += ranked[i].rank;
    i++;
  }
  tcf = 1 - (t / (Math.pow(nr, 3) - nr));
  ux = nx * ny + (nx * (nx + 1) / 2) - rankSums.x;
  uy = nx * ny - ux;

  return {
    tcf,
    ux,
    uy,
    big: Math.max(ux, uy),
    small: Math.min(ux, uy),
  };
}

export default function mannWhitneyUTest(x: number[], y: number[], alt = 'two-sided', corr = true): { p: number, U: number } {
  const nx = x.length; // x's size
  const ny = y.length; // y's size
  let f = 1;
  let u;
  let mu;
  let std;
  let z;
  let p;

  // test statistic
  u = statistic(x, y);

  // mean compute and correct if given
  if (corr) {
    mu = (nx * ny / 2) + 0.5;
  } else {
    mu = nx * ny / 2;
  }

  // compute standard deviation using tie correction factor
  std = Math.sqrt(u.tcf * nx * ny * (nx + ny + 1) / 12);

  // compute z according to given alternative
  if (alt === 'less') {
    z = (u.ux - mu) / std;
  } else if (alt === 'greater') {
    z = (u.uy - mu) / std;
  } else if (alt === 'two-sided') {
    z = Math.abs((u.big - mu) / std);
  } else {
    throw new Error('Unknown alternative argument');
  }

  // factor to correct two sided p-value
  if (alt === 'two-sided') {
    f = 2;
  }

  // compute p-value using CDF of standard normal
  p = jStat.normal.cdf(-z, 0, 1) * f;

  return { U: u.small, p };
};

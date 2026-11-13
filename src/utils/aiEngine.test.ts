import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bsOf,
  primaryCol,
  hasViolet,
  hashPeriod,
  aiEnsemble,
  server3Prediction,
  StatisticalPredictionEngine,
  SYS,
} from './aiEngine';

test('bsOf returns BIG for >=5 and SMALL for <5', () => {
  assert.equal(bsOf(0), 'SMALL');
  assert.equal(bsOf(4), 'SMALL');
  assert.equal(bsOf(5), 'BIG');
  assert.equal(bsOf(9), 'BIG');
});

test('primaryCol and hasViolet handle 0 and 5 special numbers correctly', () => {
  assert.equal(primaryCol(0), 'RED');
  assert.equal(hasViolet(0), true);
  assert.equal(primaryCol(5), 'GREEN');
  assert.equal(hasViolet(5), true);
  assert.equal(primaryCol(1), 'GREEN');
  assert.equal(hasViolet(1), false);
  assert.equal(primaryCol(2), 'RED');
  assert.equal(hasViolet(2), false);
});

test('hashPeriod is deterministic for given period', () => {
  const p1 = '202610270001';
  assert.equal(hashPeriod(p1), hashPeriod(p1));
  assert.notEqual(hashPeriod(p1), hashPeriod('202610270002'));
});

test('aiEnsemble returns a valid prediction result with 26+ breakdown systems', () => {
  const sampleHistory = Array.from({ length: 1000 }, (_, i) => i % 10);
  const res = aiEnsemble('202610270016', sampleHistory);

  assert.ok(res.number >= 0 && res.number <= 9);
  assert.ok(res.bs === 'BIG' || res.bs === 'SMALL');
  assert.ok(res.confidence >= 60 && res.confidence <= 100);
  assert.ok(res.label.length > 0);
  assert.equal(Object.keys(res.breakdown).length, Object.keys(SYS).length);
  assert.ok(res.breakdown['MWIN']);
  assert.ok(res.breakdown['MKV2']);
  assert.ok(res.breakdown['SURE']);
  assert.ok(res.breakdown['GAPN']);
  assert.ok(res.breakdown['RNDR']);
});

test('StatisticalPredictionEngine multiWindowTrend assesses 10, 20, 50, 100, 500, 1000 windows', () => {
  const history1000 = Array.from({ length: 1000 }, (_, i) => (i < 20 ? 8 : i % 2 === 0 ? 7 : 3));
  const trend = StatisticalPredictionEngine.multiWindowTrend(history1000);

  assert.ok(trend.windows[10]);
  assert.ok(trend.windows[20]);
  assert.ok(trend.windows[50]);
  assert.ok(trend.windows[100]);
  assert.ok(trend.windows[500]);
  assert.ok(trend.windows[1000]);
  assert.equal(trend.windows[10].bias, 'BIG_BIAS');
  assert.ok(trend.trendMomentum > 0);
});

test('StatisticalPredictionEngine markovTransitions computes 1st and 2nd order probabilities with Laplace smoothing', () => {
  const history = [7, 7, 7, 2, 7, 7, 3, 7, 7, 8];
  const markov = StatisticalPredictionEngine.markovTransitions(history);

  assert.ok(markov.laplaceBigProb > 0 && markov.laplaceBigProb < 1);
  assert.ok(markov.laplaceSmallProb > 0 && markov.laplaceSmallProb < 1);
  assert.equal(Math.round((markov.laplaceBigProb + markov.laplaceSmallProb) * 10) / 10, 1.0);
});

test('StatisticalPredictionEngine detectRandomRepeatAndBounce tracks repeat rates and overdue repeats', () => {
  // Sequence with immediate repeat [8, 8, ...]
  const historyWithRepeat = [8, 8, 2, 7, 3, 8, 2, 7, 4, 9];
  const res = StatisticalPredictionEngine.detectRandomRepeatAndBounce(historyWithRepeat);

  assert.ok(typeof res.empiricalRepeatRate === 'number');
  assert.ok(typeof res.empiricalBounceRate === 'number');
  assert.equal(res.lastNum, 8);
  assert.equal(res.roundsSinceRepeat, 0); // Happened at index 0
});

test('StatisticalPredictionEngine predictExactNumber implements fixed custom mapping with strictly ONE opposite number', () => {
  // Custom opposite map & fixed BS mapping:
  // BIG -> 1, 2, 3 (from source digits 0,3,5,6,9)
  // SMALL -> 6, 7, 8, 9 (from source digits 1,2,4,7,8)
  const resBig = StatisticalPredictionEngine.predictExactNumber('BIG', [0, 5, 2, 7]);
  assert.equal(resBig.predictedSize, 'BIG');
  assert.ok([1, 2, 3].includes(resBig.targetNumber));
  assert.equal(resBig.supportingNumbers?.length ?? 0, 0);
  assert.equal(resBig.runnerUps.length, 0);
  assert.equal(resBig.candidateProbs.length, 1);
  assert.equal(resBig.candidateProbs[0].probability, 100);

  const resSmall = StatisticalPredictionEngine.predictExactNumber('SMALL', [7, 6, 2, 9]);
  assert.equal(resSmall.predictedSize, 'SMALL');
  assert.ok([6, 7, 8, 9].includes(resSmall.targetNumber));
  assert.equal(resSmall.supportingNumbers?.length ?? 0, 0);
  assert.equal(resSmall.runnerUps.length, 0);
  assert.equal(resSmall.candidateProbs.length, 1);
  assert.equal(resSmall.candidateProbs[0].probability, 100);
});

test('server3Prediction processes 1000 records with Full Logic multi-pattern analysis and single opposite number', () => {
  const history1000 = [1, 2, 4, 6, 8, 0, 3, 5, 7, 9].concat(Array.from({ length: 990 }, (_, i) => i % 10));

  const normalPred = server3Prediction('20261028100051957', history1000, 0);
  assert.ok(['BIG', 'SMALL', 'SKIP'].includes(normalPred.bs));
  if (!normalPred.isSkip) {
    assert.ok(normalPred.number >= 0 && normalPred.number <= 9);
    assert.ok(
      ['BIG 1', 'BIG 2', 'BIG 3', 'SMALL 6', 'SMALL 7', 'SMALL 8', 'SMALL 9'].includes(
        `${normalPred.bs} ${normalPred.number}`
      ),
      `Unexpected format ${normalPred.bs} ${normalPred.number}`
    );
    assert.equal(normalPred.supportingNumbers?.length ?? 0, 0);
    assert.equal(normalPred.runnerUps?.length ?? 0, 0);
    assert.equal(normalPred.candidateProbs?.length, 1);
    assert.equal(normalPred.candidateProbs?.[0].probability, 100);
    assert.ok(normalPred.confidence >= 50 && normalPred.confidence <= 95);
    assert.ok(normalPred.patternResponsible && normalPred.patternResponsible.length > 0);
  }
});

test('StatisticalPredictionEngine analyzeLatestNumberOccurrences deeply audits 1000 records', () => {
  const history1000: number[] = [7];
  for (let i = 1; i < 1000; i++) {
    if (history1000[i - 1] === 7 && i < 200) {
      history1000.push(2);
    } else {
      history1000.push((i * 3 + 1) % 10);
    }
  }

  const audit = StatisticalPredictionEngine.analyzeLatestNumberOccurrences(history1000);
  assert.equal(audit.lastNum, 7);
  assert.ok(audit.totalOccurrences > 0);
  assert.ok(audit.topNextNumber >= 0 && audit.topNextNumber <= 9);
  assert.ok(audit.bigPctAfterLastNum >= 0 && audit.bigPctAfterLastNum <= 100);
  assert.ok(audit.smallPctAfterLastNum >= 0 && audit.smallPctAfterLastNum <= 100);
  assert.ok(audit.redPctAfterLastNum >= 0 && audit.redPctAfterLastNum <= 100);
  assert.ok(audit.greenPctAfterLastNum >= 0 && audit.greenPctAfterLastNum <= 100);
});

test('StatisticalPredictionEngine analyzeColorPatterns detects colour streaks, zigzags, and violet cycle', () => {
  const redStreakHistory = [2, 4, 6, 8, 2, 1, 3, 7];
  const redAnalysis = StatisticalPredictionEngine.analyzeColorPatterns(redStreakHistory);
  assert.equal(redAnalysis.colorStreak.type, 'RED');
  assert.ok(redAnalysis.colorStreak.count >= 4);

  const altHistory = [2, 3, 4, 7, 6, 9, 2, 1];
  const altAnalysis = StatisticalPredictionEngine.analyzeColorPatterns(altHistory);
  assert.equal(altAnalysis.isAlternating, true);

  const noVioletHistory = [1, 2, 3, 4, 6, 7, 8, 9, 1, 2, 3];
  const violetAnalysis = StatisticalPredictionEngine.analyzeColorPatterns(noVioletHistory);
  assert.ok(violetAnalysis.roundsSinceViolet >= 6);
  assert.equal(violetAnalysis.violetSurge, true);
});

test('StatisticalPredictionEngine selectExactNumber maps BIG/SMALL strictly to valid opposite digits with 100% single probability', () => {
  const redHistory = [2, 4, 6, 8, 2, 4, 6, 8, 2, 4];
  const resBig = StatisticalPredictionEngine.predictExactNumber('BIG', redHistory);
  assert.ok([1, 2, 3].includes(resBig.targetNumber));
  assert.equal(resBig.candidateProbs.reduce((acc, c) => acc + c.probability, 0), 100);

  const resSmall = StatisticalPredictionEngine.predictExactNumber('SMALL', redHistory);
  assert.ok([6, 7, 8, 9].includes(resSmall.targetNumber));
  assert.equal(resSmall.candidateProbs.reduce((acc, c) => acc + c.probability, 0), 100);
});


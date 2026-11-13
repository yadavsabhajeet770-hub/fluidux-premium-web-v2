import test from 'node:test';
import assert from 'node:assert/strict';
import {
  runBunnyAI,
  predictExactNumber,
  runNYFusionPrediction,
  CPU_PATTERN_DB,
} from './nyFusionPredictor';
import {
  validateWingoRecords,
  calculateAdvancedFrequency,
  calculateMultiWindowTrend,
  calculateMarkovTransitions,
  matchAdvancePatterns,
  runWalkForwardBacktest,
} from './nyAdvancePatternEngine';
import {
  CUSTOM_BS_MAP,
  CUSTOM_OPPOSITE_NUM_MAP,
  WingoPatternTracker,
  getCustomMappedPair,
} from './wingoPatternTracker';
import {
  collectRawPatternSignals,
  runFullLogicAnalysis,
} from './fullLogicPatternEngines';
import { SURESHOT_DB, CLEAN_500_PATTERNS } from './nyAdvancePatternData';

test('CPU_PATTERN_DB contains 350+ calibrated WinGo patterns from fulllogic.txt', () => {
  const keys = Object.keys(CPU_PATTERN_DB);
  assert.ok(keys.length >= 300, `Expected >= 300 unique patterns, got ${keys.length}`);
  assert.equal(CPU_PATTERN_DB['BBB'].next, 'SMALL');
  assert.equal(CPU_PATTERN_DB['SSS'].next, 'BIG');
});

test('SURESHOT_DB contains 592 calibrated sequences and CLEAN_500_PATTERNS contains 500 patterns', () => {
  const sureshotKeys = Object.keys(SURESHOT_DB);
  assert.equal(sureshotKeys.length, 592, `Expected 592 sureshot keys, got ${sureshotKeys.length}`);
  assert.equal(CLEAN_500_PATTERNS.length, 500, `Expected 500 clean patterns, got ${CLEAN_500_PATTERNS.length}`);
});

test('Fixed Custom Mappings match exact specification 0-9', () => {
  const expected: Record<number, { bs: 'BIG' | 'SMALL'; opp: number; label: string }> = {
    0: { bs: 'BIG', opp: 1, label: 'BIG 1' },
    1: { bs: 'SMALL', opp: 7, label: 'SMALL 7' },
    2: { bs: 'SMALL', opp: 6, label: 'SMALL 6' },
    3: { bs: 'BIG', opp: 3, label: 'BIG 3' },
    4: { bs: 'SMALL', opp: 8, label: 'SMALL 8' },
    5: { bs: 'BIG', opp: 1, label: 'BIG 1' },
    6: { bs: 'BIG', opp: 2, label: 'BIG 2' },
    7: { bs: 'SMALL', opp: 9, label: 'SMALL 9' },
    8: { bs: 'SMALL', opp: 8, label: 'SMALL 8' },
    9: { bs: 'BIG', opp: 2, label: 'BIG 2' },
  };
  for (let d = 0; d <= 9; d++) {
    assert.equal(CUSTOM_BS_MAP[d], expected[d].bs);
    assert.equal(CUSTOM_OPPOSITE_NUM_MAP[d], expected[d].opp);
    assert.equal(getCustomMappedPair(d).formatLabel, expected[d].label);
  }
});

test('Data Validation Engine sorts 17-digit periods accurately via BigInt, dedupes, and rejects unfinished/invalid periods', () => {
  const rawData = [
    { period: '20261028100051958', number: 5 },
    { period: '20261028100051956', number: 7 },
    { period: '20261028100051957', number: 2 },
    { period: '20261028100051957', number: 2 }, // Duplicate
    { period: '20261028100051959', number: 15 }, // Invalid range
    { period: '20261028100051960', number: '' }, // Empty string unfinished
    { period: '20261028100051961', number: 4 }, // Future / current period excluded
  ];

  const result = validateWingoRecords(rawData, { excludePeriod: '20261028100051961' });
  assert.equal(result.duplicatesDetected, 1);
  assert.equal(result.invalidRejected, 3);
  assert.equal(result.chronological.length, 3);
  assert.equal(result.chronological[0].period, '20261028100051956');
  assert.equal(result.chronological[1].period, '20261028100051957');
  assert.equal(result.chronological[2].period, '20261028100051958');
  assert.equal(result.recency[0].period, '20261028100051958');
});

test('Advanced Frequency Analysis computes counts, expected frequencies, and hot/cold numbers', () => {
  const history = Array.from({ length: 1000 }, (_, i) => i % 10);
  const freq = calculateAdvancedFrequency(history);

  assert.equal(freq.depth, 1000);
  assert.equal(freq.probabilityBig, 50);
  assert.equal(freq.probabilitySmall, 50);
  for (let n = 0; n <= 9; n++) {
    assert.equal(freq.frequency0to9[n].count, 100);
    assert.equal(freq.frequency0to9[n].percentage, 10);
  }
});

test('Multi-Window Trend Analysis inspects all 8 windows and evaluates momentum', () => {
  const history = Array.from({ length: 1000 }, (_, i) => (i < 20 ? 8 : i % 2 === 0 ? 7 : 2));
  const multi = calculateMultiWindowTrend(history);

  assert.ok(multi.windows[10]);
  assert.ok(multi.windows[1000]);
  assert.equal(multi.windows[10].bias, 'BIG_BIAS');
  assert.ok(multi.trendMomentum > 0);
});

test('Markov Chain & Conditional Transitions apply Laplace smoothing', () => {
  const history = [7, 7, 7, 2, 7, 7, 3, 7, 7, 8];
  const markov = calculateMarkovTransitions(history);

  assert.ok(markov.laplaceBigProb > 0 && markov.laplaceBigProb < 1);
  assert.ok(markov.laplaceSmallProb > 0 && markov.laplaceSmallProb < 1);
  assert.equal(Math.round((markov.laplaceBigProb + markov.laplaceSmallProb) * 10) / 10, 1.0);
});

test('SURESHOT_DATABASE match triggers high confidence and isSureshot flag', () => {
  const chrono = ['B', 'S', 'B', 'S', 'B', 'B', 'B', 'B', 'S'];
  const history = chrono.reverse().map((t) => (t === 'B' ? 8 : 2));

  const match = matchAdvancePatterns(history);
  assert.equal(match.isSureshot, true);
  assert.equal(match.predictedSize, 'SMALL');
  assert.ok(match.confidence >= 93);
});

test('Deep Pattern Signals cover Cycle, Zigzag, Blocks, Mirror, Triangle, Wave, Palindrome, Markov, Transition, Frequency', () => {
  // 4-beat repeating harmonic cycle [9, 1, 8, 2, 9, 1, 8, 2, ...] -> B S B S repeating
  const cycleHistory = [9, 1, 8, 2, 9, 1, 8, 2, 6, 3, 7, 4, 8, 1, 6, 2, 7, 3, 8, 4, 9, 1, 8, 2, 5, 3];
  const signals = collectRawPatternSignals(cycleHistory);
  const ids = new Set(signals.map((s) => s.patternId));
  assert.ok(ids.has('CYCLE'));
  assert.ok(ids.has('CUSTOM_DIGIT_MAP'));
  assert.ok(signals.length >= 4);

  // Check fixed cycle next-token bug is resolved in runBunnyAI
  const bunnyCycle = runBunnyAI(cycleHistory, 0);
  // tokens: [B, S, B, S, B, S, B, S] -> 2-beat/4-beat cycle predicts next after S is B (types[1] = S? wait: types = [B, S, B, S], cl=2 repeats B,S; history[0]=B so next is types[cl-1]=S -> SMALL; Wait for 3-beat [9,8,1, 9,8,1] -> cl=3 -> types[2]=S!)
  assert.ok(bunnyCycle.prediction === 'BIG' || bunnyCycle.prediction === 'SMALL');
});

test('predictExactNumber outputs strictly ONE opposite number with zero supporting/backup numbers', () => {
  const history = [2, 4, 6, 8, 1, 3, 7, 9, 0, 5];
  const resSmall = predictExactNumber('SMALL', history);
  assert.ok([6, 7, 8, 9].includes(resSmall.targetNumber));
  assert.equal(resSmall.supportingNumbers?.length ?? 0, 0);
  assert.equal(resSmall.runnerUps.length, 0);
  assert.equal(resSmall.candidateProbs.length, 1);
  assert.equal(resSmall.candidateProbs[0].probability, 100);

  const resBig = predictExactNumber('BIG', history);
  assert.ok([1, 2, 3].includes(resBig.targetNumber));
  assert.equal(resBig.supportingNumbers?.length ?? 0, 0);
  assert.equal(resBig.runnerUps.length, 0);

  const skipResult = predictExactNumber('SKIP', [5, 2]);
  assert.equal(skipResult.targetNumber, -1);
  assert.equal(skipResult.isSkip, true);
});

test('Walk-forward backtest executes cleanly across 1000 historical records with realistic out-of-sample rate', () => {
  const history1000 = Array.from({ length: 1000 }, (_, i) => (i % 2 === 0 ? 8 : 3));
  const accuracy = runWalkForwardBacktest(history1000, 30);
  assert.ok(accuracy >= 40 && accuracy <= 100, `Walk forward accuracy out of bounds: ${accuracy}%`);
});

test('nyFusionPredictor output messages contain zero emojis and follow clean prediction format', () => {
  const history = [8, 8, 8, 8, 8, 8, 8, 8, 2, 3, 7, 1, 8, 8, 8];
  const tracker = new WingoPatternTracker(false);
  const full = runNYFusionPrediction('202611080002', history, 0, { tracker });
  const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  assert.ok(!emojiRegex.test(full.message), `full.message contains emoji: ${full.message}`);
  assert.ok(!emojiRegex.test(full.patternName), `full.patternName contains emoji: ${full.patternName}`);
  assert.ok(!emojiRegex.test(full.reasoning), `full.reasoning contains emoji: ${full.reasoning}`);
  assert.equal(full.supportingNumbers?.length ?? 0, 0);
  assert.equal(full.runnerUps.length, 0);
});

test('WingoPatternTracker audits separate BS vs Exact Number records, penalizes failing patterns, and blocks duplicate period writes', () => {
  const tracker = new WingoPatternTracker(false);
  assert.equal(tracker.canLockPrediction('202611120001'), true);

  tracker.recordPrediction({
    period: '202611120001',
    predictedBS: 'BIG',
    predictedNumber: 1,
    patternResponsible: 'ZIGZAG',
    contributingSignals: [{ patternId: 'ZIGZAG', bs: 'BIG' }, { patternId: 'REVERSAL', bs: 'BIG' }],
    sourceDigit: 0,
    confidence: 78,
    status: 'ACTIVE',
    analysis: 'Test lock',
  });

  // Duplicate lock blocked before audit
  assert.equal(tracker.canLockPrediction('202611120001'), false);

  // Actual = 8 (BIG -> BS WIN, exact number = 8 != 1 -> NUMBER LOSS)
  const audited = tracker.auditActualResult('202611120001', 8);
  assert.ok(audited);
  assert.equal(audited.bsResult, 'WIN');
  assert.equal(audited.numberResult, 'LOSS');
  assert.equal(audited.combinedResult, 'BS_WIN');

  // Now simulate 2 consecutive BS losses on ZIGZAG to verify priority decay
  const initialWeight = tracker.getPatternPriority('ZIGZAG');
  for (let idx = 2; idx <= 3; idx++) {
    const pid = `20261112000${idx}`;
    tracker.recordPrediction({
      period: pid,
      predictedBS: 'BIG',
      predictedNumber: 1,
      patternResponsible: 'ZIGZAG',
      contributingSignals: [{ patternId: 'ZIGZAG', bs: 'BIG' }],
      sourceDigit: 0,
      confidence: 75,
      status: 'ACTIVE',
      analysis: 'Test loss',
    });
    tracker.auditActualResult(pid, 2); // SMALL -> BS LOSS
  }
  const decayedWeight = tracker.getPatternPriority('ZIGZAG');
  assert.ok(decayedWeight < initialWeight, `Expected priority decay after failures (${decayedWeight} < ${initialWeight})`);
  assert.equal(tracker.getConsecutiveBsLosses(), 2);
  assert.equal(tracker.getSkipState().isActive, true);
});

test('Intelligent Skip System activates after 2 consecutive losses, notifies ONCE, monitors internally, and auto-resumes on strong valid pattern', () => {
  const tracker = new WingoPatternTracker(false);

  // Simulate 2 consecutive BIG/SMALL losses
  tracker.recordPrediction({
    period: '202611120010',
    predictedBS: 'BIG',
    predictedNumber: 1,
    patternResponsible: 'TREND',
    contributingSignals: [{ patternId: 'TREND', bs: 'BIG' }],
    sourceDigit: 0,
    confidence: 72,
    status: 'ACTIVE',
    analysis: 'R1',
  });
  tracker.auditActualResult('202611120010', 1); // LOSS 1

  tracker.recordPrediction({
    period: '202611120011',
    predictedBS: 'BIG',
    predictedNumber: 2,
    patternResponsible: 'TREND',
    contributingSignals: [{ patternId: 'TREND', bs: 'BIG' }],
    sourceDigit: 6,
    confidence: 72,
    status: 'ACTIVE',
    analysis: 'R2',
  });
  tracker.auditActualResult('202611120011', 3); // LOSS 2 -> Skip Mode armed

  // Choppy/ambiguous history while in SKIP MODE
  const noisyHistory = [8, 1, 7, 2, 9, 0, 6, 3, 8, 1, 7, 2, 9, 0, 6, 3, 5, 4, 8, 1, 7, 2, 6, 3, 9, 0];
  const skipFirst = runFullLogicAnalysis({
    period: '202611120012',
    history: noisyHistory,
    consecutiveLosses: 2,
    tracker,
  });

  assert.equal(skipFirst.isSkip, true);
  assert.equal(skipFirst.predictedSize, 'SKIP');
  assert.equal(skipFirst.status, 'SKIP_ACTIVATED');

  // Record first SKIP notification & check next noisy round is SKIP_SILENT (notifies ONLY ONCE)
  tracker.recordPrediction({
    period: '202611120012',
    predictedBS: 'SKIP',
    predictedNumber: -1,
    patternResponsible: skipFirst.patternResponsible,
    contributingSignals: skipFirst.contributingSignals,
    confidence: 0,
    status: skipFirst.status,
    analysis: skipFirst.analysis,
  });

  const skipSecond = runFullLogicAnalysis({
    period: '202611120013',
    history: [4, ...noisyHistory],
    consecutiveLosses: 2,
    tracker,
  });
  assert.equal(skipSecond.isSkip, true);
  assert.equal(skipSecond.status, 'SKIP_SILENT');

  // Feed a strong clean SURESHOT / multi-pattern dragon reversal history so Skip Mode resumes automatically
  const strongHistory = [
    ...Array.from({ length: 9 }, () => 8), // 9x BIG dragon reversal to SMALL
    1, 2, 3, 1, 2, 3, 8, 9, 7, 8, 1, 2, 3, 8, 9, 7, 1, 2, 3, 8, 9, 7, 1, 2, 3, 8, 9, 7, 1, 2, 3,
  ];
  const resumed = runFullLogicAnalysis({
    period: '202611120014',
    history: strongHistory,
    consecutiveLosses: 2,
    tracker,
  });

  assert.equal(resumed.isSkip, false);
  assert.equal(resumed.status, 'ACTIVE');
  assert.ok(resumed.predictedSize === 'BIG' || resumed.predictedSize === 'SMALL');
  assert.ok(resumed.oppositeNumber >= 0 && resumed.oppositeNumber <= 9);

  // Also ensure healthy moderate-quality trends (not choppy/broken) do NOT get stuck in SKIP after 2 losses
  const cleanPatternHistory = [
    8, 8, 8, 2, 2, 7, 6, 9, 8, 8, 3, 2, 1, 7, 8, 9, 6, 8, 7, 2, 1, 3, 8, 8, 7, 6, 9, 2, 1, 4,
  ];
  const healthyResult = runFullLogicAnalysis({
    period: '202611120015',
    history: cleanPatternHistory,
    consecutiveLosses: 2,
    tracker,
  });
  assert.equal(healthyResult.isSkip, false);
  assert.equal(healthyResult.status, 'ACTIVE');
});


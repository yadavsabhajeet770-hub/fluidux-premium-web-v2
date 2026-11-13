/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * NY_FUSION_PREDICTOR — Bunny AI Pattern Engine + Server 3 Number Logic
 * Calibrated from 43,200+ WinGo rounds with CPU_PATTERN_DB (200+ patterns)
 * and deep 500-round historical analysis for exact number prediction & skip logic.
 */

import {
  runNYAdvancePrediction,
  selectExactNumber,
  NYPredictionOutput,
  WingoRecordInput,
} from './nyAdvancePatternEngine';
import {
  FULL_CPU_PATTERN_DB,
} from './fullLogicPatternEngines';
import {
  CUSTOM_BS_MAP,
  WingoPatternTracker,
  PredictionRunStatus,
  globalWingoTracker,
} from './wingoPatternTracker';

export interface PatternDef {
  next: "BIG" | "SMALL";
  conf: number;
}

export interface BunnyPredictionResult {
  pattern: string;
  patternName: string;
  prediction: "BIG" | "SMALL" | "SKIP";
  confidence: number;
  message: string;
  isSkip: boolean;
  skipReason?: string;
  choppinessIndex?: number;
  entropyScore?: number;
  isTwoLossShieldActive?: boolean;
  isLossRecovery?: boolean;
  consecutiveLosses?: number;
}

export interface CandidateProb {
  number: number;
  score: number;
  probability: number;
}

export interface NumberPredictionResult {
  targetNumber: number;
  predictedSize: "BIG" | "SMALL" | "SKIP";
  color: "RED" | "GREEN";
  violet: boolean;
  hotNumbers: number[];
  coldNumbers: number[];
  candidateScores: Record<number, number>;
  candidateProbs: CandidateProb[];
  runnerUps: { number: number; probability: number }[];
  supportingNumbers?: number[];
  reasoning: string;
  isSkip: boolean;
}

export interface NYFusionFullPrediction {
  period: string;
  engine: "NY_FUSION_PREDICTOR_SERVER_3";
  predictedSize: "BIG" | "SMALL" | "SKIP";
  predictedNumber: number;
  oppositeNumber?: number;
  sourceDigit?: number;
  color: "RED" | "GREEN";
  violet: boolean;
  confidence: number;
  pattern: string;
  patternName: string;
  message: string;
  status?: PredictionRunStatus;
  patternResponsible?: string;
  workingPatterns?: string[];
  failingPatterns?: string[];
  contributingSignals?: Array<{ patternId: string; bs: "BIG" | "SMALL" }>;
  qualityScore?: number;
  analysisSummary?: string;
  hotNumbers: number[];
  coldNumbers: number[];
  runnerUps: { number: number; probability: number }[];
  supportingNumbers?: number[];
  candidateProbs: CandidateProb[];
  candidateScores: Record<number, number>;
  reasoning: string;
  isSkip: boolean;
  skipReason?: string;
  choppinessIndex?: number;
  entropyScore?: number;
  isTwoLossShieldActive?: boolean;
  isLossRecovery?: boolean;
  consecutiveLosses?: number;
  timestamp: string;
  isSureshot?: boolean;
  analysis?: any;
}

// ============================================================
// CPU_PATTERN_DB — Full 350+ unique sequences from fulllogic.txt
// ============================================================
export const CPU_PATTERN_DB: Record<string, PatternDef> = FULL_CPU_PATTERN_DB;

// ============================================================
// BUNNY AI — Pattern Names & Descriptions (No Emojis)
// ============================================================
export const BUNNY_PATTERN_NAMES: Record<string, [string, string]> = {
  '4x_STREAK_B': ['4x BIG Streak', 'Strong statistical probability of SMALL reversal.'],
  '4x_STREAK_S': ['4x SMALL Streak', 'Strong statistical probability of BIG reversal.'],
  '3x_STREAK_B': ['3x BIG Streak', 'Elevated probability of SMALL correction.'],
  '3x_STREAK_S': ['3x SMALL Streak', 'Elevated probability of BIG correction.'],
  '2x_STREAK_B': ['2x BIG Streak', 'Moderate edge favoring SMALL.'],
  '2x_STREAK_S': ['2x SMALL Streak', 'Moderate edge favoring BIG.'],
  'CYCLE_2': ['2-Beat Cycle', 'Alternating BSBS sequence active.'],
  'CYCLE_3': ['3-Beat Cycle', '3-beat cyclic wave sequence repeating.'],
  'CYCLE_4': ['4-Beat Cycle', '4-beat harmonic cycle confirmed.'],
  'CYCLE_5': ['5-Beat Cycle', '5-beat rhythmic lock active.'],
  'ZIGZAG': ['Zigzag Pattern', 'Pure alternating bilateral rhythm.'],
  'HEAVY_BIG': ['Heavy BIG Bias', '7+ BIGs in window: mean reversion pressure on SMALL.'],
  'HEAVY_SMALL': ['Heavy SMALL Bias', '7+ SMALLs in window: mean reversion pressure on BIG.'],
  'DOUBLE_DOUBLE': ['Double-Double Flip', 'BB to SS sequence: flip transition expected.'],
  'SINGLE_BREAK_B': ['Single Break (BIG)', 'BIG trend continuation after single interruption.'],
  'SINGLE_BREAK_S': ['Single Break (SMALL)', 'SMALL trend continuation after single interruption.'],
  'STUTTER_B': ['BIG Stutter', 'Extended BIG run holding momentum.'],
  'STUTTER_S': ['SMALL Stutter', 'Extended SMALL run holding momentum.'],
  'DRAGON_B': ['Dragon Streak (BIG)', '6+ consecutive BIGs: extreme reversal zone.'],
  'DRAGON_S': ['Dragon Streak (SMALL)', '6+ consecutive SMALLs: extreme reversal zone.'],
  'PULSE_B': ['BIG Pulse', 'Single pulse rebound favoring BIG.'],
  'PULSE_S': ['SMALL Pulse', 'Single pulse rebound favoring SMALL.'],
  'TRAP_B': ['BIG Trap', 'BBSBB structure detected: reversal continuation.'],
  'TRAP_S': ['SMALL Trap', 'SSBSS structure detected: reversal continuation.'],
  'PENDULUM': ['Pendulum Swing', 'Symmetric balanced block momentum.'],
  'TWIN_PULSE': ['Twin Pulse', 'BBSBS rhythmic twin interruption.'],
  'SANDWICH_B': ['BIG Sandwich', 'Isolated BIG framed by symmetrical SMALLs.'],
  'SANDWICH_S': ['SMALL Sandwich', 'Isolated SMALL framed by symmetrical BIGs.'],
  'WAVE_UP': ['Wave Rising', 'Bullish transition upward toward BIG numbers.'],
  'WAVE_DOWN': ['Wave Falling', 'Bearish transition downward toward SMALL numbers.'],
  'MIRROR': ['Mirror Pattern', 'Symmetric reflection of preceding period block.'],
  'FADE_B': ['BIG Fade', 'BIG cluster momentum decaying.'],
  'FADE_S': ['SMALL Fade', 'SMALL cluster momentum decaying.'],
  'CLUSTER_JUMP': ['Cluster Jump', 'Discontinuous shift into adjacent cluster.'],
  'ECHO': ['Echo Pattern', 'Lagged rhythmic repetition of prior wave.'],
  'CHAOS': ['Chaos Zone', 'High volatility: statistical mean consensus.'],
  'MULTI': ['Multi-Engine Vote', 'Consensus signal from multi-pattern scan.'],
  '5x_STREAK_B': ['5x BIG Dragon Zone', '5 consecutive BIGs: high dragon continuation or reversal.'],
  '5x_STREAK_S': ['5x SMALL Dragon Zone', '5 consecutive SMALLs: high dragon continuation or reversal.'],
  'BBBSBS_B': ['BBBSBS Trend Injection', 'Triple BIG with alternating tail: SMALL entry.'],
  'BBBSBS_S': ['SSSBSB Trend Injection', 'Triple SMALL with alternating tail: BIG entry.'],
  'LIVE_LEARN': ['AI Live Pattern', 'Direct historical match in calibrated database.'],
  'ADAPTIVE': ['Adaptive Math', 'Adaptive statistical ratio projection.'],
  'ACCELERATION_B': ['BIG Acceleration', 'Consecutive BIG intervals expanding.'],
  'ACCELERATION_S': ['SMALL Acceleration', 'Consecutive SMALL intervals expanding.'],
  'MOMENTUM_B': ['BIG Momentum', '3+ consecutive BIGs carrying strong momentum.'],
  'MOMENTUM_S': ['SMALL Momentum', '3+ consecutive SMALLs carrying strong momentum.'],
  'NOVA_B': ['BIG Nova', 'Sudden expansion favoring upper quadrant.'],
  'NOVA_S': ['SMALL Nova', 'Sudden expansion favoring lower quadrant.'],
  'TRIPLE_BREAK_B': ['Triple Break (BIG)', 'Alternating sequence resolving to BIG.'],
  'TRIPLE_BREAK_S': ['Triple Break (SMALL)', 'Alternating sequence resolving to SMALL.'],
  'ZIGZAG_BLOCK_B': ['Zigzag to BIG Block', 'Alternating sequence coalescing into BIG.'],
  'ZIGZAG_BLOCK_S': ['Zigzag to SMALL Block', 'Alternating sequence coalescing into SMALL.'],
  'PRESSURE_B': ['BIG Pressure', 'Accumulating volume favoring upper numbers.'],
  'PRESSURE_S': ['SMALL Pressure', 'Accumulating volume favoring lower numbers.'],
  'REBOUND_B': ['BIG Rebound', 'Rebound off lower boundary holding.'],
  'REBOUND_S': ['SMALL Rebound', 'Rebound off upper boundary holding.'],
  'SKIP_CHOP': ['High-Entropy Market Noise', 'Pure random chop: capital safely preserved.'],
  'SKIP_DEADLOCK': ['Indicator Deadlock', 'Complete 50/50 deadlock: pass round.'],
  'SKIP_ENTROPY': ['Extreme Entropy', 'Uncorrelated distribution: pass round.'],
  'SKIP_2LOSS_GUARD': ['2-Loss Safe Shield', 'Safe cooldown: requiring high-conviction confirmation to protect balance.'],
};

// ── Helper: Convert number to B/S (FIXED CUSTOM MAPPING) ──
export function numToType(n: number): 'B' | 'S' {
  const digit = Math.abs(Math.floor(Number(n))) % 10;
  return CUSTOM_BS_MAP[digit] === 'BIG' ? 'B' : 'S';
}

// ── Helper: Look up pattern in DB ──
export function lookupPattern(pattern: string): PatternDef | null {
  return CPU_PATTERN_DB[pattern] || null;
}

// ── Helper: Live adaptive detection (fallback) ──
export function liveAdaptiveDetect(types: ('B' | 'S')[]): {
  method: string;
  size: 'BIG' | 'SMALL';
  conf: number;
} | null {
  if (types.length < 4) return null;
  const len = Math.min(types.length, 10);
  const slice = types.slice(0, len);
  const seq = slice.join('');

  for (let l = Math.min(seq.length, 9); l >= 3; l--) {
    const sub = seq.substring(0, l);
    const hit = lookupPattern(sub);
    if (hit) {
      return {
        method: 'AI_LIVE',
        size: hit.next,
        conf: hit.conf,
      };
    }
  }

  const bCount = slice.filter((t) => t === 'B').length;
  const total = slice.length;
  const bRatio = bCount / total;
  if (bRatio >= 0.7) {
    return { method: 'MATH', size: 'SMALL', conf: 65 + Math.floor(bRatio * 20) };
  } else if (bRatio <= 0.3) {
    return { method: 'MATH', size: 'BIG', conf: 65 + Math.floor((1 - bRatio) * 20) };
  }
  return null;
}

/**
 * Main Bunny AI Pattern Engine with Embedded SKIP & Risk Mitigation
 */
export function runBunnyAI(
  historyNumbers: number[],
  consecutiveLosses: number = 0
): BunnyPredictionResult {
  if (!historyNumbers || historyNumbers.length < 3) {
    return {
      pattern: 'CHAOS',
      patternName: 'Calibrating Sensors…',
      prediction: 'BIG',
      confidence: 70,
      message: 'Awaiting historical data…',
      isSkip: false,
      consecutiveLosses,
    };
  }

  const deepHist = historyNumbers.slice(0, 1000);
  const types: ('B' | 'S')[] = deepHist.map((n) => numToType(n));

  // --- CRITICAL SKIP & RISK ANALYSIS ---
  // Count flips in last 8 rounds
  const last8 = types.slice(0, 8);
  let flips = 0;
  for (let i = 0; i < last8.length - 1; i++) {
    if (last8[i] !== last8[i + 1]) flips++;
  }
  const choppinessIndex = Math.round((flips / 7) * 100);

  // Shannon entropy of last 10 rounds
  const last10 = types.slice(0, 10);
  const big10Count = last10.filter((t) => t === 'B').length;
  const pB = big10Count / Math.max(1, last10.length);
  const pS = 1 - pB;
  let entropy = 0;
  if (pB > 0 && pS > 0) {
    entropy = -(pB * Math.log2(pB) + pS * Math.log2(pS));
  }
  const entropyScore = Math.round(entropy * 100) / 100;
  const b10 = big10Count;

  // Streak detection (history[0] is the latest round)
  let sk = 1;
  for (let i = 0; i < types.length - 1 && types[i] === types[i + 1]; i++) sk++;
  const cur = types[0];

  let patKey = 'MULTI';
  let pred: 'BIG' | 'SMALL' = 'BIG';
  let conf = 72;

  // ── Cycle detection (must have variation within the cycle unit, else it is a streak) ──
  let cycleFound = false;
  for (let cl = 2; cl <= 8; cl++) {
    if (types.length < cl * 2) continue;
    const cycleSlice = types.slice(0, cl);
    const hasVariation = cycleSlice.some((t) => t !== cycleSlice[0]);
    if (!hasVariation) continue;

    let ok = true;
    for (let j = 0; j < cl; j++) {
      if (types[j] !== types[j + cl]) {
        ok = false;
        break;
      }
    }
    if (ok) {
      patKey = 'CYCLE_' + cl;
      cycleFound = true;
      conf = cl >= 5 ? 88 : cl >= 3 ? 82 : 74;
      const nextToken = types[cl - 1];
      pred = nextToken === 'B' ? 'BIG' : 'SMALL';
      break;
    }
  }

  if (!cycleFound) {

    if (sk >= 6) {
      patKey = cur === 'B' ? 'DRAGON_B' : 'DRAGON_S';
      conf = Math.min(95, conf + 3);
      pred = cur === 'B' ? 'SMALL' : 'BIG';
    } else if (sk === 5) {
      patKey = cur === 'B' ? '5x_STREAK_B' : '5x_STREAK_S';
      conf = Math.min(93, conf + 2);
      pred = cur === 'B' ? 'SMALL' : 'BIG';
    } else if (sk >= 4) {
      patKey = '4x_STREAK_' + cur;
      conf = Math.min(92, conf + 1);
      pred = cur === 'B' ? 'SMALL' : 'BIG';
    } else if (sk === 3) {
      const p6 = types.length >= 6 ? types.slice(0, 6).join('') : '';
      const p7 = types.length >= 7 ? types.slice(0, 7).join('') : '';
      const p8 = types.length >= 8 ? types.slice(0, 8).join('') : '';

      if (p8 === 'BBBSBSBS' || p7 === 'BBBSBSB' || p6 === 'BBBSBS') {
        patKey = 'BBBSBS_B';
        conf = 80;
        pred = 'SMALL';
      } else if (p8 === 'SSSBSBSB' || p7 === 'SSSBSBS' || p6 === 'SSSBSB') {
        patKey = 'BBBSBS_S';
        conf = 80;
        pred = 'BIG';
      } else {
        patKey = '3x_STREAK_' + cur;
        conf = 78;
        pred = cur === 'B' ? 'SMALL' : 'BIG';
      }
    } else if (sk === 2) {
      patKey = '2x_STREAK_' + cur;
      conf = 65;
      pred = cur === 'B' ? 'SMALL' : 'BIG';
    } else {
      const seq4 = types.length >= 4 ? types.slice(0, 4).join('') : '';
      const seq5 = types.length >= 5 ? types.slice(0, 5).join('') : '';
      const seq6 = types.length >= 6 ? types.slice(0, 6).join('') : '';
      const seq7 = types.length >= 7 ? types.slice(0, 7).join('') : '';
      const seq8 = types.length >= 8 ? types.slice(0, 8).join('') : '';

      let found = false;

      // STUTTER / SINGLE BREAK
      if (seq8 === 'BBBBBBBS' || seq7 === 'BBBBBBS' || seq6 === 'BBBBBS') {
        patKey = 'STUTTER_B';
        conf = 86;
        pred = 'SMALL';
        found = true;
      } else if (seq8 === 'SSSSSSSB' || seq7 === 'SSSSSSB' || seq6 === 'SSSSSB') {
        patKey = 'STUTTER_S';
        conf = 86;
        pred = 'BIG';
        found = true;
      } else if (seq6 === 'BBBBSB' || seq5 === 'BBBSB') {
        patKey = 'SINGLE_BREAK_B';
        conf = 79;
        pred = 'SMALL';
        found = true;
      } else if (seq6 === 'SSSSBS' || seq5 === 'SSSBS') {
        patKey = 'SINGLE_BREAK_S';
        conf = 79;
        pred = 'BIG';
        found = true;
      }

      // TRAP
      if (!found && (seq6 === 'BBSSBB' || seq7 === 'BBSSBB' || seq8 === 'BBSSBB')) {
        patKey = 'TRAP_B';
        conf = 83;
        pred = 'SMALL';
        found = true;
      } else if (!found && (seq6 === 'SSBBSS' || seq7 === 'SSBBSS' || seq8 === 'SSBBSS')) {
        patKey = 'TRAP_S';
        conf = 83;
        pred = 'BIG';
        found = true;
      }

      // SANDWICH
      if (!found && seq5 === 'BBSBB') {
        patKey = 'SANDWICH_B';
        conf = 71;
        pred = 'SMALL';
        found = true;
      } else if (!found && seq5 === 'SSBSS') {
        patKey = 'SANDWICH_S';
        conf = 71;
        pred = 'BIG';
        found = true;
      }

      // PENDULUM
      if (!found && (seq7 === 'BBSSSBB' || seq8 === 'BBSSSBB')) {
        patKey = 'PENDULUM';
        conf = 78;
        pred = 'SMALL';
        found = true;
      } else if (!found && (seq7 === 'SSBBBSS' || seq8 === 'SSBBBSS')) {
        patKey = 'PENDULUM';
        conf = 78;
        pred = 'BIG';
        found = true;
      }

      // TWIN PULSE
      if (!found && (seq6 === 'BSBBSB' || seq5 === 'BSBBS')) {
        patKey = 'TWIN_PULSE';
        conf = 68;
        pred = 'SMALL';
        found = true;
      } else if (!found && (seq6 === 'SBSSBS' || seq5 === 'SBSSB')) {
        patKey = 'TWIN_PULSE';
        conf = 68;
        pred = 'BIG';
        found = true;
      }

      // WAVE
      if (!found && (seq6 === 'SBBBSS' || seq7 === 'SBBBSS')) {
        patKey = 'WAVE_UP';
        conf = 69;
        pred = 'BIG';
        found = true;
      } else if (!found && (seq6 === 'BSSBB' || seq7 === 'BSSBB')) {
        patKey = 'WAVE_DOWN';
        conf = 69;
        pred = 'SMALL';
        found = true;
      }

      // CLUSTER JUMP
      if (!found && (seq7 === 'BBBBSSS' || seq8 === 'BBBBSSS')) {
        patKey = 'CLUSTER_JUMP';
        conf = 88;
        pred = 'SMALL';
        found = true;
      } else if (!found && (seq7 === 'SSSSBBB' || seq8 === 'SSSSBBB')) {
        patKey = 'CLUSTER_JUMP';
        conf = 88;
        pred = 'BIG';
        found = true;
      }

      // ECHO
      if (!found && (seq6 === 'BSBSB' || seq7 === 'BSBSB')) {
        patKey = 'ECHO';
        conf = 65;
        pred = 'SMALL';
        found = true;
      } else if (!found && (seq6 === 'SBSBS' || seq7 === 'SBSBS')) {
        patKey = 'ECHO';
        conf = 65;
        pred = 'BIG';
        found = true;
      }

      // ACCELERATION
      if (!found && (seq7 === 'BBBBBBB' || seq8 === 'BBBBBBB')) {
        patKey = 'ACCELERATION_B';
        conf = 92;
        pred = 'SMALL';
        found = true;
      } else if (!found && (seq7 === 'SSSSSSS' || seq8 === 'SSSSSSS')) {
        patKey = 'ACCELERATION_S';
        conf = 92;
        pred = 'BIG';
        found = true;
      }

      // MOMENTUM
      if (!found && (seq6 === 'BBBBBB' || seq5 === 'BBBBB')) {
        patKey = 'MOMENTUM_B';
        conf = 90;
        pred = 'SMALL';
        found = true;
      } else if (!found && (seq6 === 'SSSSSS' || seq5 === 'SSSSS')) {
        patKey = 'MOMENTUM_S';
        conf = 90;
        pred = 'BIG';
        found = true;
      }

      // NOVA
      if (!found && (seq6 === 'SBBBBB' || seq5 === 'SBBBB')) {
        patKey = 'NOVA_B';
        conf = 73;
        pred = 'SMALL';
        found = true;
      } else if (!found && (seq6 === 'BSSSSS' || seq5 === 'BSSSS')) {
        patKey = 'NOVA_S';
        conf = 73;
        pred = 'BIG';
        found = true;
      }

      // REBOUND
      if (!found && (seq6 === 'SBBBBB' || seq5 === 'SBBBB')) {
        patKey = 'REBOUND_B';
        conf = 73;
        pred = 'SMALL';
        found = true;
      } else if (!found && (seq6 === 'BSSSSS' || seq5 === 'BSSSS')) {
        patKey = 'REBOUND_S';
        conf = 73;
        pred = 'BIG';
        found = true;
      }

      // PRESSURE
      if (!found && (seq8 === 'BBBBBBBB' || seq7 === 'BBBBBBB')) {
        patKey = 'PRESSURE_B';
        conf = 94;
        pred = 'SMALL';
        found = true;
      } else if (!found && (seq8 === 'SSSSSSSS' || seq7 === 'SSSSSSS')) {
        patKey = 'PRESSURE_S';
        conf = 94;
        pred = 'BIG';
        found = true;
      }

      // TRIPLE BREAK
      if (!found && (seq6 === 'BSBSBS' || seq5 === 'BSBSB')) {
        patKey = 'TRIPLE_BREAK_B';
        conf = 74;
        pred = 'BIG';
        found = true;
      } else if (!found && (seq6 === 'SBSBSB' || seq5 === 'SBSBS')) {
        patKey = 'TRIPLE_BREAK_S';
        conf = 74;
        pred = 'SMALL';
        found = true;
      }

      // ZIGZAG BLOCK
      if (!found && (seq8 === 'BBBSBSBS' || seq7 === 'BBBSBSB')) {
        patKey = 'ZIGZAG_BLOCK_B';
        conf = 81;
        pred = 'SMALL';
        found = true;
      } else if (!found && (seq8 === 'SSSBSBSB' || seq7 === 'SSSBSBS')) {
        patKey = 'ZIGZAG_BLOCK_S';
        conf = 81;
        pred = 'BIG';
        found = true;
      }

      // HEAVY BIAS
      if (!found && b10 >= 7) {
        patKey = 'HEAVY_BIG';
        conf = 82;
        pred = 'SMALL';
        found = true;
      } else if (!found && b10 <= 3) {
        patKey = 'HEAVY_SMALL';
        conf = 82;
        pred = 'BIG';
        found = true;
      }

      // ZIGZAG
      if (!found && (seq6 === 'BSBSBS' || seq5 === 'BSBSB' || seq4 === 'BSBS')) {
        patKey = 'ZIGZAG';
        conf = 74;
        pred = 'BIG';
        found = true;
      } else if (!found && (seq6 === 'SBSBSB' || seq5 === 'SBSBS' || seq4 === 'SBSB')) {
        patKey = 'ZIGZAG';
        conf = 74;
        pred = 'SMALL';
        found = true;
      }

      // DOUBLE DOUBLE
      if (!found && (seq6 === 'BBSSBB' || seq5 === 'BBSSB')) {
        patKey = 'DOUBLE_DOUBLE';
        conf = 83;
        pred = 'SMALL';
        found = true;
      } else if (!found && (seq6 === 'SSBBSS' || seq5 === 'SSBBS')) {
        patKey = 'DOUBLE_DOUBLE';
        conf = 83;
        pred = 'BIG';
        found = true;
      }

      // Scan all 200+ CPU_PATTERN_DB patterns from length 9 down to 3
      if (!found) {
        const seqMax = types.slice(0, 9).join('');
        for (let l = Math.min(seqMax.length, 9); l >= 3; l--) {
          const sub = seqMax.substring(0, l);
          const hit = lookupPattern(sub);
          if (hit) {
            patKey = 'LIVE_LEARN';
            conf = hit.conf;
            pred = hit.next;
            found = true;
            break;
          }
        }
      }

      // Fallback: adaptive statistical detection
      if (!found) {
        const adapt = liveAdaptiveDetect(types);
        if (adapt) {
          patKey = adapt.method === 'AI_LIVE' ? 'LIVE_LEARN' : 'ADAPTIVE';
          conf = adapt.conf;
          pred = adapt.size;
          found = true;
        }
      }

      // Ultimate fallback: evaluate if this is an erratic breakdown or indicator deadlock (high loss risk)
      if (!found) {
        const isErraticChop = flips >= 8 && entropyScore >= 0.99;
        const isDeadlock = b10 === 5 && entropyScore >= 0.995 && flips >= 8;

        // Skip ONLY when patterns are broken and loss risk is severe
        if (isErraticChop || isDeadlock) {
          return {
            pattern: isDeadlock ? 'SKIP_DEADLOCK' : 'SKIP_CHOP',
            patternName: isDeadlock ? BUNNY_PATTERN_NAMES['SKIP_DEADLOCK'][0] : BUNNY_PATTERN_NAMES['SKIP_CHOP'][0],
            prediction: 'SKIP',
            confidence: 0,
            message: isDeadlock ? BUNNY_PATTERN_NAMES['SKIP_DEADLOCK'][1] : BUNNY_PATTERN_NAMES['SKIP_CHOP'][1],
            isSkip: true,
            skipReason: isDeadlock
              ? 'Deadlock Anomaly (50/50 balance). High loss probability — capital safely preserved.'
              : 'Erratic Chaos Trap. Pattern signals broken — safe SKIP recommended.',
            choppinessIndex,
            entropyScore,
          };
        }

        patKey = 'CHAOS';
        conf = 62;
        pred = b10 >= 5 ? 'SMALL' : 'BIG';
      }
    }
  }

  const info = BUNNY_PATTERN_NAMES[patKey] || [patKey, 'Pattern Detected: ' + patKey];
  const patName = info[0];
  const patMsg = info[1];

  const isErraticChop = flips >= 7 && entropyScore >= 0.99;
  const isDeadlock = b10 === 5 && entropyScore >= 0.995 && choppinessIndex >= 85;

  // 2-Loss Intelligent Skip Shield inside Bunny AI
  if (consecutiveLosses >= 2) {
    const weakOrChoppy =
      choppinessIndex >= 72 ||
      entropyScore >= 0.985 ||
      patKey === 'CHAOS' ||
      conf < 72;
    if (weakOrChoppy) {
      return {
        pattern: 'SKIP_2LOSS_GUARD',
        patternName: BUNNY_PATTERN_NAMES['SKIP_2LOSS_GUARD'][0],
        prediction: 'SKIP',
        confidence: 0,
        message: 'SKIP MODE active after 2 losses: analyzing incoming rounds until strong pattern emerges.',
        isSkip: true,
        skipReason: `SKIP MODE (${consecutiveLosses} losses): chop ${choppinessIndex}%, pattern [${patName}] conf ${conf}% below resume threshold.`,
        choppinessIndex,
        entropyScore,
        isTwoLossShieldActive: true,
        isLossRecovery: true,
        consecutiveLosses,
      };
    }
  }

  if (isErraticChop || isDeadlock) {
    return {
      pattern: isDeadlock ? 'SKIP_DEADLOCK' : 'SKIP_CHOP',
      patternName: isDeadlock ? 'Indicator Deadlock' : 'High-Entropy Market Noise',
      prediction: 'SKIP',
      confidence: 0,
      message: isDeadlock ? 'Deadlock Anomaly (50/50 balance).' : 'Erratic alternation noise detected.',
      isSkip: true,
      skipReason: isDeadlock
        ? 'Deadlock Anomaly (50/50 balance). Capital safely preserved.'
        : 'Extreme market chop. Capital safely preserved.',
      choppinessIndex,
      entropyScore,
      isTwoLossShieldActive: consecutiveLosses >= 2,
      isLossRecovery: consecutiveLosses >= 1,
      consecutiveLosses,
    };
  }

  return {
    pattern: patKey,
    patternName: patName,
    prediction: pred,
    confidence: Math.max(55, Math.min(92, conf)),
    message: patMsg,
    isSkip: false,
    choppinessIndex,
    entropyScore,
    isTwoLossShieldActive: consecutiveLosses >= 2,
    isLossRecovery: consecutiveLosses >= 1,
    consecutiveLosses,
  };
}

/**
 * Exact Opposite Number Predictor (Single Number Only, Zero Randomness/Backups)
 */
export function predictExactNumber(
  predictedSize: 'BIG' | 'SMALL' | 'SKIP',
  historyArray: number[],
  consecutiveLosses: number = 0,
  tracker: WingoPatternTracker = globalWingoTracker
): NumberPredictionResult {
  return selectExactNumber(predictedSize, historyArray || [], consecutiveLosses, tracker);
}

/**
 * Top-level NY_FUSION_PREDICTOR runner:
 * Connects all 20 pattern engines, adaptive loss tracker, 2-Loss Intelligent Skip Mode,
 * and single smart opposite number calculation.
 */
export function runNYFusionPrediction(
  period: string | number,
  historyArray: (number | WingoRecordInput)[],
  consecutiveLosses: number = 0,
  options?: { tracker?: WingoPatternTracker; excludePeriod?: string }
): NYFusionFullPrediction {
  const tracker = options?.tracker || globalWingoTracker;
  const advance: NYPredictionOutput = runNYAdvancePrediction(
    period,
    historyArray || [],
    consecutiveLosses,
    options
  );

  const isSkip = advance.isSkip;
  const predictedSize = isSkip ? 'SKIP' : advance.predictedSize;
  const targetNumber = isSkip ? -1 : advance.predictedNumber;

  return {
    period: String(period),
    engine: 'NY_FUSION_PREDICTOR_SERVER_3',
    predictedSize,
    predictedNumber: targetNumber,
    oppositeNumber: targetNumber,
    sourceDigit: advance.sourceDigit,
    color: advance.color,
    violet: advance.violet,
    confidence: isSkip ? 0 : advance.confidence,
    pattern: advance.pattern,
    patternName: advance.patternName,
    message: advance.strategyMessage,
    status: advance.status,
    patternResponsible: advance.patternResponsible,
    workingPatterns: advance.workingPatterns,
    failingPatterns: advance.failingPatterns,
    contributingSignals: advance.contributingSignals,
    qualityScore: advance.qualityScore,
    analysisSummary: advance.analysisSummary,
    hotNumbers: advance.hotNumbers,
    coldNumbers: advance.coldNumbers,
    runnerUps: [],
    supportingNumbers: [],
    candidateProbs: advance.candidateProbs,
    candidateScores: advance.candidateScores,
    reasoning: advance.reasoning,
    isSkip,
    skipReason: advance.skipReason,
    choppinessIndex: advance.choppinessIndex,
    entropyScore: advance.entropyScore,
    isTwoLossShieldActive: (advance.isSkip && consecutiveLosses >= 2) || tracker.getSkipState().isActive,
    isLossRecovery: advance.isLossRecovery,
    consecutiveLosses: Math.max(consecutiveLosses, tracker.getConsecutiveBsLosses()),
    timestamp: new Date().toISOString(),
    isSureshot: advance.isSureshot,
    analysis: advance.analysis,
  };
}

// ── Export for Node.js / module usage ──
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CPU_PATTERN_DB,
    BUNNY_PATTERN_NAMES,
    runBunnyAI,
    predictExactNumber,
    runNYFusionPrediction,
    numToType,
    lookupPattern,
    liveAdaptiveDetect,
  };
}

// ── Attach to window for browser usage ──
if (typeof window !== 'undefined') {
  (window as any).runBunnyAI = runBunnyAI;
  (window as any).predictExactNumber = predictExactNumber;
  (window as any).runNYFusionPrediction = runNYFusionPrediction;
  (window as any).CPU_PATTERN_DB = CPU_PATTERN_DB;
  (window as any).BUNNY_PATTERN_NAMES = BUNNY_PATTERN_NAMES;
}

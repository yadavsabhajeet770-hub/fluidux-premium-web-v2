/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * WINGO PATTERN TRACKER, LOSS AUDITOR & INTELLIGENT SKIP STATE ENGINE
 * - Fixed Custom BIG/SMALL & Exact Opposite Number Mappings
 * - Separate BIG/SMALL vs Exact Number Win/Loss Auditing
 * - Adaptive Pattern Priority Weighting (penalizes repeatedly failing patterns)
 * - Anti-Glitch Period Lock & Recalculation Cache
 * - Intelligent 2-Loss Skip Mode (notifies once on activation, silent thereafter until strong pattern resumes)
 */

export const CUSTOM_BS_MAP: Record<number, 'BIG' | 'SMALL'> = {
  0: 'BIG',
  1: 'SMALL',
  2: 'SMALL',
  3: 'BIG',
  4: 'SMALL',
  5: 'BIG',
  6: 'BIG',
  7: 'SMALL',
  8: 'SMALL',
  9: 'BIG',
};

export const CUSTOM_OPPOSITE_NUM_MAP: Record<number, number> = {
  0: 1,
  1: 7,
  2: 6,
  3: 3,
  4: 8,
  5: 1,
  6: 2,
  7: 9,
  8: 8,
  9: 2,
};

export function customBsOf(n: number): 'BIG' | 'SMALL' {
  const digit = ((Math.abs(Math.floor(n)) % 10) + 10) % 10;
  return CUSTOM_BS_MAP[digit];
}

export function customOppositeNumOf(n: number): number {
  const digit = ((Math.abs(Math.floor(n)) % 10) + 10) % 10;
  return CUSTOM_OPPOSITE_NUM_MAP[digit];
}

export function getCustomMappedPair(digit: number): {
  digit: number;
  bs: 'BIG' | 'SMALL';
  oppositeNumber: number;
  formatLabel: string;
} {
  const norm = ((Math.abs(Math.floor(digit)) % 10) + 10) % 10;
  const bs = CUSTOM_BS_MAP[norm];
  const oppositeNumber = CUSTOM_OPPOSITE_NUM_MAP[norm];
  return {
    digit: norm,
    bs,
    oppositeNumber,
    formatLabel: `${bs} ${oppositeNumber}`,
  };
}

export type PredictionRunStatus = 'ACTIVE' | 'SKIP_ACTIVATED' | 'SKIP_SILENT';

export interface PatternPerformanceRecord {
  patternId: string;
  wins: number;
  losses: number;
  bsWins: number;
  bsLosses: number;
  numWins: number;
  numLosses: number;
  consecutiveFailures: number;
  recentOutcomes: Array<'W' | 'L'>;
  priorityWeight: number;
  lastUpdated: string;
}

export interface PredictionAuditRecord {
  period: string;
  predictedBS: 'BIG' | 'SMALL' | 'SKIP';
  predictedNumber: number;
  actualNumber: number | null;
  actualBS: 'BIG' | 'SMALL' | null;
  bsResult: 'WIN' | 'LOSS' | 'SKIP' | 'PENDING';
  numberResult: 'WIN' | 'LOSS' | 'SKIP' | 'PENDING';
  combinedResult: 'BOTH_WIN' | 'BS_WIN' | 'NUM_WIN' | 'LOSS' | 'SKIP' | 'PENDING';
  patternResponsible: string;
  failingPatterns: string[];
  contributingSignals: Array<{ patternId: string; bs: 'BIG' | 'SMALL' }>;
  sourceDigit?: number;
  confidence: number;
  status: PredictionRunStatus;
  analysis: string;
  timestamp: string;
}

export interface NumberMappingPerf {
  digit: number;
  hits: number;
  misses: number;
  recentHits: Array<0 | 1>;
}

export interface SkipModeState {
  isActive: boolean;
  hasNotifiedActivation: boolean;
  consecutiveBsLosses: number;
  activatedAtPeriod: string | null;
  lastEvaluatedPeriod: string | null;
  roundsMonitoredInSkip: number;
  resumedAtPeriod: string | null;
  lastResumeQualityScore: number;
}

export interface WingoTrackerSnapshot {
  version: number;
  patternStats: Record<string, PatternPerformanceRecord>;
  numberMappingStats: Record<number, NumberMappingPerf>;
  audits: PredictionAuditRecord[];
  skipState: SkipModeState;
  lastDataSignature: string;
}

const STORAGE_KEY = 'cyrus_full_logic_tracker_v1';

function createDefaultSnapshot(): WingoTrackerSnapshot {
  const numberMappingStats: Record<number, NumberMappingPerf> = {};
  for (let d = 0; d <= 9; d++) {
    numberMappingStats[d] = { digit: d, hits: 0, misses: 0, recentHits: [] };
  }
  return {
    version: 1,
    patternStats: {},
    numberMappingStats,
    audits: [],
    skipState: {
      isActive: false,
      hasNotifiedActivation: false,
      consecutiveBsLosses: 0,
      activatedAtPeriod: null,
      lastEvaluatedPeriod: null,
      roundsMonitoredInSkip: 0,
      resumedAtPeriod: null,
      lastResumeQualityScore: 0,
    },
    lastDataSignature: '',
  };
}

export class WingoPatternTracker {
  private state: WingoTrackerSnapshot;
  private persistEnabled: boolean;

  constructor(persistEnabled = true) {
    this.persistEnabled = persistEnabled;
    this.state = this.loadState();
  }

  private loadState(): WingoTrackerSnapshot {
    if (this.persistEnabled && typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as WingoTrackerSnapshot;
          if (parsed && typeof parsed === 'object' && parsed.skipState) {
            return {
              ...createDefaultSnapshot(),
              ...parsed,
              skipState: {
                ...createDefaultSnapshot().skipState,
                ...parsed.skipState,
              },
            };
          }
        }
      } catch {
        // fallback cleanly
      }
    }
    return createDefaultSnapshot();
  }

  private saveState(): void {
    this.state.version += 1;
    if (this.persistEnabled && typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch {
        // ignore quota issues
      }
    }
  }

  public reset(): void {
    this.state = createDefaultSnapshot();
    this.saveState();
  }

  public getSnapshot(): WingoTrackerSnapshot {
    return this.state;
  }

  public getPatternPriority(patternId: string): number {
    const rec = this.state.patternStats[patternId];
    if (!rec) return 1.0;
    return rec.priorityWeight;
  }

  public getPatternRecord(patternId: string): PatternPerformanceRecord | null {
    return this.state.patternStats[patternId] || null;
  }

  public getNumberMappingHitRate(digit: number): number {
    const norm = ((digit % 10) + 10) % 10;
    const rec = this.state.numberMappingStats[norm];
    if (!rec) return 0.1;
    const total = rec.hits + rec.misses;
    if (total === 0) return 0.1;
    // Smoothed empirical exact-hit rate (Laplace with baseline 10%)
    return (rec.hits + 0.5) / (total + 5);
  }

  public getSkipState(): SkipModeState {
    return { ...this.state.skipState };
  }

  public getConsecutiveBsLosses(): number {
    return this.state.skipState.consecutiveBsLosses;
  }

  /**
   * Anti-Glitch Guard: Checks whether a prediction already exists for this period
   * and has not been audited yet, or was already locked.
   */
  public getExistingPredictionForPeriod(period: string): PredictionAuditRecord | null {
    return this.state.audits.find((a) => a.period === period) || null;
  }

  public canLockPrediction(period: string): boolean {
    const existing = this.getExistingPredictionForPeriod(period);
    if (!existing) return true;
    // Never overwrite a PENDING or COMPLETED prediction for the same period
    return false;
  }

  /**
   * Records a generated prediction (PENDING or SKIP) into the audit log.
   * Rejects overwriting an existing non-discarded period prediction.
   */
  public recordPrediction(params: {
    period: string;
    predictedBS: 'BIG' | 'SMALL' | 'SKIP';
    predictedNumber: number;
    patternResponsible: string;
    contributingSignals: Array<{ patternId: string; bs: 'BIG' | 'SMALL' }>;
    sourceDigit?: number;
    confidence: number;
    status: PredictionRunStatus;
    analysis: string;
  }): PredictionAuditRecord {
    const existing = this.getExistingPredictionForPeriod(params.period);
    if (existing) {
      return existing;
    }

    const isSkip = params.predictedBS === 'SKIP';
    const record: PredictionAuditRecord = {
      period: params.period,
      predictedBS: params.predictedBS,
      predictedNumber: params.predictedNumber,
      actualNumber: null,
      actualBS: null,
      bsResult: isSkip ? 'SKIP' : 'PENDING',
      numberResult: isSkip ? 'SKIP' : 'PENDING',
      combinedResult: isSkip ? 'SKIP' : 'PENDING',
      patternResponsible: params.patternResponsible,
      failingPatterns: [],
      contributingSignals: params.contributingSignals,
      sourceDigit: params.sourceDigit,
      confidence: params.confidence,
      status: params.status,
      analysis: params.analysis,
      timestamp: new Date().toISOString(),
    };

    if (params.status === 'SKIP_ACTIVATED') {
      this.state.skipState.hasNotifiedActivation = true;
      if (this.state.skipState.consecutiveBsLosses >= 2) {
        this.state.skipState.isActive = true;
        if (!this.state.skipState.activatedAtPeriod) {
          this.state.skipState.activatedAtPeriod = params.period;
        }
      }
    }

    if (isSkip && this.state.skipState.isActive) {
      this.state.skipState.roundsMonitoredInSkip += 1;
    }

    this.state.audits.unshift(record);
    this.state.audits = this.state.audits.slice(0, 200);
    this.saveState();
    return record;
  }

  /**
   * Synchronizes external consecutive loss count into tracker skip state
   * if external history has more losses tracked (e.g., first boot from existing UserData).
   */
  public syncExternalLossCount(externalConsecutiveLosses: number): void {
    if (externalConsecutiveLosses >= 2 && !this.state.skipState.isActive) {
      this.state.skipState.isActive = true;
      this.state.skipState.consecutiveBsLosses = Math.max(
        this.state.skipState.consecutiveBsLosses,
        externalConsecutiveLosses
      );
      this.saveState();
    } else if (externalConsecutiveLosses === 0 && this.state.skipState.isActive && this.state.audits.length === 0) {
      this.state.skipState.isActive = false;
      this.state.skipState.hasNotifiedActivation = false;
      this.state.skipState.consecutiveBsLosses = 0;
      this.saveState();
    }
  }

  /**
   * Marks the Skip Mode activation toast as displayed so repeated SKIP messages never occur.
   */
  public markSkipActivatedNotified(period: string): void {
    this.state.skipState.hasNotifiedActivation = true;
    if (this.state.skipState.consecutiveBsLosses >= 2) {
      this.state.skipState.isActive = true;
      if (!this.state.skipState.activatedAtPeriod) {
        this.state.skipState.activatedAtPeriod = period;
      }
    }
    this.saveState();
  }

  /**
   * Resolves a completed round against any recorded prediction for `period`
   * AND updates pattern priorities, BS vs Exact Number records, and Skip Mode state.
   */
  public auditActualResult(
    period: string,
    actualNumber: number,
    externalAudit?: {
      predictedBS: 'BIG' | 'SMALL' | 'SKIP';
      predictedNumber: number;
      patternResponsible: string;
      contributingSignals?: Array<{ patternId: string; bs: 'BIG' | 'SMALL' }>;
      sourceDigit?: number;
      confidence?: number;
      analysis?: string;
    }
  ): PredictionAuditRecord | null {
    if (!Number.isInteger(actualNumber) || actualNumber < 0 || actualNumber > 9) {
      return null;
    }
    const actualBS: 'BIG' | 'SMALL' = actualNumber >= 5 ? 'BIG' : 'SMALL';

    let target = this.state.audits.find((a) => a.period === period);
    if (!target && externalAudit) {
      target = this.recordPrediction({
        period,
        predictedBS: externalAudit.predictedBS,
        predictedNumber: externalAudit.predictedNumber,
        patternResponsible: externalAudit.patternResponsible,
        contributingSignals: externalAudit.contributingSignals || [],
        sourceDigit: externalAudit.sourceDigit,
        confidence: externalAudit.confidence ?? 0,
        status: externalAudit.predictedBS === 'SKIP' ? 'SKIP_SILENT' : 'ACTIVE',
        analysis: externalAudit.analysis || '',
      });
    }

    if (!target) {
      // No prediction recorded for this period, only record skip monitoring tick if active
      if (this.state.skipState.isActive && this.state.skipState.lastEvaluatedPeriod !== period) {
        this.state.skipState.lastEvaluatedPeriod = period;
        this.state.skipState.roundsMonitoredInSkip += 1;
        this.saveState();
      }
      return null;
    }

    // Already audited -> idempotent guard
    if (target.actualNumber !== null && target.combinedResult !== 'PENDING') {
      return target;
    }

    target.actualNumber = actualNumber;
    target.actualBS = actualBS;

    if (target.predictedBS === 'SKIP') {
      target.bsResult = 'SKIP';
      target.numberResult = 'SKIP';
      target.combinedResult = 'SKIP';
      this.state.skipState.lastEvaluatedPeriod = period;
      this.saveState();
      return target;
    }

    const bsWin = target.predictedBS === actualBS;
    const numWin = target.predictedNumber === actualNumber;

    target.bsResult = bsWin ? 'WIN' : 'LOSS';
    target.numberResult = numWin ? 'WIN' : 'LOSS';
    target.combinedResult =
      bsWin && numWin ? 'BOTH_WIN' : bsWin ? 'BS_WIN' : numWin ? 'NUM_WIN' : 'LOSS';

    const failingPatterns: string[] = [];

    // Update performance for every contributing pattern signal
    const signals =
      target.contributingSignals.length > 0
        ? target.contributingSignals
        : [{ patternId: target.patternResponsible, bs: target.predictedBS }];

    for (const sig of signals) {
      const sigWonBS = sig.bs === actualBS;
      const sigWonExact = sig.patternId === target.patternResponsible && numWin;
      this.updatePatternStat(sig.patternId, sigWonBS, sigWonExact);
      if (!sigWonBS) {
        failingPatterns.push(sig.patternId);
      }
    }

    // Also update the top responsible pattern explicitly if it was a synthesized ID
    if (!signals.some((s) => s.patternId === target.patternResponsible)) {
      this.updatePatternStat(target.patternResponsible, bsWin, numWin);
      if (!bsWin) failingPatterns.push(target.patternResponsible);
    }

    target.failingPatterns = failingPatterns;

    // Update exact opposite number mapping audit
    if (typeof target.sourceDigit === 'number' && target.sourceDigit >= 0 && target.sourceDigit <= 9) {
      const mapStat = this.state.numberMappingStats[target.sourceDigit] || {
        digit: target.sourceDigit,
        hits: 0,
        misses: 0,
        recentHits: [],
      };
      if (numWin) mapStat.hits += 1;
      else mapStat.misses += 1;
      mapStat.recentHits = [(numWin ? 1 : 0) as 0 | 1, ...mapStat.recentHits].slice(0, 30);
      this.state.numberMappingStats[target.sourceDigit] = mapStat;
    }

    // Update consecutive BIG/SMALL loss state & Intelligent Skip Mode transitions
    this.state.skipState.lastEvaluatedPeriod = period;
    if (bsWin) {
      this.state.skipState.consecutiveBsLosses = 0;
      this.state.skipState.isActive = false;
      this.state.skipState.hasNotifiedActivation = false;
      this.state.skipState.roundsMonitoredInSkip = 0;
      this.state.skipState.resumedAtPeriod = period;
    } else {
      this.state.skipState.consecutiveBsLosses += 1;
      if (this.state.skipState.consecutiveBsLosses >= 2) {
        this.state.skipState.isActive = true;
        if (!this.state.skipState.activatedAtPeriod) {
          this.state.skipState.activatedAtPeriod = period;
        }
      }
    }

    this.saveState();
    return target;
  }

  private updatePatternStat(patternId: string, bsWin: boolean, numWin: boolean): void {
    const existing = this.state.patternStats[patternId] || {
      patternId,
      wins: 0,
      losses: 0,
      bsWins: 0,
      bsLosses: 0,
      numWins: 0,
      numLosses: 0,
      consecutiveFailures: 0,
      recentOutcomes: [],
      priorityWeight: 1.0,
      lastUpdated: '',
    };

    if (bsWin) {
      existing.wins += 1;
      existing.bsWins += 1;
      existing.consecutiveFailures = 0;
      existing.recentOutcomes = ['W' as const, ...existing.recentOutcomes].slice(0, 20);
    } else {
      existing.losses += 1;
      existing.bsLosses += 1;
      existing.consecutiveFailures += 1;
      existing.recentOutcomes = ['L' as const, ...existing.recentOutcomes].slice(0, 20);
    }

    if (numWin) existing.numWins += 1;
    else existing.numLosses += 1;

    // Adaptive priority calculation:
    // Penalize repeatedly failing patterns quickly so the engine avoids repeating mistakes.
    const recentWins = existing.recentOutcomes.filter((x) => x === 'W').length;
    const recentTotal = existing.recentOutcomes.length;
    const recentRate = recentTotal > 0 ? recentWins / recentTotal : 0.55;

    let weight = 0.7 + recentRate * 0.7; // range ~[0.7, 1.4]
    if (existing.consecutiveFailures >= 2) {
      weight *= Math.pow(0.72, existing.consecutiveFailures - 1);
    }
    if (bsWin && existing.recentOutcomes[0] === 'W' && existing.recentOutcomes[1] === 'W') {
      weight *= 1.1;
    }

    existing.priorityWeight = Math.round(Math.max(0.2, Math.min(1.6, weight)) * 1000) / 1000;
    existing.lastUpdated = new Date().toISOString();
    this.state.patternStats[patternId] = existing;
  }

  /**
   * Determines whether the Skip Mode should emit an initial activation notice
   * or remain silent during ongoing internal skip monitoring.
   */
  public resolveSkipStatus(
    shouldSkip: boolean,
    consecutiveLosses: number,
    qualityScore: number
  ): PredictionRunStatus {
    const effectiveLosses = Math.max(consecutiveLosses, this.state.skipState.consecutiveBsLosses);

    if (shouldSkip) {
      if (effectiveLosses >= 2) {
        if (!this.state.skipState.isActive || !this.state.skipState.hasNotifiedActivation) {
          this.state.skipState.isActive = true;
          return 'SKIP_ACTIVATED';
        }
        return 'SKIP_SILENT';
      }
      // Single-round high-chaos skip outside 2-loss streak
      return this.state.skipState.hasNotifiedActivation ? 'SKIP_SILENT' : 'SKIP_ACTIVATED';
    }

    // Valid strong pattern found -> active prediction
    if (effectiveLosses < 2) {
      this.state.skipState.isActive = false;
      this.state.skipState.hasNotifiedActivation = false;
    } else if (this.state.skipState.isActive) {
      this.state.skipState.lastResumeQualityScore = qualityScore;
    }
    return 'ACTIVE';
  }
}

// Singleton shared tracker instance for live browser & server execution
export const globalWingoTracker = new WingoPatternTracker(true);

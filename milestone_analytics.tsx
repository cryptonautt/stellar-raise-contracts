/**
 * @title Campaign Milestone Celebration Analytics
 * @notice Computes advanced, display-ready business intelligence and visualization data for crowdfunding milestone UI
 * @dev Pure functions and a React panel; no unsafe HTML. Extends basic insight logic with growth and momentum metrics.
 * @author Stellar Raise Team
 * @version 1.2.0
 */

import React, { useMemo } from 'react';

import './milestone_analytics.css';

/** @notice Hard cap for user-origin strings shown in the UI (DoS / layout abuse mitigation) */
export const MAX_DISPLAY_STRING_LENGTH = 200;

/** @notice Standard funding thresholds used for celebration milestones (percent of goal) */
export const CELEBRATION_THRESHOLDS = [25, 50, 75, 100] as const;

/**
 * @notice Campaign metadata and history for BI computations
 */
export interface CampaignAnalyticsInput {
  campaignId: string;
  campaignTitle: string;
  raisedAmount: number;
  goalAmount: number;
  contributorCount: number;
  historyRaisedTotals: number[];
  historyTimestampsMs?: number[];
  /** @notice Unix timestamp (seconds) for campaign end date */
  deadlineTimestamp?: number;
}

/**
 * @notice Qualitative momentum status for BI insights
 */
export type MomentumStatus = 'accelerating' | 'steady' | 'decelerating' | 'stalled';

/**
 * @notice Confidence level for reaching the goal based on current trends
 */
export type ReachabilityConfidence = 'high' | 'medium' | 'low' | 'reached';

/**
 * @notice A business intelligence insight row
 */
export interface BIInsight {
  id: string;
  severity: 'info' | 'success' | 'warning' | 'critical';
  headline: string;
  detail: string;
  trend?: 'up' | 'down' | 'neutral';
}

/**
 * @notice Data point for visualizations
 */
export interface AnalyticsDataPoint {
  label: string;
  value: number;
  meta?: string;
}

/**
 * @notice Full analytics result for the dashboard
 */
export interface CampaignMilestoneAnalyticsResult {
  percentFunded: number;
  isGoalReached: boolean;
  averageContribution: number;
  momentum: MomentumStatus;
  confidence: ReachabilityConfidence;
  velocityPerDay: number | null;
  estimatedDaysToGoal: number | null;
  growthRate: number; // Percentage change in velocity
  healthScore: number; // 0-100
  healthGrade: string; // A-F
  nextMilestone: number | null;
  recentlyCrossedMilestone: number | null;
  insights: BIInsight[];
  chartSeries: AnalyticsDataPoint[];
  displayTitle: string;
}

/**
 * @title MilestoneAnalyticsEngine
 * @notice Advanced logic for campaign business intelligence and safety
 */
export class MilestoneAnalyticsEngine {
  /**
   * @notice Sanitizes display text and strips HTML-like fragments
   */
  static sanitize(input: string): string {
    if (typeof input !== 'string') return '';
    const clean = input
      .replace(/[\u0000-\u001F\u007F]/g, '')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return clean.slice(0, MAX_DISPLAY_STRING_LENGTH);
  }

  /**
   * @notice Clamps numeric values to finite non-negative numbers
   */
  static clamp(n: number): number {
    return (Number.isFinite(n) && n >= 0) ? n : 0;
  }

  /**
   * @notice Computes average contribution size
   */
  static computeAverageContribution(raised: number, contributors: number): number {
    const r = this.clamp(raised);
    const c = Math.floor(this.clamp(contributors));
    return c > 0 ? r / c : 0;
  }

  /**
   * @notice Determines momentum by comparing recent velocity vs long-term average
   */
  static computeMomentum(history: number[]): MomentumStatus {
    if (!history || history.length < 3) return 'steady';
    
    const recent = history[history.length - 1] - history[history.length - 2];
    const previous = history[history.length - 2] - history[history.length - 3];
    
    if (recent === 0 && previous === 0) return 'stalled';
    if (recent > previous * 1.1) return 'accelerating';
    if (recent < previous * 0.9) return 'decelerating';
    return 'steady';
  }

  /**
   * @notice Computes growth rate as percentage change between recent velocity steps
   */
  static computeGrowthRate(history: number[]): number {
    if (!history || history.length < 3) return 0;
    const recent = history[history.length - 1] - history[history.length - 2];
    const previous = history[history.length - 2] - history[history.length - 3];
    if (previous <= 0) return recent > 0 ? 100 : 0;
    return ((recent - previous) / previous) * 100;
  }

  /**
   * @notice Estimates reachability confidence based on remaining time and current pace
   */
  static computeReachability(
    raised: number,
    goal: number,
    velocity: number | null,
    deadline?: number
  ): ReachabilityConfidence {
    if (raised >= goal && goal > 0) return 'reached';
    if (!velocity || velocity <= 0 || !deadline) return 'low';

    const remaining = goal - raised;
    const now = Date.now() / 1000;
    const secondsLeft = deadline - now;
    const daysLeft = secondsLeft / (24 * 3600);

    if (daysLeft <= 0) return 'low';

    const requiredVelocity = remaining / daysLeft;
    const ratio = velocity / requiredVelocity;

    if (ratio >= 1.2) return 'high';
    if (ratio >= 0.8) return 'medium';
    return 'low';
  }

  /**
   * @notice Calculates a health score (0-100) based on momentum and reachability
   */
  static computeHealthScore(
    percent: number,
    momentum: MomentumStatus,
    confidence: ReachabilityConfidence
  ): number {
    let score = Math.min(percent, 40); // Base score from progress (cap at 40)
    
    const momentumBumps: Record<MomentumStatus, number> = {
      accelerating: 30,
      steady: 15,
      decelerating: 5,
      stalled: 0
    };
    score += momentumBumps[momentum];

    const confidenceBumps: Record<ReachabilityConfidence, number> = {
      reached: 30,
      high: 30,
      medium: 15,
      low: 0
    };
    score += confidenceBumps[confidence];

    return Math.min(100, score);
  }

  /**
   * @notice Maps a health score to a letter grade
   */
  static getGrade(score: number): string {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 50) return 'C';
    if (score >= 30) return 'D';
    return 'F';
  }
}

/**
 * @notice Internal helper for daily velocity computation
 */
function calculateVelocity(history: number[], timestamps?: number[]): number | null {
  if (history.length < 2) return null;
  const deltaAmount = history[history.length - 1] - history[0];
  
  let deltaDays: number;
  if (timestamps && timestamps.length === history.length) {
    const ms = timestamps[timestamps.length - 1] - timestamps[0];
    deltaDays = ms / (24 * 3600 * 1000);
  } else {
    deltaDays = history.length - 1;
  }

  return deltaDays > 0 ? deltaAmount / deltaDays : null;
}

/**
 * @notice Main analytics entry point
 */
export function computeCampaignAnalytics(
  input: CampaignAnalyticsInput
): CampaignMilestoneAnalyticsResult {
  const engine = MilestoneAnalyticsEngine;
  const title = engine.sanitize(input.campaignTitle);
  const raised = engine.clamp(input.raisedAmount);
  const goal = engine.clamp(input.goalAmount);
  const contributors = engine.clamp(input.contributorCount);
  const history = input.historyRaisedTotals.map(v => engine.clamp(v));

  const percentFunded = goal > 0 ? (raised / goal) * 100 : 0;
  const isGoalReached = goal > 0 && raised >= goal;
  const avgContrib = engine.computeAverageContribution(raised, contributors);
  const momentum = engine.computeMomentum(history);
  const growthRate = engine.computeGrowthRate(history);
  const velocity = calculateVelocity(history, input.historyTimestampsMs);
  
  const confidence = engine.computeReachability(
    raised,
    goal,
    velocity,
    input.deadlineTimestamp
  );

  const healthScore = engine.computeHealthScore(percentFunded, momentum, confidence);
  const healthGrade = engine.getGrade(healthScore);

  // Milestone logic
  let nextMilestone: number | null = null;
  for (const t of CELEBRATION_THRESHOLDS) {
    if (percentFunded < t) {
      nextMilestone = t;
      break;
    }
  }

  let recentlyCrossedMilestone: number | null = null;
  if (history.length >= 2 && goal > 0) {
    const prevPercent = (history[history.length - 2] / goal) * 100;
    for (const t of CELEBRATION_THRESHOLDS) {
      if (prevPercent < t && percentFunded >= t) {
        recentlyCrossedMilestone = t;
      }
    }
  }

  const insights: BIInsight[] = [];

  // Goal Insight
  if (isGoalReached) {
    insights.push({
      id: 'bi-goal',
      severity: 'success',
      headline: 'Goal achieved',
      detail: `Campaign "${title}" is now fully funded. Health Score: ${healthGrade}.`,
      trend: 'up'
    });
  } else if (goal > 0) {
    insights.push({
      id: 'bi-progress',
      severity: 'info',
      headline: `${percentFunded.toFixed(1)}% Funded`,
      detail: `Next target: ${nextMilestone}%. Reachability: ${confidence.toUpperCase()}.`
    });
  }

  // Momentum Insight
  if (momentum === 'accelerating') {
    insights.push({
      id: 'bi-momentum',
      severity: 'success',
      headline: 'High Momentum',
      detail: `Growth rate is +${growthRate.toFixed(0)}%. funding speed is increasing rapidly.`,
      trend: 'up'
    });
  } else if (momentum === 'decelerating') {
    insights.push({
      id: 'bi-momentum',
      severity: 'warning',
      headline: 'Slowing Down',
      detail: 'Velocity has dipped. Consider a community update to reignite interest.',
      trend: 'down'
    });
  }

  const chartSeries: AnalyticsDataPoint[] = history.map((val, i) => ({
    label: `Day ${i + 1}`,
    value: goal > 0 ? (val / goal) * 100 : 0
  }));

  let estimatedDays: number | null = null;
  if (velocity && velocity > 0 && goal > raised) {
    estimatedDays = (goal - raised) / velocity;
  }

  return {
    percentFunded,
    isGoalReached,
    averageContribution: avgContrib,
    momentum,
    confidence,
    velocityPerDay: velocity,
    estimatedDaysToGoal: estimatedDays,
    growthRate,
    healthScore,
    healthGrade,
    nextMilestone,
    recentlyCrossedMilestone,
    insights,
    chartSeries,
    displayTitle: title
  };
}

/**
 * @notice Formats compact currency-like labels
 */
function formatValue(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return Math.round(v).toString();
}

/**
 * @notice Lightweight SVG Sparkline
 */
const Sparkline: React.FC<{ data: number[] }> = ({ data }) => {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 100;
  const height = 30;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg className="bi-sparkline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
};

/**
 * @notice Progress bar milestone markers
 */
const MilestoneMarkers: React.FC<{ percent: number }> = ({ percent }) => {
  return (
    <div className="milestone-markers">
      {CELEBRATION_THRESHOLDS.map(t => (
        <div 
          key={t} 
          className={`milestone-marker ${percent >= t ? 'milestone-marker--reached' : ''}`}
          style={{ left: `${t}%` }}
        >
          <span className="marker-label">{t}%</span>
        </div>
      ))}
    </div>
  );
};

/**
 * @title MilestoneAnalyticsPanel
 * @notice Premium React panel for milestone celebration and BI analytics
 */
export const MilestoneAnalyticsPanel: React.FC<{ input: CampaignAnalyticsInput }> = ({ input }) => {
  const data = useMemo(() => computeCampaignAnalytics(input), [input]);

  const momentumColor = {
    accelerating: '#10b981',
    steady: '#3b82f6',
    decelerating: '#f59e0b',
    stalled: '#ef4444'
  }[data.momentum];

  return (
    <div className={`milestone-analytics-panel ${data.recentlyCrossedMilestone ? 'milestone-analytics-panel--celebrating' : ''}`} data-testid="analytics-panel">
      {data.recentlyCrossedMilestone && (
        <div className="celebration-banner">
          <span className="celebration-icon">🎉</span>
          Milestone reached: {data.recentlyCrossedMilestone}%!
        </div>
      )}

      <header className="milestone-analytics-panel__header">
        <div className="header-left">
          <h2 className="milestone-analytics-panel__title">Campaign Intelligence</h2>
          <p className="milestone-analytics-panel__subtitle">Health Grade: <strong>{data.healthGrade}</strong></p>
        </div>
        <div className="milestone-analytics-panel__badge" style={{ backgroundColor: momentumColor }}>
          {data.momentum.toUpperCase()}
        </div>
      </header>

      <div className="milestone-analytics-panel__grid">
        <div className="bi-card">
          <span className="bi-card__label">Reachability</span>
          <span className={`bi-card__value bi-card__value--${data.confidence}`}>
            {data.confidence.toUpperCase()}
          </span>
        </div>
        <div className="bi-card">
          <span className="bi-card__label">Growth Rate</span>
          <span className="bi-card__value">
            {data.growthRate > 0 ? '+' : ''}{data.growthRate.toFixed(0)}%
          </span>
          <Sparkline data={input.historyRaisedTotals} />
        </div>
        <div className="bi-card">
          <span className="bi-card__label">Daily Pace</span>
          <span className="bi-card__value">
            {data.velocityPerDay ? formatValue(data.velocityPerDay) : '—'}
          </span>
        </div>
        <div className="bi-card">
          <span className="bi-card__label">ETA</span>
          <span className="bi-card__value">
            {data.estimatedDaysToGoal ? `${Math.ceil(data.estimatedDaysToGoal)}d` : '—'}
          </span>
        </div>
      </div>

      <div className="milestone-analytics-panel__progress-container">
        <div className="progress-info">
          <span>Overall Progress ({data.percentFunded.toFixed(1)}%)</span>
          {data.nextMilestone && (
            <span className="next-milestone-hint">Next: {data.nextMilestone}%</span>
          )}
        </div>
        <div className="progress-bar-wrapper">
          <div className="progress-bar">
            <div 
              className="progress-bar__fill" 
              style={{ width: `${Math.min(100, data.percentFunded)}%` }}
            />
          </div>
          <MilestoneMarkers percent={data.percentFunded} />
        </div>
      </div>

      <section className="milestone-analytics-panel__insights">
        <h3 className="section-title">BI Insights</h3>
        <ul className="insight-list">
          {data.insights.map(item => (
            <li key={item.id} className={`insight-item insight-item--${item.severity}`}>
              <div className="insight-item__content">
                <strong>{item.headline}</strong>
                <p>{item.detail}</p>
              </div>
              {item.trend && (
                <span className={`trend-icon trend-icon--${item.trend}`}>
                  {item.trend === 'up' ? '▲' : item.trend === 'down' ? '▼' : '●'}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default MilestoneAnalyticsPanel;

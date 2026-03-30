/**
 * @title Milestone Celebration Analytics Tests
 * @notice Covers advanced BI logic, momentum, reachability, and premium component rendering
 * @dev Reuses patterns from milestone_insights.test.tsx with updated BI assertions
 * @author Stellar Raise Team
 * @version 1.1.0
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  MilestoneAnalyticsPanel,
  MilestoneAnalyticsEngine,
  computeCampaignAnalytics,
  type CampaignAnalyticsInput,
} from './milestone_analytics';

const baseInput = (): CampaignAnalyticsInput => ({
  campaignId: 'camp_bi_1',
  campaignTitle: 'Stellar Voyager',
  raisedAmount: 500,
  goalAmount: 1000,
  contributorCount: 10,
  historyRaisedTotals: [0, 200, 500],
  deadlineTimestamp: Math.floor(Date.now() / 1000) + 86400 * 10, // 10 days left
});

describe('MilestoneAnalyticsEngine.sanitize', () => {
  it('strips HTML and control characters', () => {
    expect(MilestoneAnalyticsEngine.sanitize('<b>Bold</b>\u0000Text')).toBe('BoldText');
  });

  it('collapses whitespace', () => {
    expect(MilestoneAnalyticsEngine.sanitize('  a   b  ')).toBe('a b');
  });

  it('returns empty string for non-strings', () => {
    expect(MilestoneAnalyticsEngine.sanitize(null as any)).toBe('');
    expect(MilestoneAnalyticsEngine.sanitize(123 as any)).toBe('');
  });
});

describe('MilestoneAnalyticsEngine.clamp', () => {
  it('returns 0 for negative or non-finite', () => {
    expect(MilestoneAnalyticsEngine.clamp(-100)).toBe(0);
    expect(MilestoneAnalyticsEngine.clamp(Infinity)).toBe(0);
    expect(MilestoneAnalyticsEngine.clamp(NaN)).toBe(0);
  });

  it('preserves valid numbers', () => {
    expect(MilestoneAnalyticsEngine.clamp(42.5)).toBe(42.5);
  });
});

describe('MilestoneAnalyticsEngine.computeAverageContribution', () => {
  it('divides raised by contributors', () => {
    expect(MilestoneAnalyticsEngine.computeAverageContribution(1000, 10)).toBe(100);
  });

  it('returns 0 when contributors is 0', () => {
    expect(MilestoneAnalyticsEngine.computeAverageContribution(1000, 0)).toBe(0);
  });
});

describe('MilestoneAnalyticsEngine.computeMomentum', () => {
  it('returns accelerating when recent growth > 110% of previous', () => {
    const history = [0, 100, 220]; // step1: 100, step2: 120
    expect(MilestoneAnalyticsEngine.computeMomentum(history)).toBe('accelerating');
  });

  it('returns decelerating when recent growth < 90% of previous', () => {
    const history = [0, 100, 180]; // step1: 100, step2: 80
    expect(MilestoneAnalyticsEngine.computeMomentum(history)).toBe('decelerating');
  });

  it('returns steady when growth is within 10% range', () => {
    const history = [0, 100, 205]; // step1: 100, step2: 105
    expect(MilestoneAnalyticsEngine.computeMomentum(history)).toBe('steady');
  });

  it('returns stalled when no growth', () => {
    const history = [100, 100, 100];
    expect(MilestoneAnalyticsEngine.computeMomentum(history)).toBe('stalled');
  });

  it('returns steady for short history', () => {
    expect(MilestoneAnalyticsEngine.computeMomentum([0, 100])).toBe('steady');
  });
});

describe('MilestoneAnalyticsEngine.computeReachability', () => {
  const goal = 1000;
  const deadline = Math.floor(Date.now() / 1000) + 86400 * 10; // 10 days left
  // Required velocity = 1000 / 10 = 100 per day

  it('returns reached if goal met', () => {
    expect(MilestoneAnalyticsEngine.computeReachability(1000, 1000, 50, deadline)).toBe('reached');
  });

  it('returns high confidence if velocity >= 120% of required', () => {
    expect(MilestoneAnalyticsEngine.computeReachability(0, goal, 120, deadline)).toBe('high');
  });

  it('returns medium confidence if velocity >= 80% and < 120% of required', () => {
    expect(MilestoneAnalyticsEngine.computeReachability(0, goal, 100, deadline)).toBe('medium');
    expect(MilestoneAnalyticsEngine.computeReachability(0, goal, 80, deadline)).toBe('medium');
  });

  it('returns low confidence if velocity < 80% of required', () => {
    expect(MilestoneAnalyticsEngine.computeReachability(0, goal, 70, deadline)).toBe('low');
  });

  it('returns low if no velocity or deadline is past', () => {
    expect(MilestoneAnalyticsEngine.computeReachability(0, goal, 0, deadline)).toBe('low');
    expect(MilestoneAnalyticsEngine.computeReachability(0, goal, 100, Math.floor(Date.now()/1000) - 100)).toBe('low');
  });
});

describe('computeCampaignAnalytics', () => {
  it('full integration: computes basic stats and insights', () => {
    const res = computeCampaignAnalytics(baseInput());
    expect(res.percentFunded).toBe(50);
    expect(res.isGoalReached).toBe(false);
    expect(res.averageContribution).toBe(50);
    expect(res.displayTitle).toBe('Stellar Voyager');
    expect(res.insights.length).toBeGreaterThan(0);
  });

  it('handles goalReached state', () => {
    const res = computeCampaignAnalytics({
      ...baseInput(),
      raisedAmount: 1200,
      goalAmount: 1000,
    });
    expect(res.isGoalReached).toBe(true);
    expect(res.insights.some(i => i.id === 'bi-goal')).toBe(true);
  });

  it('detects momentum changes in insights', () => {
    const resAccel = computeCampaignAnalytics({
      ...baseInput(),
      historyRaisedTotals: [0, 100, 300], // accel
    });
    expect(resAccel.momentum).toBe('accelerating');
    expect(resAccel.insights.some(i => i.id === 'bi-momentum')).toBe(true);

    const resDecel = computeCampaignAnalytics({
      ...baseInput(),
      historyRaisedTotals: [0, 200, 300], // decel
    });
    expect(resDecel.momentum).toBe('decelerating');
    expect(resDecel.insights.some(i => i.id === 'bi-momentum' && i.severity === 'warning')).toBe(true);
  });

  it('estimates days to goal correctly', () => {
    const res = computeCampaignAnalytics({
      ...baseInput(),
      raisedAmount: 500,
      goalAmount: 1000,
      historyRaisedTotals: [0, 500], // velocity 500, but synthetic days=1
    });
    expect(res.velocityPerDay).toBe(500);
    expect(res.estimatedDaysToGoal).toBe(1);
  });
});

describe('MilestoneAnalyticsPanel', () => {
  it('renders title and BI cards', () => {
    render(<MilestoneAnalyticsPanel input={baseInput()} />);
    expect(screen.getByText('Campaign Intelligence')).toBeInTheDocument();
    expect(screen.getByText('AVG. SUPPORT')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument(); // 500/10
  });

  it('displays momentum badge with correct status', () => {
    render(<MilestoneAnalyticsPanel input={baseInput()} />);
    expect(screen.getByText('STEADY')).toBeInTheDocument();
  });

  it('renders progress bar correctly', () => {
    render(<MilestoneAnalyticsPanel input={baseInput()} />);
    expect(screen.getByText('50.0%')).toBeInTheDocument();
  });

  it('renders insights list', () => {
    render(<MilestoneAnalyticsPanel input={baseInput()} />);
    expect(screen.getByText('BI Insights')).toBeInTheDocument();
  });
});

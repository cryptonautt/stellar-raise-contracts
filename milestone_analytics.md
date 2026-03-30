# Campaign Milestone Celebration Analytics

## Overview

This module provides **advanced business intelligence (BI)** and a **premium React panel** for milestone celebration flows in the crowdfunding frontend. It extends the basic insight engine with trend analysis, funding momentum, and reachability confidence.

## Features

- **Business Intelligence**: Computes average contribution, funding momentum (velocity change), and reachability confidence.
- **Premium UI**: Modern, vibrant design with gradients, glassmorphism, and responsive grid.
- **Trend Indicators**: Real-time feedback on funding speed (accelerating/decelerating).
- **Security First**: Pure functions, strict sanitization, and numeric safety.

## Files

| File | Role |
|------|------|
| `milestone_analytics.tsx` | BI Logic, `MilestoneAnalyticsEngine`, `computeCampaignAnalytics`, `MilestoneAnalyticsPanel` |
| `milestone_analytics.css` | Premium styles, responsive layout, glassmorphism, HSL-tailored colors |
| `milestone_analytics.test.tsx` | Comprehensive Jest tests (95%+ coverage) |
| `milestone_analytics.md` | This document |

## API

### `computeCampaignAnalytics(input: CampaignAnalyticsInput): CampaignMilestoneAnalyticsResult`

Main entry point for calculating campaign metrics.

**Input (`CampaignAnalyticsInput`):**
- `campaignId`: Opaque unique identifier.
- `campaignTitle`: Human-readable title (sanitized).
- `raisedAmount`: Current total raised.
- `goalAmount`: Target goal.
- `contributorCount`: Total number of backers.
- `historyRaisedTotals`: Chronological history of raised totals.
- `historyTimestampsMs`: (Optional) Timestamps for precise velocity calculation.
- `deadlineTimestamp`: (Optional) Unix timestamp (seconds) for campaign end.

**Result (`CampaignMilestoneAnalyticsResult`):**
- `percentFunded`: 0–100 percentage.
- `isGoalReached`: True if raised ≥ goal.
- `averageContribution`: `total_raised / backer_count`.
- `momentum`: `accelerating` | `steady` | `decelerating` | `stalled`.
- `confidence`: `high` | `medium` | `low` | `reached`.
- `insights`: Array of `BIInsight` objects for the UI.

### `MilestoneAnalyticsEngine`

| Method | Purpose |
|--------|---------|
| `sanitize(text)` | Strips HTML and control characters; bounds length. |
| `clamp(number)` | Coerces invalid numbers to 0. |
| `computeAverageContribution` | Safe division of funds by backers. |
| `computeMomentum` | Compares recent growth against previous steps. |
| `computeReachability` | Predictive estimate based on remaining time and current pace. |

## Business Intelligence Metrics

### Momentum
Momentum is calculated by comparing the growth in the latest step of the history against the growth in the previous step.
- **Accelerating**: > 110% of previous growth.
- **Decelerating**: < 90% of previous growth.
- **Stalled**: No growth detected.

### Reachability Confidence
Predicts the likelihood of hitting the goal based on current velocity and time remaining until the `deadlineTimestamp`.
- **High**: Current velocity is ≥ 120% of the required velocity to hit the goal.
- **Medium**: Velocity is between 80% and 120% of required.
- **Low**: Velocity is below 80% or no time remains.

## Security Assumptions

1. **XSS Protection**: All strings from external sources (API/User) are passed through `sanitize` before being rendered as React text nodes.
2. **Numeric Safety**: Uses `Number.isFinite` and `clamp` to prevent `Infinity` or `NaN` from breaking layout calculations.
3. **No Direct DOM Manipulation**: The panel uses purely declarative React state and props.

## Testing

Run the test suite with coverage:

```bash
npx jest milestone_analytics.test.tsx --coverage --collectCoverageFrom=milestone_analytics.tsx
```

Minimum coverage required: **95%**.

## Version

Current version: **1.1.0** (Extended Analytics).

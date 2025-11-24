# LLM-Connector-Hub Integration Diagrams

## Visual Reference Guide

This document provides visual diagrams and flow charts for understanding the LLM-Connector-Hub integration architecture.

---

## 1. High-Level System Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                         LLM DevOps Ecosystem                           │
│                                                                        │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐          │
│  │   Frontend   │     │   Backend    │     │   Services   │          │
│  │ Applications │     │    APIs      │     │  (internal)  │          │
│  └──────┬───────┘     └──────┬───────┘     └──────┬───────┘          │
│         │                    │                    │                   │
│         └────────────────────┴────────────────────┘                   │
│                              │                                        │
└──────────────────────────────┼────────────────────────────────────────┘
                               │
                               ↓
┌────────────────────────────────────────────────────────────────────────┐
│                        LLM-Edge-Agent (Proxy Layer)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                │
│  │   Routing    │  │   Caching    │  │ Load Balance │                │
│  │   Engine     │  │   Layer      │  │   Manager    │                │
│  └──────────────┘  └──────────────┘  └──────────────┘                │
└────────────────────────────────────────────────────────────────────────┘
                               │
                               ↓
┌────────────────────────────────────────────────────────────────────────┐
│                    LLM-Connector-Hub (CORE)                            │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │                  Request Processing Pipeline                      │ │
│  │                                                                   │ │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌────────┐ │ │
│  │  │Govrnance│→ │  Cred   │→ │ Normal  │→ │Provider │→ │Response│ │ │
│  │  │  Check  │  │Injection│  │  ization│  │  Call   │  │Transform│ │ │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └────────┘ │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │                    Provider Connectors                            │ │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐         │ │
│  │  │ OpenAI │ │Anthropic│ │ Google│ │  Azure │ │  AWS   │         │ │
│  │  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘         │ │
│  └──────────────────────────────────────────────────────────────────┘ │
└───┬────────┬────────┬────────┬────────┬────────┬────────────────────┘
    │        │        │        │        │        │
    ↓        ↓        ↓        ↓        ↓        ↓
┌────────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
│  LLM-  │ │ LLM- │ │ LLM- │ │ LLM- │ │ LLM- │ │OpenAI│
│ Forge  │ │ Edge │ │Config│ │Govern│ │Observ│ │ API  │
└────────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘
```

---

## 2. Request Flow Sequence Diagram

```
Client          Edge-Agent      Connector-Hub    Governance    Config-Mgr    Observatory    Provider
  │                 │                 │               │             │              │            │
  │ 1. Request      │                 │               │             │              │            │
  ├────────────────>│                 │               │             │              │            │
  │                 │                 │               │             │              │            │
  │                 │ 2. Route        │               │             │              │            │
  │                 │    Decision     │               │             │              │            │
  │                 ├────────────────>│               │             │              │            │
  │                 │                 │               │             │              │            │
  │                 │                 │ 3. Authorize  │             │              │            │
  │                 │                 ├──────────────>│             │              │            │
  │                 │                 │<──────────────┤             │              │            │
  │                 │                 │ 4. OK         │             │              │            │
  │                 │                 │               │             │              │            │
  │                 │                 │ 5. Get Creds  │             │              │            │
  │                 │                 ├───────────────┼────────────>│              │            │
  │                 │                 │<──────────────┼─────────────┤              │            │
  │                 │                 │ 6. Credentials│             │              │            │
  │                 │                 │               │             │              │            │
  │                 │                 │ 7. Start Trace│             │              │            │
  │                 │                 ├───────────────┼─────────────┼─────────────>│            │
  │                 │                 │               │             │              │            │
  │                 │                 │ 8. Provider Call            │              │            │
  │                 │                 ├───────────────┼─────────────┼──────────────┼───────────>│
  │                 │                 │<──────────────┼─────────────┼──────────────┼────────────┤
  │                 │                 │ 9. Response   │             │              │            │
  │                 │                 │               │             │              │            │
  │                 │                 │ 10. End Trace + Metrics     │              │            │
  │                 │                 ├───────────────┼─────────────┼─────────────>│            │
  │                 │                 │               │             │              │            │
  │                 │                 │ 11. Track Cost│             │              │            │
  │                 │                 ├──────────────>│             │              │            │
  │                 │                 │               │             │              │            │
  │                 │<────────────────┤               │             │              │            │
  │<────────────────┤ 12. Response    │               │             │              │            │
  │ 13. Response    │                 │               │             │              │            │
  │                 │                 │               │             │              │            │
```

---

## 3. Integration Data Flows

### 3.1 LLM-Forge Integration Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                   LLM-Forge SDK Generation                      │
└─────────────────────────────────────────────────────────────────┘

Step 1: Schema Export
┌──────────────┐          GET /api/v1/schemas          ┌──────────┐
│ LLM-Forge    │────────────────────────────────────────>│Connector │
│              │<────────────────────────────────────────│   Hub    │
│              │    {providerId, endpoints, schemas}    │          │
└──────────────┘                                         └──────────┘

Step 2: Code Generation
┌──────────────┐
│ LLM-Forge    │
│              │  1. Parse schemas
│              │  2. Generate TypeScript types
│              │  3. Generate client methods
│              │  4. Generate validators
│              │  5. Bundle SDK
└──────────────┘

Step 3: Contract Validation (Runtime)
┌──────────────┐      POST /api/v1/validate           ┌──────────┐
│ Generated    │────────────────────────────────────────>│Connector │
│   SDK        │<────────────────────────────────────────│   Hub    │
│              │    {valid: true, errors: []}          │          │
└──────────────┘                                         └──────────┘

Output: Type-safe SDKs
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ TypeScript   │  │   Python     │  │      Go      │
│     SDK      │  │     SDK      │  │     SDK      │
└──────────────┘  └──────────────┘  └──────────────┘
```

### 3.2 LLM-Observatory Integration Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                LLM-Observatory Telemetry Flow                   │
└─────────────────────────────────────────────────────────────────┘

Distributed Tracing:
┌──────────────┐                                      ┌──────────┐
│ Connector    │  1. Start Span (Request Received)    │Observatory│
│   Hub        ├─────────────────────────────────────>│          │
│              │                                      │          │
│              │  2. Child Span (Normalize Request)   │          │
│              ├─────────────────────────────────────>│          │
│              │                                      │          │
│              │  3. Child Span (Provider Call)       │          │
│              ├─────────────────────────────────────>│          │
│              │                                      │          │
│              │  4. Child Span (Transform Response)  │          │
│              ├─────────────────────────────────────>│          │
│              │                                      │          │
│              │  5. End Span (Request Complete)      │          │
│              ├─────────────────────────────────────>│          │
└──────────────┘                                      └──────────┘

Performance Metrics:
┌──────────────┐  POST /api/v1/observatory/metrics/  ┌──────────┐
│ Connector    │           performance                │Observatory│
│   Hub        ├─────────────────────────────────────>│          │
│              │  {                                   │          │
│              │    timing: {total, network, ...},    │          │
│              │    throughput: {...},                │          │
│              │    resources: {...}                  │          │
│              │  }                                   │          │
└──────────────┘                                      └──────────┘

Error Reporting:
┌──────────────┐  POST /api/v1/observatory/errors/   ┌──────────┐
│ Connector    │           report                     │Observatory│
│   Hub        ├─────────────────────────────────────>│          │
│              │  {                                   │          │
│              │    errorType, message, stackTrace,   │          │
│              │    context, impact                   │          │
│              │  }                                   │          │
└──────────────┘                                      └──────────┘

Trace Visualization:
┌──────────────────────────────────────────────────────────────┐
│  TraceID: abc123                        Duration: 234ms      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Request Received                          12ms       │    │
│  │  ┌──────────────────────────────────────┐           │    │
│  │  │ Normalize Request                4ms  │           │    │
│  │  └──────────────────────────────────────┘           │    │
│  │  ┌──────────────────────────────────────────────┐   │    │
│  │  │ Provider Call                       189ms     │   │    │
│  │  └──────────────────────────────────────────────┘   │    │
│  │  ┌──────────────────────────────────────┐           │    │
│  │  │ Transform Response              29ms │           │    │
│  │  └──────────────────────────────────────┘           │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### 3.3 LLM-Governance-Dashboard Integration Flow

```
┌─────────────────────────────────────────────────────────────────┐
│             LLM-Governance-Dashboard Integration                │
└─────────────────────────────────────────────────────────────────┘

Policy Enforcement Flow:
┌──────────────┐                                      ┌──────────┐
│ Connector    │  1. Authorization Request            │Governance│
│   Hub        ├─────────────────────────────────────>│ Dashboard│
│              │  {userId, provider, model, cost}     │          │
│              │                                      │          │
│              │  2. Check Policies                   │          │
│              │     - User quotas                    │          │
│              │     - Cost limits                    │          │
│              │     - Model restrictions             │          │
│              │     - Time-based policies            │          │
│              │                                      │          │
│              │<─────────────────────────────────────┤          │
│              │  3. Authorization Result             │          │
│              │  {allowed: true, policies: [...]}    │          │
└──────────────┘                                      └──────────┘

Usage Tracking Flow:
┌──────────────┐                                      ┌──────────┐
│ Connector    │  POST /api/v1/governance/metrics/    │Governance│
│   Hub        │       export                         │ Dashboard│
│              ├─────────────────────────────────────>│          │
│              │  {                                   │          │
│              │    requestCount, tokens, cost,       │          │
│              │    groupBy: [user, team, project]    │          │
│              │  }                                   │          │
└──────────────┘                                      └──────────┘

Real-time Streaming:
┌──────────────┐  SSE: /api/v1/governance/metrics/   ┌──────────┐
│ Connector    │       stream                         │Governance│
│   Hub        │═════════════════════════════════════>│ Dashboard│
│              │  event: request                      │          │
│              │  data: {tokens, cost, user}          │          │
│              │                                      │          │
│              │  event: cost-alert                   │          │
│              │  data: {threshold, actual}           │          │
└──────────────┘                                      └──────────┘

Audit Logging Flow:
┌──────────────┐                                      ┌──────────┐
│ Connector    │  POST /api/v1/governance/audit/log   │Governance│
│   Hub        ├─────────────────────────────────────>│ Dashboard│
│              │  {                                   │          │
│              │    eventType, actor, resource,       │          │
│              │    action, outcome, compliance       │          │
│              │  }                                   │          │
└──────────────┘                                      └──────────┘

Governance Dashboard View:
┌──────────────────────────────────────────────────────────────┐
│  Cost Tracking                     Usage Metrics             │
│  ┌────────────────────┐           ┌────────────────────┐    │
│  │ Today: $1,234      │           │ Requests: 45.2K    │    │
│  │ Budget: $2,000     │           │ Tokens: 12.8M      │    │
│  │ Remaining: $766    │           │ Errors: 0.03%      │    │
│  └────────────────────┘           └────────────────────┘    │
│                                                              │
│  Policy Violations                 Top Users                 │
│  ┌────────────────────┐           ┌────────────────────┐    │
│  │ None               │           │ 1. team-A (45%)    │    │
│  │ ✓ All compliant    │           │ 2. team-B (30%)    │    │
│  └────────────────────┘           │ 3. team-C (25%)    │    │
│                                   └────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### 3.4 LLM-Auto-Optimizer Integration Flow

```
┌─────────────────────────────────────────────────────────────────┐
│              LLM-Auto-Optimizer Integration                     │
└─────────────────────────────────────────────────────────────────┘

Performance Data Export:
┌──────────────┐                                      ┌──────────┐
│ Connector    │  POST /api/v1/optimizer/performance/ │   Auto-  │
│   Hub        │       export                         │ Optimizer│
│              ├─────────────────────────────────────>│          │
│              │  {                                   │          │
│              │    providers: [                      │          │
│              │      {providerId, metrics, cost,     │          │
│              │       quality, reliability}          │          │
│              │    ]                                 │          │
│              │  }                                   │          │
└──────────────┘                                      └──────────┘

Real-time Performance Stream:
┌──────────────┐  SSE: /api/v1/optimizer/performance/ ┌──────────┐
│ Connector    │       realtime                       │   Auto-  │
│   Hub        │═════════════════════════════════════>│ Optimizer│
│              │  event: performance-sample           │          │
│              │  data: {latency, cost, quality}      │          │
│              │                                      │          │
│              │  event: anomaly                      │          │
│              │  data: {type, severity}              │          │
└──────────────┘                                      └──────────┘

Optimization Recommendations:
┌──────────────┐                                      ┌──────────┐
│ Connector    │  GET /api/v1/optimizer/costs/        │   Auto-  │
│   Hub        │      recommendations                 │ Optimizer│
│              │<─────────────────────────────────────┤          │
│              │  [                                   │          │
│              │    {recommendationId, category,      │          │
│              │     savings, implementation}         │          │
│              │  ]                                   │          │
└──────────────┘                                      └──────────┘

Apply Optimization:
┌──────────────┐                                      ┌──────────┐
│ Connector    │  POST /api/v1/optimizer/feedback/    │   Auto-  │
│   Hub        │       apply                          │ Optimizer│
│              ├─────────────────────────────────────>│          │
│              │  {recommendationId, scope,           │          │
│              │   monitoring, rollbackConditions}    │          │
│              │                                      │          │
│              │  Gradual Rollout:                    │          │
│              │  - 10% of traffic                    │          │
│              │  - Monitor metrics                   │          │
│              │  - Increase to 25%                   │          │
│              │  - Monitor metrics                   │          │
│              │  - Increase to 50%                   │          │
│              │  - Monitor metrics                   │          │
│              │  - Increase to 100%                  │          │
│              │                                      │          │
│              │<─────────────────────────────────────┤          │
│              │  {status: "completed",               │          │
│              │   actualSavings: $X.XX}              │          │
└──────────────┘                                      └──────────┘

Feedback Loop:
┌──────────────┐                                      ┌──────────┐
│ Connector    │  POST /api/v1/optimizer/feedback/    │   Auto-  │
│   Hub        │       report                         │ Optimizer│
│              ├─────────────────────────────────────>│          │
│              │  {                                   │          │
│              │    outcome, actualSavings,           │          │
│              │    impact, observations,             │          │
│              │    recommendation: "keep"            │          │
│              │  }                                   │          │
└──────────────┘                                      └──────────┘

Optimization Dashboard:
┌──────────────────────────────────────────────────────────────┐
│  Active Optimizations           Potential Savings            │
│  ┌────────────────────┐         ┌────────────────────┐      │
│  │ Provider Switch    │         │ Monthly: $4,500    │      │
│  │ Status: 75%        │         │ Annual: $54,000    │      │
│  │ Savings: $1,200/mo │         │ ROI: 450%          │      │
│  └────────────────────┘         └────────────────────┘      │
│                                                              │
│  Recommendations                Performance Trends           │
│  ┌────────────────────┐         ┌────────────────────┐      │
│  │ 1. Cache responses │         │ Latency: ↓ 15%    │      │
│  │    Save: $800/mo   │         │ Cost: ↓ 22%       │      │
│  │ 2. Batch requests  │         │ Quality: → stable  │      │
│  │    Save: $450/mo   │         └────────────────────┘      │
│  └────────────────────┘                                      │
└──────────────────────────────────────────────────────────────┘
```

### 3.5 LLM-Config-Manager Integration Flow

```
┌─────────────────────────────────────────────────────────────────┐
│              LLM-Config-Manager Integration                     │
└─────────────────────────────────────────────────────────────────┘

Credential Retrieval:
┌──────────────┐                                      ┌──────────┐
│ Connector    │  GET /api/v1/config/credentials      │  Config  │
│   Hub        ├─────────────────────────────────────>│ Manager  │
│              │  {providerId: "openai",              │          │
│              │   environment: "production"}         │          │
│              │                                      │          │
│              │<─────────────────────────────────────┤          │
│              │  {credentialId, type, value,         │          │
│              │   expiresAt, rotationSchedule}       │          │
└──────────────┘                                      └──────────┘

Credential Rotation Flow:
┌──────────────┐                                      ┌──────────┐
│  Config      │  1. Initiate Rotation                │Connector │
│  Manager     ├─────────────────────────────────────>│   Hub    │
│              │  {providerId, reason,                │          │
│              │   newCredential, gracePeriod: 300s}  │          │
│              │                                      │          │
│              │  2. Use Both Credentials             │          │
│              │     (grace period: 5 minutes)        │          │
│              │                                      │          │
│              │<─────────────────────────────────────┤          │
│              │  3. Confirm New Credential Working   │          │
│              │                                      │          │
│              │  4. Remove Old Credential            │          │
│              ├─────────────────────────────────────>│          │
│              │                                      │          │
│              │<─────────────────────────────────────┤          │
│              │  5. Rotation Complete                │          │
└──────────────┘                                      └──────────┘

Configuration Sync:
┌──────────────┐                                      ┌──────────┐
│  Config      │  POST /api/v1/config/sync            │Connector │
│  Manager     ├─────────────────────────────────────>│   Hub    │
│              │  {                                   │          │
│              │    version: "1.2.3",                 │          │
│              │    changes: [                        │          │
│              │      {providerId, changeType,        │          │
│              │       operation, newValue}           │          │
│              │    ]                                 │          │
│              │  }                                   │          │
│              │                                      │          │
│              │<─────────────────────────────────────┤          │
│              │  {acknowledged, appliedChanges,      │          │
│              │   currentVersion}                    │          │
└──────────────┘                                      └──────────┘

Webhook for Config Changes:
┌──────────────┐                                      ┌──────────┐
│  Config      │  POST /api/v1/webhooks/config-changed│Connector │
│  Manager     ├─────────────────────────────────────>│   Hub    │
│              │  {                                   │          │
│              │    eventId, changeType, providerId,  │          │
│              │    requiresRestart, gracePeriod      │          │
│              │  }                                   │          │
│              │                                      │          │
│              │  Connector Hub Actions:              │          │
│              │  1. Validate new config              │          │
│              │  2. Apply changes                    │          │
│              │  3. Reload provider connectors       │          │
│              │  4. Notify dependent services        │          │
└──────────────┘                                      └──────────┘

Secrets Flow:
┌──────────────┐                                      ┌──────────┐
│              │                                      │  Vault/  │
│  Config      │  1. Request Secret                   │   KMS    │
│  Manager     ├─────────────────────────────────────>│          │
│              │                                      │          │
│              │<─────────────────────────────────────┤          │
│              │  2. Encrypted Secret                 │          │
│              │                                      │          │
│              │  3. Decrypt & Provide                ┌──────────┐
│              ├─────────────────────────────────────>│Connector │
│              │                                      │   Hub    │
│              │  4. Audit Log Access                 │          │
└──────────────┘                                      └──────────┘
```

### 3.6 LLM-Edge-Agent Integration Flow

```
┌─────────────────────────────────────────────────────────────────┐
│               LLM-Edge-Agent Integration                        │
└─────────────────────────────────────────────────────────────────┘

Agent Registration:
┌──────────────┐                                      ┌──────────┐
│  Edge        │  POST /api/v1/edge/register          │Connector │
│  Agent       ├─────────────────────────────────────>│   Hub    │
│              │  {                                   │          │
│              │    agentId, region, capabilities,    │          │
│              │    healthCheckEndpoint               │          │
│              │  }                                   │          │
│              │                                      │          │
│              │<─────────────────────────────────────┤          │
│              │  {registered, routingRules,          │          │
│              │   heartbeatInterval}                 │          │
└──────────────┘                                      └──────────┘

Routing Decision:
┌──────────────┐                                      ┌──────────┐
│  Edge        │  POST /api/v1/edge/route             │Connector │
│  Agent       ├─────────────────────────────────────>│   Hub    │
│              │  {                                   │          │
│              │    requestContext: {                 │          │
│              │      model, capability, tokens,      │          │
│              │      priority, latencyBudget         │          │
│              │    }                                 │          │
│              │  }                                   │          │
│              │                                      │          │
│              │<─────────────────────────────────────┤          │
│              │  {                                   │          │
│              │    primaryProvider: "openai",        │          │
│              │    fallbackProviders: ["anthropic"], │          │
│              │    reasoning: "lowest cost",         │          │
│              │    estimatedCost, estimatedLatency   │          │
│              │  }                                   │          │
└──────────────┘                                      └──────────┘

Request Execution Flow:
┌──────────────┐                                      ┌──────────┐
│  Edge        │  POST /api/v1/edge/execute           │Connector │
│  Agent       ├─────────────────────────────────────>│   Hub    │
│              │  {                                   │          │
│              │    requestId, agentId,               │          │
│              │    originalRequest,                  │          │
│              │    routingContext                    │          │
│              │  }                                   │          │
│              │                                      │          │
│              │  Connector Hub Processing:           │          │
│              │  1. Validate request                 │          │
│              │  2. Check governance                 │          │
│              │  3. Get credentials                  │          │
│              │  4. Normalize request                │          │
│              │  5. Call provider                    │          │
│              │  6. Transform response               │          │
│              │  7. Collect telemetry                │          │
│              │                                      │          │
│              │<─────────────────────────────────────┤          │
│              │  {                                   │          │
│              │    requestId, provider, response,    │          │
│              │    metadata: {latency, cost, tokens} │          │
│              │  }                                   │          │
└──────────────┘                                      └──────────┘

Health Check Flow:
┌──────────────┐                                      ┌──────────┐
│  Edge        │  GET /api/v1/edge/providers/health   │Connector │
│  Agent       ├─────────────────────────────────────>│   Hub    │
│              │                                      │          │
│              │<─────────────────────────────────────┤          │
│              │  {                                   │          │
│              │    providers: [                      │          │
│              │      {providerId, status, load,      │          │
│              │       latency, errorRate, rateLimit} │          │
│              │    ]                                 │          │
│              │  }                                   │          │
│              │                                      │          │
│              │  Update Routing Table Based on       │          │
│              │  Provider Health                     │          │
└────────────────                                      └──────────┘

Load Balancing Visualization:
┌──────────────────────────────────────────────────────────────┐
│  Provider Load Distribution                                  │
│  ┌────────────────────────────────────────────────────┐     │
│  │ OpenAI     [████████████████░░░░] 75% (Healthy)   │     │
│  │ Anthropic  [████████░░░░░░░░░░░░] 35% (Healthy)   │     │
│  │ Google AI  [████████████░░░░░░░░] 55% (Healthy)   │     │
│  │ Azure      [████░░░░░░░░░░░░░░░░] 15% (Healthy)   │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  Routing Strategy: Cost-Optimized                           │
│  Fallback: Enabled                                           │
│  Cache Hit Rate: 42%                                         │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. Event-Driven Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                         Event Bus Architecture                     │
└────────────────────────────────────────────────────────────────────┘

Event Publishers:
┌──────────────┐
│ Connector    │ Publishes:
│   Hub        │ - request.started
│              │ - request.completed
│              │ - request.failed
│              │ - provider.switched
│              │ - ratelimit.hit
│              │ - cost.threshold.exceeded
│              │ - credential.rotated
│              │ - configuration.updated
│              │ - health.check.failed
│              │ - anomaly.detected
└──────┬───────┘
       │
       ↓
┌────────────────────────────────────────────────────────────────┐
│                    Event Bus (Kafka/RabbitMQ)                  │
│  Topics:                                                       │
│  - connector.requests                                          │
│  - connector.responses                                         │
│  - connector.errors                                            │
│  - connector.telemetry                                         │
│  - connector.governance                                        │
│  - connector.config                                            │
└───┬────┬────┬────┬────┬────────────────────────────────────────┘
    │    │    │    │    │
    ↓    ↓    ↓    ↓    ↓
┌─────┐┌─────┐┌─────┐┌─────┐┌─────┐
│Obsrv││Govern││Optim││Config││Edge │ Event Subscribers
└─────┘└─────┘└─────┘└─────┘└─────┘

Event Flow Example:
┌──────────────────────────────────────────────────────────────┐
│ 1. Request Started Event                                     │
│    {                                                         │
│      eventId: "evt_123",                                     │
│      eventType: "request.started",                           │
│      timestamp: "2025-11-23T10:00:00Z",                      │
│      data: {                                                 │
│        requestId: "req_456",                                 │
│        provider: "openai",                                   │
│        model: "gpt-4",                                       │
│        userId: "user_789"                                    │
│      }                                                       │
│    }                                                         │
│    ↓                                                         │
│    Consumed by: Observatory, Governance, Auto-Optimizer      │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ 2. Request Completed Event                                   │
│    {                                                         │
│      eventId: "evt_124",                                     │
│      eventType: "request.completed",                         │
│      timestamp: "2025-11-23T10:00:01.234Z",                  │
│      data: {                                                 │
│        requestId: "req_456",                                 │
│        latency: 1234,                                        │
│        tokens: 500,                                          │
│        cost: 0.025                                           │
│      }                                                       │
│    }                                                         │
│    ↓                                                         │
│    Consumed by: Observatory, Governance, Auto-Optimizer      │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ 3. Cost Threshold Exceeded Event                             │
│    {                                                         │
│      eventId: "evt_125",                                     │
│      eventType: "cost.threshold.exceeded",                   │
│      timestamp: "2025-11-23T10:05:00Z",                      │
│      data: {                                                 │
│        userId: "user_789",                                   │
│        threshold: 100.00,                                    │
│        actual: 105.50,                                       │
│        period: "hourly"                                      │
│      }                                                       │
│    }                                                         │
│    ↓                                                         │
│    Consumed by: Governance (triggers alert),                 │
│                 Auto-Optimizer (cost optimization signal)    │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. Security Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                     Security Layers                                │
└────────────────────────────────────────────────────────────────────┘

Layer 1: Network Security
┌──────────────────────────────────────────────────────────────┐
│  Internet                                                    │
│    ↓                                                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ WAF (Web Application Firewall)                      │    │
│  │ - DDoS Protection                                   │    │
│  │ - Rate Limiting                                     │    │
│  │ - IP Filtering                                      │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘

Layer 2: API Gateway
┌──────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────┐    │
│  │ API Gateway                                         │    │
│  │ - TLS Termination                                   │    │
│  │ - Authentication (JWT, API Key)                     │    │
│  │ - Request Validation                                │    │
│  │ - Rate Limiting per Client                          │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘

Layer 3: Service Mesh
┌──────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Service Mesh (Istio/Linkerd)                        │    │
│  │ - mTLS for Service-to-Service                       │    │
│  │ - Authorization Policies                            │    │
│  │ - Traffic Encryption                                │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘

Layer 4: Application Security
┌──────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Connector Hub                                       │    │
│  │ - RBAC Authorization                                │    │
│  │ - PII Detection & Masking                           │    │
│  │ - Request Signing                                   │    │
│  │ - Input Validation                                  │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘

Layer 5: Secrets Management
┌──────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Config Manager + Vault/KMS                          │    │
│  │ - Encrypted Storage                                 │    │
│  │ - Credential Rotation                               │    │
│  │ - Access Auditing                                   │    │
│  │ - Least Privilege Access                            │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘

Security Flow:
┌─────────┐    1. TLS      ┌─────┐    2. JWT     ┌─────────┐
│ Client  │───────────────>│ WAF │─────────────>│   API   │
│         │                │     │              │ Gateway │
└─────────┘                └─────┘              └────┬────┘
                                                     │
                              3. mTLS                │
                              ┌──────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────┐
│ Service Mesh                                             │
│   ┌──────────────┐    mTLS    ┌──────────────┐          │
│   │  Edge Agent  │<──────────>│  Connector   │          │
│   │              │            │     Hub      │          │
│   └──────────────┘            └──────┬───────┘          │
│                                      │                   │
│                                      │ 4. Get Creds      │
│                                      ↓                   │
│                               ┌──────────────┐           │
│                               │    Config    │           │
│                               │   Manager    │           │
│                               └──────┬───────┘           │
│                                      │                   │
│                                      │ 5. From Vault     │
│                                      ↓                   │
│                               ┌──────────────┐           │
│                               │ Vault / KMS  │           │
│                               └──────────────┘           │
└──────────────────────────────────────────────────────────┘
```

---

## 6. Deployment Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                  Kubernetes Deployment Architecture                │
└────────────────────────────────────────────────────────────────────┘

Multi-Region Deployment:
┌────────────────────────────────────────────────────────────────────┐
│  Region: US-EAST-1                                                 │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │  Availability Zone 1       Availability Zone 2           │     │
│  │  ┌─────────────────┐       ┌─────────────────┐          │     │
│  │  │ Connector-Hub   │       │ Connector-Hub   │          │     │
│  │  │ Pod 1, 2, 3     │       │ Pod 4, 5, 6     │          │     │
│  │  └─────────────────┘       └─────────────────┘          │     │
│  └──────────────────────────────────────────────────────────┘     │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│  Region: EU-WEST-1                                                 │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │  Availability Zone 1       Availability Zone 2           │     │
│  │  ┌─────────────────┐       ┌─────────────────┐          │     │
│  │  │ Connector-Hub   │       │ Connector-Hub   │          │     │
│  │  │ Pod 1, 2, 3     │       │ Pod 4, 5, 6     │          │     │
│  │  └─────────────────┘       └─────────────────┘          │     │
│  └──────────────────────────────────────────────────────────┘     │
└────────────────────────────────────────────────────────────────────┘

Kubernetes Resources:
┌──────────────────────────────────────────────────────────────┐
│  Connector-Hub Namespace                                     │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Deployment: connector-hub                         │     │
│  │  - Replicas: 3-20 (autoscaling)                    │     │
│  │  - Rolling Update Strategy                         │     │
│  │  - Resource Limits: 2 CPU, 2Gi Memory              │     │
│  │  - Liveness/Readiness Probes                       │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Service: connector-hub                            │     │
│  │  - Type: LoadBalancer                              │     │
│  │  - Port: 80 → 8080                                 │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │  HorizontalPodAutoscaler                           │     │
│  │  - Min: 3, Max: 20                                 │     │
│  │  - CPU: 70%, Memory: 80%                           │     │
│  │  - Custom Metrics: RPS > 1000                      │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │  ConfigMap: connector-hub-config                   │     │
│  │  Secret: connector-hub-secrets                     │     │
│  │  PersistentVolumeClaim: cache-volume               │     │
│  └────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘

Pod Architecture:
┌──────────────────────────────────────────────────────────────┐
│  Pod: connector-hub-xxx                                      │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Container: connector-hub                          │     │
│  │  - Image: connector-hub:v1.0.0                     │     │
│  │  - Port: 8080 (HTTP), 9090 (Metrics)               │     │
│  │  - Env: Config references                          │     │
│  │  - Volume: /cache                                  │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Sidecar: telemetry-agent                          │     │
│  │  - Image: otel-collector:latest                    │     │
│  │  - Port: 4317 (OTLP gRPC)                          │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Sidecar: envoy-proxy (Service Mesh)               │     │
│  │  - mTLS Termination                                │     │
│  │  - Traffic Routing                                 │     │
│  └────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
```

---

## 7. Monitoring Dashboard Layout

```
┌────────────────────────────────────────────────────────────────────┐
│                  Connector Hub Monitoring Dashboard                │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│  System Health                                                     │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐    │
│  │ Uptime     │ │ Error Rate │ │   RPS      │ │  Latency   │    │
│  │  99.98%    │ │   0.02%    │ │  12,450    │ │  P95: 89ms │    │
│  │   ✓ OK     │ │   ✓ OK     │ │   ✓ OK     │ │   ✓ OK     │    │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘    │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│  Provider Status                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ Provider    │ Status  │ Latency │ Error % │ Load │ Cost  │    │
│  ├──────────────────────────────────────────────────────────┤    │
│  │ OpenAI      │ ✓ OK    │  145ms  │  0.01%  │ 75%  │ $120  │    │
│  │ Anthropic   │ ✓ OK    │   98ms  │  0.00%  │ 35%  │  $45  │    │
│  │ Google AI   │ ✓ OK    │  112ms  │  0.03%  │ 55%  │  $67  │    │
│  │ Azure       │ ⚠ Slow  │  289ms  │  0.15%  │ 15%  │  $23  │    │
│  └──────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│  Integration Health                                                │
│  ┌────────────────────┐  ┌────────────────────┐                   │
│  │ Observatory        │  │ Governance         │                   │
│  │ ✓ Connected        │  │ ✓ Connected        │                   │
│  │ Latency: 3ms       │  │ Latency: 7ms       │                   │
│  │ 99.99% delivery    │  │ 100% policy check  │                   │
│  └────────────────────┘  └────────────────────┘                   │
│  ┌────────────────────┐  ┌────────────────────┐                   │
│  │ Auto-Optimizer     │  │ Config Manager     │                   │
│  │ ✓ Connected        │  │ ✓ Connected        │                   │
│  │ 2 active optim.    │  │ Last sync: 30s ago │                   │
│  │ $450/mo savings    │  │ All creds valid    │                   │
│  └────────────────────┘  └────────────────────┘                   │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│  Request Latency (P95) - Last 1 Hour                               │
│  200ms ┤                                                           │
│        │     ╭──╮                                                  │
│  150ms ┤   ╭─╯  ╰──╮                         ╭─╮                  │
│        │  ╭╯        ╰─╮                   ╭──╯ ╰─╮                │
│  100ms ┤──╯            ╰───╮         ╭────╯      ╰──╮             │
│        │                   ╰─────────╯               ╰────         │
│   50ms ┤                                                           │
│      0 └──────────────────────────────────────────────────────────│
│        10:00   10:15   10:30   10:45   11:00   11:15   11:30      │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│  Recent Alerts                                                     │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ ⚠ 11:15 - Azure latency high (289ms avg)                │    │
│  │ ✓ 10:45 - Cost optimization applied: save $450/mo       │    │
│  │ ✓ 10:30 - Credential rotation completed: openai         │    │
│  └──────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────┘
```

---

## Conclusion

These diagrams provide visual representations of the LLM-Connector-Hub integration architecture, covering:

1. **System Overview**: High-level component relationships
2. **Request Flow**: Detailed sequence of operations
3. **Integration Flows**: Specific data flows for each module
4. **Event Architecture**: Event-driven communication patterns
5. **Security Layers**: Multi-layered security approach
6. **Deployment**: Kubernetes-based infrastructure
7. **Monitoring**: Real-time operational dashboards

Use these diagrams in conjunction with the detailed specifications in `INTEGRATION_SPECIFICATIONS.md` and `SPARC_ARCHITECTURE.md` for complete understanding of the system architecture.

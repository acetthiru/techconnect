/**
 * TECH BRIDGE '26 - Comprehensive 300 Concurrent User Load Test Simulation Script
 * 
 * IMPORTANT:
 * - This script is designed for Staging / Isolated Test Environments.
 * - DO NOT execute against production without prior organizer authorization.
 * - Progressive concurrency stages: 25 -> 50 -> 100 -> 200 -> 300 concurrent participants.
 * 
 * Usage:
 *   node scripts/loadTest300Simulation.cjs [TARGET_URL]
 *   Example: node scripts/loadTest300Simulation.cjs http://localhost:3000
 */

const http = require('http');
const https = require('https');
const WebSocket = require('ws');

const TARGET_BASE_URL = process.argv[2] || process.env.TEST_TARGET_URL || 'http://localhost:3000';
const isHttps = TARGET_BASE_URL.startsWith('https');
const httpModule = isHttps ? https : http;

const STAGES = [
  { concurrency: 25, durationSec: 15, name: 'Stage 1: Warmup & Initial Check' },
  { concurrency: 50, durationSec: 20, name: 'Stage 2: Small Cohort' },
  { concurrency: 100, durationSec: 25, name: 'Stage 3: Moderate Symposium Volume' },
  { concurrency: 200, durationSec: 30, name: 'Stage 4: High Concurrency Load' },
  { concurrency: 300, durationSec: 40, name: 'Stage 5: Target Peak Capacity (300 Users)' },
];

class MetricsCollector {
  constructor() {
    this.reset();
  }

  reset() {
    this.totalRequests = 0;
    this.successfulRequests = 0;
    this.failedRequests = 0;
    this.latencies = [];
    this.wsConnected = 0;
    this.wsFailed = 0;
    this.wsMessagesReceived = 0;
    this.answerSubmissions = 0;
    this.answerErrors = 0;
    this.errorsByType = {};
  }

  recordRequest(latencyMs, success, errorMsg = null) {
    this.totalRequests++;
    if (success) {
      this.successfulRequests++;
      this.latencies.push(latencyMs);
    } else {
      this.failedRequests++;
      if (errorMsg) {
        this.errorsByType[errorMsg] = (this.errorsByType[errorMsg] || 0) + 1;
      }
    }
  }

  getPercentile(p) {
    if (this.latencies.length === 0) return 0;
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  getReport() {
    const avg = this.latencies.length > 0 
      ? Math.round(this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length) 
      : 0;

    return {
      totalRequests: this.totalRequests,
      successfulRequests: this.successfulRequests,
      failedRequests: this.failedRequests,
      successRate: this.totalRequests > 0 ? ((this.successfulRequests / this.totalRequests) * 100).toFixed(2) + '%' : '0%',
      avgLatencyMs: avg,
      p50LatencyMs: this.getPercentile(50),
      p95LatencyMs: this.getPercentile(95),
      p99LatencyMs: this.getPercentile(99),
      wsConnectionsActive: this.wsConnected,
      wsConnectionErrors: this.wsFailed,
      wsBroadcastsReceived: this.wsMessagesReceived,
      answerSubmissions: this.answerSubmissions,
      answerSubmissionErrors: this.answerErrors,
      errorBreakdown: this.errorsByType,
    };
  }
}

function sendHttpRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const url = new URL(path, TARGET_BASE_URL);

    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers,
    };

    const reqOptions = {
      method,
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      headers: reqHeaders,
      timeout: 10000,
    };

    const req = httpModule.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const latency = Date.now() - startTime;
        const isSuccess = res.statusCode >= 200 && res.statusCode < 400;
        let parsed = null;
        try { parsed = JSON.parse(data); } catch (e) { parsed = data; }
        resolve({
          statusCode: res.statusCode,
          success: isSuccess,
          latency,
          data: parsed,
        });
      });
    });

    req.on('error', (err) => {
      const latency = Date.now() - startTime;
      resolve({
        statusCode: 0,
        success: false,
        latency,
        error: err.message,
      });
    });

    req.on('timeout', () => {
      req.destroy();
      const latency = Date.now() - startTime;
      resolve({
        statusCode: 408,
        success: false,
        latency,
        error: 'Request Timeout (10s)',
      });
    });

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function simulateParticipant(userIndex, metrics, stopSignal) {
  const teamId = `SIM-${1000 + userIndex}`;
  const teamName = `LoadTest_Team_${userIndex}`;

  // 1. Initial Web Access (Landing page / Health Check)
  const healthRes = await sendHttpRequest('GET', '/api/health');
  metrics.recordRequest(healthRes.latency, healthRes.success, healthRes.error);

  // 2. Register or Login
  const regRes = await sendHttpRequest('POST', '/api/team/register', {
    name: teamName,
    participant1: `SimUser_${userIndex}_A`,
    participant2: `SimUser_${userIndex}_B`,
    college: 'Load Test College of Engineering',
    department: 'CSE',
    year: '3rd Year',
    phone: `90000${String(userIndex).padStart(5, '0')}`,
  });
  metrics.recordRequest(regRes.latency, regRes.success, regRes.error || (regRes.statusCode === 409 ? 'Already registered (handled)' : null));

  const assignedTeamId = regRes.data?.team?.id || teamId;

  // 3. Login session
  const loginRes = await sendHttpRequest('POST', '/api/team/login', { teamId: assignedTeamId });
  metrics.recordRequest(loginRes.latency, loginRes.success, loginRes.error);

  // 4. Connect WebSocket
  let ws = null;
  const wsProtocol = isHttps ? 'wss:' : 'ws:';
  const wsUrl = `${wsProtocol}//${new URL(TARGET_BASE_URL).host}`;

  try {
    ws = new WebSocket(wsUrl);
    ws.on('open', () => {
      metrics.wsConnected++;
      // Send regular ping
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'PING', teamId: assignedTeamId }));
        }
      }, 5000);
      ws.on('close', () => clearInterval(pingInterval));
    });

    ws.on('message', () => {
      metrics.wsMessagesReceived++;
    });

    ws.on('error', () => {
      metrics.wsFailed++;
    });
  } catch (err) {
    metrics.wsFailed++;
  }

  // 5. Active User Lifecycle Loop
  let simulatedIteration = 0;
  while (!stopSignal.stopped) {
    simulatedIteration++;

    // Periodic state polling (Participant arena poll)
    const stateRes = await sendHttpRequest('GET', `/api/event?teamId=${assignedTeamId}`);
    metrics.recordRequest(stateRes.latency, stateRes.success, stateRes.error);

    // Periodic status poll
    const statusRes = await sendHttpRequest('GET', `/api/team/${assignedTeamId}/status`);
    metrics.recordRequest(statusRes.latency, statusRes.success, statusRes.error);

    // Occasional simulated answer submission
    if (simulatedIteration % 3 === 0 && stateRes.data?.currentQuestion?.id) {
      metrics.answerSubmissions++;
      const ansRes = await sendHttpRequest('POST', '/api/answer', {
        teamId: assignedTeamId,
        questionId: stateRes.data.currentQuestion.id,
        answer: 'TEST_ANSWER',
      });
      metrics.recordRequest(ansRes.latency, ansRes.success, ansRes.error);
      if (!ansRes.success && ansRes.statusCode !== 409 && ansRes.statusCode !== 403 && ansRes.statusCode !== 400) {
        metrics.answerErrors++;
      }
    }

    // Simulated network blip / reconnection testing (every 6th iteration)
    if (simulatedIteration % 6 === 0 && ws) {
      try {
        ws.close();
        await new Promise((r) => setTimeout(r, 1000));
        ws = new WebSocket(wsUrl);
      } catch (e) {
        metrics.wsFailed++;
      }
    }

    // Sleep jitter 2000-3500ms between actions
    const jitter = 2000 + Math.floor(Math.random() * 1500);
    await new Promise((r) => setTimeout(r, jitter));
  }

  // Cleanup
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.close();
  }
}

async function runStage(stage) {
  console.log(`\n======================================================`);
  console.log(`▶ Starting ${stage.name}`);
  console.log(`  Target Concurrent Participants: ${stage.concurrency}`);
  console.log(`  Target Duration: ${stage.durationSec} seconds`);
  console.log(`======================================================`);

  const metrics = new MetricsCollector();
  const stopSignal = { stopped: false };

  const workerPromises = [];
  for (let i = 1; i <= stage.concurrency; i++) {
    workerPromises.push(simulateParticipant(i, metrics, stopSignal));
    // Stagger startup slightly (20ms per user) to avoid synthetic instant-spike anomaly
    await new Promise((r) => setTimeout(r, 20));
  }

  // Run for stage duration
  await new Promise((r) => setTimeout(r, stage.durationSec * 1000));

  // Signal all workers to halt
  stopSignal.stopped = true;
  await Promise.allSettled(workerPromises);

  const report = metrics.getReport();
  console.log(`\n--- ${stage.name} Results ---`);
  console.table({
    'Concurrent Users': stage.concurrency,
    'Total Requests': report.totalRequests,
    'Successful Requests': report.successfulRequests,
    'Failed Requests': report.failedRequests,
    'Success Rate': report.successRate,
    'Avg Latency': `${report.avgLatencyMs} ms`,
    'p50 Latency': `${report.p50LatencyMs} ms`,
    'p95 Latency': `${report.p95LatencyMs} ms`,
    'p99 Latency': `${report.p99LatencyMs} ms`,
    'Active WS': report.wsConnectionsActive,
    'WS Failures': report.wsConnectionErrors,
    'Answer Submissions': report.answerSubmissions,
  });

  return report;
}

async function main() {
  console.log(`\n######################################################`);
  console.log(`#  TECH BRIDGE '26 - 300 PARTICIPANT LOAD TEST RUNNER #`);
  console.log(`######################################################`);
  console.log(`Target System: ${TARGET_BASE_URL}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);

  const overallResults = [];
  for (const stage of STAGES) {
    const res = await runStage(stage);
    overallResults.push({ stage: stage.name, users: stage.concurrency, ...res });
    // Cool down between stages
    await new Promise((r) => setTimeout(r, 3000));
  }

  console.log(`\n======================================================`);
  console.log(`🏁 FULL MULTI-STAGE PROGRESSIVE BENCHMARK COMPLETED`);
  console.log(`======================================================\n`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Fatal load test runner error:', err);
    process.exit(1);
  });
}

module.exports = { MetricsCollector, sendHttpRequest, simulateParticipant, runStage };

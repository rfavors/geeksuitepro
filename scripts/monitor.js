#!/usr/bin/env node

const os = require('os');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const mongoose = require('mongoose');
const redis = require('redis');
require('dotenv').config();

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logHeader(message) {
  log('\n' + '='.repeat(60), 'cyan');
  log(message, 'bright');
  log('='.repeat(60), 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logMetric(name, value, unit = '', status = 'info') {
  const statusIcon = {
    success: '✅',
    warning: '⚠️',
    error: '❌',
    info: 'ℹ️'
  }[status] || 'ℹ️';
  
  log(`${statusIcon} ${name}: ${value}${unit}`, status === 'error' ? 'red' : status === 'warning' ? 'yellow' : status === 'success' ? 'green' : 'blue');
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    mode: 'check', // check, watch, report, alert
    interval: 30, // seconds
    output: './logs/monitoring.log',
    format: 'console', // console, json, csv
    alerts: false,
    thresholds: {
      cpu: 80,
      memory: 85,
      disk: 90,
      responseTime: 5000
    },
    services: ['app', 'database', 'redis'],
    verbose: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--mode':
      case '-m':
        if (nextArg && ['check', 'watch', 'report', 'alert'].includes(nextArg)) {
          options.mode = nextArg;
          i++;
        }
        break;
      case '--interval':
      case '-i':
        if (nextArg && !isNaN(nextArg)) {
          options.interval = parseInt(nextArg);
          i++;
        }
        break;
      case '--output':
      case '-o':
        if (nextArg) {
          options.output = nextArg;
          i++;
        }
        break;
      case '--format':
      case '-f':
        if (nextArg && ['console', 'json', 'csv'].includes(nextArg)) {
          options.format = nextArg;
          i++;
        }
        break;
      case '--alerts':
        options.alerts = true;
        break;
      case '--cpu-threshold':
        if (nextArg && !isNaN(nextArg)) {
          options.thresholds.cpu = parseFloat(nextArg);
          i++;
        }
        break;
      case '--memory-threshold':
        if (nextArg && !isNaN(nextArg)) {
          options.thresholds.memory = parseFloat(nextArg);
          i++;
        }
        break;
      case '--disk-threshold':
        if (nextArg && !isNaN(nextArg)) {
          options.thresholds.disk = parseFloat(nextArg);
          i++;
        }
        break;
      case '--response-threshold':
        if (nextArg && !isNaN(nextArg)) {
          options.thresholds.responseTime = parseInt(nextArg);
          i++;
        }
        break;
      case '--services':
        if (nextArg) {
          options.services = nextArg.split(',');
          i++;
        }
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;
      default:
        if (arg.startsWith('-')) {
          logWarning(`Unknown option: ${arg}`);
        }
        break;
    }
  }

  return options;
}

// Show help message
function showHelp() {
  logHeader('GeekSuitePro Monitoring Tool');
  log('Usage: node scripts/monitor.js [options]\n');
  log('Options:');
  log('  -m, --mode <mode>           Monitoring mode: check, watch, report, alert (default: check)');
  log('  -i, --interval <seconds>    Check interval for watch mode (default: 30)');
  log('  -o, --output <file>         Output log file (default: ./logs/monitoring.log)');
  log('  -f, --format <format>       Output format: console, json, csv (default: console)');
  log('  --alerts                    Enable alert notifications');
  log('  --cpu-threshold <percent>   CPU usage alert threshold (default: 80)');
  log('  --memory-threshold <percent> Memory usage alert threshold (default: 85)');
  log('  --disk-threshold <percent>  Disk usage alert threshold (default: 90)');
  log('  --response-threshold <ms>   Response time alert threshold (default: 5000)');
  log('  --services <list>           Services to monitor (default: app,database,redis)');
  log('  -v, --verbose               Verbose output');
  log('  -h, --help                  Show this help message\n');
  log('Modes:');
  log('  check                       Single health check');
  log('  watch                       Continuous monitoring');
  log('  report                      Generate monitoring report');
  log('  alert                       Check and send alerts only\n');
  log('Examples:');
  log('  node scripts/monitor.js                           # Single health check');
  log('  node scripts/monitor.js --mode watch              # Continuous monitoring');
  log('  node scripts/monitor.js --mode report             # Generate report');
  log('  node scripts/monitor.js --alerts --cpu-threshold 70  # Enable alerts with custom threshold');
}

// System metrics collector
class SystemMonitor {
  constructor(options = {}) {
    this.options = options;
    this.startTime = Date.now();
    this.metrics = [];
  }

  // Get CPU usage
  async getCPUUsage() {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = Date.now();
      
      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const endTime = Date.now();
        
        const totalTime = (endTime - startTime) * 1000; // Convert to microseconds
        const cpuPercent = ((endUsage.user + endUsage.system) / totalTime) * 100;
        
        resolve(Math.min(100, Math.max(0, cpuPercent)));
      }, 100);
    });
  }

  // Get memory usage
  getMemoryUsage() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryPercent = (usedMemory / totalMemory) * 100;
    
    return {
      total: totalMemory,
      used: usedMemory,
      free: freeMemory,
      percent: memoryPercent
    };
  }

  // Get disk usage
  async getDiskUsage() {
    try {
      const stats = fs.statSync(process.cwd());
      // This is a simplified disk usage check
      // In production, you might want to use a more comprehensive solution
      return {
        total: 0,
        used: 0,
        free: 0,
        percent: 0
      };
    } catch (error) {
      return {
        total: 0,
        used: 0,
        free: 0,
        percent: 0,
        error: error.message
      };
    }
  }

  // Get load average
  getLoadAverage() {
    const loadAvg = os.loadavg();
    const cpuCount = os.cpus().length;
    
    return {
      '1min': loadAvg[0],
      '5min': loadAvg[1],
      '15min': loadAvg[2],
      cpuCount,
      normalized: {
        '1min': (loadAvg[0] / cpuCount) * 100,
        '5min': (loadAvg[1] / cpuCount) * 100,
        '15min': (loadAvg[2] / cpuCount) * 100
      }
    };
  }

  // Get process information
  getProcessInfo() {
    const processMemory = process.memoryUsage();
    
    return {
      pid: process.pid,
      uptime: process.uptime(),
      version: process.version,
      platform: process.platform,
      arch: process.arch,
      memory: {
        rss: processMemory.rss,
        heapTotal: processMemory.heapTotal,
        heapUsed: processMemory.heapUsed,
        external: processMemory.external,
        arrayBuffers: processMemory.arrayBuffers
      }
    };
  }

  // Check application health
  async checkApplicationHealth() {
    const appUrl = process.env.APP_URL || 'http://localhost:5000';
    const healthEndpoint = `${appUrl}/health`;
    
    return new Promise((resolve) => {
      const startTime = Date.now();
      const client = appUrl.startsWith('https') ? https : http;
      
      const req = client.get(healthEndpoint, (res) => {
        const responseTime = Date.now() - startTime;
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const healthData = JSON.parse(data);
            resolve({
              status: res.statusCode === 200 ? 'healthy' : 'unhealthy',
              statusCode: res.statusCode,
              responseTime,
              data: healthData
            });
          } catch (error) {
            resolve({
              status: 'unhealthy',
              statusCode: res.statusCode,
              responseTime,
              error: 'Invalid JSON response'
            });
          }
        });
      });
      
      req.on('error', (error) => {
        resolve({
          status: 'unhealthy',
          responseTime: Date.now() - startTime,
          error: error.message
        });
      });
      
      req.setTimeout(10000, () => {
        req.destroy();
        resolve({
          status: 'unhealthy',
          responseTime: Date.now() - startTime,
          error: 'Request timeout'
        });
      });
    });
  }

  // Check database connectivity
  async checkDatabaseHealth() {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/geeksuitepro';
    
    try {
      const startTime = Date.now();
      
      await mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000
      });
      
      const responseTime = Date.now() - startTime;
      const dbStats = await mongoose.connection.db.stats();
      
      await mongoose.disconnect();
      
      return {
        status: 'healthy',
        responseTime,
        stats: {
          collections: dbStats.collections,
          dataSize: dbStats.dataSize,
          storageSize: dbStats.storageSize,
          indexes: dbStats.indexes
        }
      };
    } catch (error) {
      if (mongoose.connection.readyState === 1) {
        await mongoose.disconnect();
      }
      
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  // Check Redis connectivity
  async checkRedisHealth() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    try {
      const startTime = Date.now();
      const client = redis.createClient({ url: redisUrl });
      
      await client.connect();
      const pong = await client.ping();
      const responseTime = Date.now() - startTime;
      
      const info = await client.info();
      await client.disconnect();
      
      return {
        status: pong === 'PONG' ? 'healthy' : 'unhealthy',
        responseTime,
        info: this.parseRedisInfo(info)
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  // Parse Redis info
  parseRedisInfo(info) {
    const lines = info.split('\r\n');
    const parsed = {};
    
    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        parsed[key] = value;
      }
    }
    
    return {
      version: parsed.redis_version,
      uptime: parsed.uptime_in_seconds,
      connectedClients: parsed.connected_clients,
      usedMemory: parsed.used_memory,
      totalSystemMemory: parsed.total_system_memory
    };
  }

  // Collect all metrics
  async collectMetrics() {
    const timestamp = new Date().toISOString();
    
    const metrics = {
      timestamp,
      system: {
        cpu: await this.getCPUUsage(),
        memory: this.getMemoryUsage(),
        disk: await this.getDiskUsage(),
        load: this.getLoadAverage(),
        process: this.getProcessInfo()
      },
      services: {}
    };
    
    // Check services based on configuration
    if (this.options.services.includes('app')) {
      metrics.services.app = await this.checkApplicationHealth();
    }
    
    if (this.options.services.includes('database')) {
      metrics.services.database = await this.checkDatabaseHealth();
    }
    
    if (this.options.services.includes('redis')) {
      metrics.services.redis = await this.checkRedisHealth();
    }
    
    return metrics;
  }

  // Check if metrics exceed thresholds
  checkThresholds(metrics) {
    const alerts = [];
    
    // CPU threshold
    if (metrics.system.cpu > this.options.thresholds.cpu) {
      alerts.push({
        type: 'cpu',
        level: 'warning',
        message: `CPU usage is ${metrics.system.cpu.toFixed(1)}% (threshold: ${this.options.thresholds.cpu}%)`,
        value: metrics.system.cpu,
        threshold: this.options.thresholds.cpu
      });
    }
    
    // Memory threshold
    if (metrics.system.memory.percent > this.options.thresholds.memory) {
      alerts.push({
        type: 'memory',
        level: 'warning',
        message: `Memory usage is ${metrics.system.memory.percent.toFixed(1)}% (threshold: ${this.options.thresholds.memory}%)`,
        value: metrics.system.memory.percent,
        threshold: this.options.thresholds.memory
      });
    }
    
    // Service health alerts
    Object.entries(metrics.services).forEach(([service, health]) => {
      if (health.status === 'unhealthy') {
        alerts.push({
          type: 'service',
          level: 'error',
          message: `Service ${service} is unhealthy: ${health.error || 'Unknown error'}`,
          service,
          error: health.error
        });
      }
      
      if (health.responseTime > this.options.thresholds.responseTime) {
        alerts.push({
          type: 'response_time',
          level: 'warning',
          message: `Service ${service} response time is ${health.responseTime}ms (threshold: ${this.options.thresholds.responseTime}ms)`,
          service,
          value: health.responseTime,
          threshold: this.options.thresholds.responseTime
        });
      }
    });
    
    return alerts;
  }

  // Format bytes
  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  // Display metrics in console format
  displayMetrics(metrics, alerts = []) {
    logHeader('System Health Check');
    
    // System metrics
    log('\nSystem Metrics:', 'blue');
    logMetric('CPU Usage', `${metrics.system.cpu.toFixed(1)}%`, '', 
      metrics.system.cpu > this.options.thresholds.cpu ? 'warning' : 'success');
    logMetric('Memory Usage', `${metrics.system.memory.percent.toFixed(1)}%`, 
      ` (${this.formatBytes(metrics.system.memory.used)}/${this.formatBytes(metrics.system.memory.total)})`,
      metrics.system.memory.percent > this.options.thresholds.memory ? 'warning' : 'success');
    logMetric('Load Average (1m)', metrics.system.load['1min'].toFixed(2), '',
      metrics.system.load.normalized['1min'] > 80 ? 'warning' : 'success');
    logMetric('Process Uptime', `${Math.floor(metrics.system.process.uptime)}s`);
    logMetric('Process Memory', this.formatBytes(metrics.system.process.memory.rss));
    
    // Service health
    log('\nService Health:', 'blue');
    Object.entries(metrics.services).forEach(([service, health]) => {
      const status = health.status === 'healthy' ? 'success' : 'error';
      logMetric(`${service.charAt(0).toUpperCase() + service.slice(1)}`, 
        health.status.toUpperCase(), 
        health.responseTime ? ` (${health.responseTime}ms)` : '',
        status);
      
      if (health.error) {
        logError(`  Error: ${health.error}`);
      }
    });
    
    // Alerts
    if (alerts.length > 0) {
      log('\nAlerts:', 'red');
      alerts.forEach(alert => {
        const icon = alert.level === 'error' ? '❌' : '⚠️';
        log(`${icon} ${alert.message}`, alert.level === 'error' ? 'red' : 'yellow');
      });
    } else {
      log('\n✅ No alerts', 'green');
    }
    
    log(`\nLast updated: ${metrics.timestamp}`, 'cyan');
  }

  // Save metrics to file
  async saveMetrics(metrics, alerts = []) {
    const outputDir = path.dirname(this.options.output);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const data = {
      ...metrics,
      alerts
    };
    
    let output = '';
    
    switch (this.options.format) {
      case 'json':
        output = JSON.stringify(data, null, 2) + '\n';
        break;
      case 'csv':
        // Simplified CSV format
        if (!fs.existsSync(this.options.output)) {
          output = 'timestamp,cpu,memory,app_status,db_status,redis_status,alerts\n';
        }
        output += `${metrics.timestamp},${metrics.system.cpu.toFixed(1)},${metrics.system.memory.percent.toFixed(1)},${metrics.services.app?.status || 'unknown'},${metrics.services.database?.status || 'unknown'},${metrics.services.redis?.status || 'unknown'},${alerts.length}\n`;
        break;
      default:
        output = `[${metrics.timestamp}] CPU: ${metrics.system.cpu.toFixed(1)}% | Memory: ${metrics.system.memory.percent.toFixed(1)}% | Alerts: ${alerts.length}\n`;
        break;
    }
    
    fs.appendFileSync(this.options.output, output);
  }

  // Generate monitoring report
  async generateReport() {
    logHeader('Generating Monitoring Report');
    
    const reportPath = path.join(path.dirname(this.options.output), 'monitoring-report.html');
    
    // Collect current metrics
    const metrics = await this.collectMetrics();
    const alerts = this.checkThresholds(metrics);
    
    // Read historical data if available
    let historicalData = [];
    if (fs.existsSync(this.options.output)) {
      try {
        const logContent = fs.readFileSync(this.options.output, 'utf8');
        // Parse log entries (simplified)
        historicalData = logContent.split('\n')
          .filter(line => line.trim())
          .slice(-100) // Last 100 entries
          .map(line => {
            try {
              return JSON.parse(line);
            } catch {
              return null;
            }
          })
          .filter(Boolean);
      } catch (error) {
        logWarning(`Could not read historical data: ${error.message}`);
      }
    }
    
    // Generate HTML report
    const html = this.generateHTMLReport(metrics, alerts, historicalData);
    fs.writeFileSync(reportPath, html);
    
    logSuccess(`Report generated: ${reportPath}`);
    return reportPath;
  }

  // Generate HTML report
  generateHTMLReport(metrics, alerts, historicalData) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GeekSuitePro Monitoring Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric-card { background: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid #007bff; }
        .metric-value { font-size: 24px; font-weight: bold; color: #333; }
        .metric-label { color: #666; font-size: 14px; }
        .status-healthy { color: #28a745; }
        .status-unhealthy { color: #dc3545; }
        .status-warning { color: #ffc107; }
        .alerts { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 15px; margin-bottom: 20px; }
        .alert-item { margin: 5px 0; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>GeekSuitePro Monitoring Report</h1>
            <p>Generated on ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-label">CPU Usage</div>
                <div class="metric-value ${metrics.system.cpu > this.options.thresholds.cpu ? 'status-warning' : 'status-healthy'}">
                    ${metrics.system.cpu.toFixed(1)}%
                </div>
            </div>
            
            <div class="metric-card">
                <div class="metric-label">Memory Usage</div>
                <div class="metric-value ${metrics.system.memory.percent > this.options.thresholds.memory ? 'status-warning' : 'status-healthy'}">
                    ${metrics.system.memory.percent.toFixed(1)}%
                </div>
            </div>
            
            <div class="metric-card">
                <div class="metric-label">Application Status</div>
                <div class="metric-value ${metrics.services.app?.status === 'healthy' ? 'status-healthy' : 'status-unhealthy'}">
                    ${metrics.services.app?.status?.toUpperCase() || 'UNKNOWN'}
                </div>
            </div>
            
            <div class="metric-card">
                <div class="metric-label">Database Status</div>
                <div class="metric-value ${metrics.services.database?.status === 'healthy' ? 'status-healthy' : 'status-unhealthy'}">
                    ${metrics.services.database?.status?.toUpperCase() || 'UNKNOWN'}
                </div>
            </div>
        </div>
        
        ${alerts.length > 0 ? `
        <div class="alerts">
            <h3>Active Alerts</h3>
            ${alerts.map(alert => `<div class="alert-item">⚠️ ${alert.message}</div>`).join('')}
        </div>
        ` : '<div class="alerts"><h3>✅ No Active Alerts</h3></div>'}
        
        <div class="footer">
            <p>GeekSuitePro Monitoring System | Last updated: ${metrics.timestamp}</p>
        </div>
    </div>
</body>
</html>`;
  }
}

// Main monitoring function
async function runMonitoring(options) {
  const monitor = new SystemMonitor(options);
  
  switch (options.mode) {
    case 'check':
      logInfo('Running single health check...');
      const metrics = await monitor.collectMetrics();
      const alerts = monitor.checkThresholds(metrics);
      
      monitor.displayMetrics(metrics, alerts);
      
      if (options.output) {
        await monitor.saveMetrics(metrics, alerts);
      }
      break;
      
    case 'watch':
      logInfo(`Starting continuous monitoring (interval: ${options.interval}s)`);
      logInfo('Press Ctrl+C to stop monitoring\n');
      
      const watchInterval = setInterval(async () => {
        try {
          const metrics = await monitor.collectMetrics();
          const alerts = monitor.checkThresholds(metrics);
          
          if (options.format === 'console') {
            console.clear();
            monitor.displayMetrics(metrics, alerts);
          }
          
          if (options.output) {
            await monitor.saveMetrics(metrics, alerts);
          }
          
          if (options.alerts && alerts.length > 0) {
            // In a real implementation, you would send notifications here
            logWarning(`${alerts.length} alert(s) detected!`);
          }
        } catch (error) {
          logError(`Monitoring error: ${error.message}`);
        }
      }, options.interval * 1000);
      
      // Handle graceful shutdown
      process.on('SIGINT', () => {
        clearInterval(watchInterval);
        logInfo('\nMonitoring stopped');
        process.exit(0);
      });
      break;
      
    case 'report':
      await monitor.generateReport();
      break;
      
    case 'alert':
      const currentMetrics = await monitor.collectMetrics();
      const currentAlerts = monitor.checkThresholds(currentMetrics);
      
      if (currentAlerts.length > 0) {
        logWarning(`Found ${currentAlerts.length} alert(s):`);
        currentAlerts.forEach(alert => {
          logError(alert.message);
        });
        process.exit(1);
      } else {
        logSuccess('No alerts detected');
      }
      break;
      
    default:
      logError(`Unknown mode: ${options.mode}`);
      process.exit(1);
  }
}

// Main function
async function main() {
  try {
    const options = parseArgs();
    await runMonitoring(options);
  } catch (error) {
    logError(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGTERM', () => {
  log('\nMonitoring terminated', 'yellow');
  process.exit(0);
});

// Run the main function
if (require.main === module) {
  main();
}

module.exports = {
  SystemMonitor,
  runMonitoring,
  parseArgs
};
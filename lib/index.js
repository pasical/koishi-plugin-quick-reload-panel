'use strict'

const { Schema } = require('koishi')
const { resolve } = require('node:path')

exports.name = 'quick-reload-panel'
exports.inject = ['console', 'server']
exports.Config = Schema.object({})

exports.apply = function apply(ctx) {
  const logger = ctx.logger('quick-reload-panel')
  const startTime = Date.now()

  ctx.console.addEntry(process.env.KOISHI_BASE ? [
    process.env.KOISHI_BASE + '/dist/index.js',
    process.env.KOISHI_BASE + '/dist/style.css',
  ] : {
    dev: resolve(__dirname, '../../../node_modules/koishi-plugin-quick-reload-panel/dist/index.js'),
    prod: resolve(__dirname, '../../../node_modules/koishi-plugin-quick-reload-panel/dist'),
  })
  logger.info('console entry registered: quick-reload-panel')

  // HTTP API endpoints
  ctx.server.get('/quick-reload/status', (koa) => {
    koa.body = { ok: true, pid: process.pid, startTime }
  })

  // Commands
  ctx.command('reload', '快速重启机器人', { authority: 3 })
    .action(async ({ session }) => {
      logger.warn('quick-reload triggered by command');
      try {
        const msgIds = await session.send('reloading...');
        setTimeout(async () => {
          try {
            if (msgIds && msgIds.length) {
              await session.bot.deleteMessage(session.channelId, msgIds[0]);
            }
          } catch (e) {}
          const exitCode = Number(ctx.loader?.constructor?.exitCode) || 51;
          process.exit(exitCode);
        }, 3000);
      } catch (e) {
        const exitCode = Number(ctx.loader?.constructor?.exitCode) || 51;
        process.exit(exitCode);
      }
    })

  ctx.command('uptime', '查询机器人运行时间和启动时间')
    .alias('启动时间')
    .action(() => {
      const diff = Date.now() - startTime;
      const m = Math.floor(diff / 60000) % 60;
      const h = Math.floor(diff / 3600000) % 24;
      const d = Math.floor(diff / 86400000);
      return `运行时间: ${d} 天 ${h} 时 ${m} 分\n上次启动: ${new Date(startTime).toLocaleString('zh-CN')}`;
    })

  ctx.server.post('/quick-reload/trigger', (koa) => {
    logger.warn('quick-reload triggered')
    const exitCode = Number(ctx.loader?.constructor?.exitCode) || 51
    setTimeout(() => process.exit(exitCode), 300)
    koa.status = 200
  })

  // Fallback standalone UI (for manual testing, no console integration needed)
  ctx.server.get('/quick-reload/ui', (koa) => {
    koa.type = 'html'
    koa.body = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>快速重启</title>
<style>
body { font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 60px auto; padding: 20px; }
h1 { color: #333; margin: 0 0 10px; }
p { color: #666; margin: 0 0 20px; }
button { padding: 10px 20px; background: #f56c6c; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; font-weight: 500; }
button:disabled { opacity: 0.5; cursor: not-allowed; }
button:hover:not(:disabled) { background: #f88888; }
.status { margin-top: 20px; padding: 15px; background: #f5f7fa; border-radius: 4px; border-left: 4px solid #409eff; font-size: 13px; font-family: monospace; }
.status.success { border-left-color: #67c23a; background: #f0f9ff; }
.status.error { border-left-color: #f56c6c; background: #fef0f0; }
</style></head>
<body>
<h1>快速重启</h1>
<p>用于本地开发。点击按钮重启应用（容器会自动重启）</p>
<button id="btn" onclick="trigger()">立即重启</button>
<div class="status" id="info">正在加载...</div>

<script>
async function fetchStatus() {
  try {
    const r = await fetch('/quick-reload/status');
    const d = await r.json();
    document.getElementById('info').textContent = 'PID: ' + d.pid + ' | 启动时间: ' + new Date(d.startTime).toLocaleString('zh-CN');
  } catch (e) {
    document.getElementById('info').textContent = '⚠ 无法连接: ' + e.message;
    document.getElementById('info').className = 'status error';
  }
}

async function trigger() {
  const btn = document.getElementById('btn');
  btn.disabled = true;
  btn.textContent = '重启中...';
  try {
    await fetch('/quick-reload/trigger', { method: 'POST' });
    document.getElementById('info').textContent = '✓ 重启中，页面将在 3 秒后刷新...';
    document.getElementById('info').className = 'status success';
    setTimeout(() => location.reload(), 3000);
  } catch (e) {
    document.getElementById('info').textContent = '✗ 错误: ' + e.message;
    document.getElementById('info').className = 'status error';
    btn.disabled = false;
    btn.textContent = '立即重启';
  }
}

fetchStatus();
setInterval(fetchStatus, 10000);
</script></body></html>`
  })
}


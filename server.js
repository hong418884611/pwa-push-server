/**
 * PWA 推送通知服务端
 * 支持定时推送功能
 */

const express = require('express');
const webpush = require('web-push');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// VAPID 密钥配置
const VAPID_PUBLIC_KEY = 'BKPscGetiA40BWBQyWkcnaL7Evpy_fZ62JjYt_AM8Z7N7iORHx1P7ulwVFDHQMjx3hjeZqORSDyYtBug4x8PPeE';
const VAPID_PRIVATE_KEY = 'BmYUpKP3uUlSA89MUZb1uc5OneTOgCi__XX4SjQrR2Y';

webpush.setVapidDetails(
    'mailto:418884611@qq.com',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
);

// CORS 配置 - 允许所有来源
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'bypass-tunnel-reminder'],
    credentials: false
}));

// 处理预检请求
app.options('*', cors());

app.use(express.json());

// 存储订阅信息和定时任务
const subscriptions = new Map();
const scheduledPushes = [];

// 获取 VAPID 公钥
app.get('/api/vapid-public-key', (req, res) => {
    res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// 订阅推送
app.post('/api/subscribe', (req, res) => {
    const subscription = req.body;
    const id = Date.now().toString();
    subscriptions.set(id, subscription);
    console.log(`✅ 新订阅: ${id}`);
    res.json({ success: true, subscriptionId: id });
});

// 立即推送
app.post('/api/push', async (req, res) => {
    const { title, body, subscriptionId } = req.body;
    
    const payload = JSON.stringify({
        title: title || '📬 新消息',
        body: body || '你有一条新通知',
        timestamp: Date.now()
    });

    let sent = 0;
    let failed = 0;

    if (subscriptionId && subscriptions.has(subscriptionId)) {
        // 发送给指定订阅
        try {
            await webpush.sendNotification(subscriptions.get(subscriptionId), payload);
            sent++;
        } catch (err) {
            console.error('推送失败:', err);
            failed++;
            if (err.statusCode === 410) {
                subscriptions.delete(subscriptionId);
            }
        }
    } else {
        // 发送给所有订阅
        for (const [id, sub] of subscriptions) {
            try {
                await webpush.sendNotification(sub, payload);
                sent++;
            } catch (err) {
                console.error(`推送到 ${id} 失败:`, err);
                failed++;
                if (err.statusCode === 410) {
                    subscriptions.delete(id);
                }
            }
        }
    }

    res.json({ success: true, sent, failed });
});

// 定时推送
app.post('/api/schedule-push', (req, res) => {
    const { title, body, scheduledTime, subscriptionId } = req.body;
    
    const pushTime = new Date(scheduledTime);
    const now = new Date();
    const delay = pushTime.getTime() - now.getTime();

    if (delay <= 0) {
        return res.status(400).json({ error: '推送时间必须是未来时间' });
    }

    const taskId = Date.now().toString();
    
    const timer = setTimeout(async () => {
        console.log(`⏰ 定时推送触发: ${taskId}`);
        
        const payload = JSON.stringify({
            title: title || '⏰ 定时提醒',
            body: body || '这是你设置的定时推送！',
            timestamp: Date.now()
        });

        if (subscriptionId && subscriptions.has(subscriptionId)) {
            try {
                await webpush.sendNotification(subscriptions.get(subscriptionId), payload);
                console.log(`✅ 定时推送成功: ${taskId}`);
            } catch (err) {
                console.error(`❌ 定时推送失败: ${taskId}`, err);
            }
        } else {
            for (const [id, sub] of subscriptions) {
                try {
                    await webpush.sendNotification(sub, payload);
                    console.log(`✅ 推送到 ${id} 成功`);
                } catch (err) {
                    console.error(`❌ 推送到 ${id} 失败`, err);
                }
            }
        }

        // 移除已执行的任务
        const idx = scheduledPushes.findIndex(t => t.id === taskId);
        if (idx !== -1) scheduledPushes.splice(idx, 1);
    }, delay);

    scheduledPushes.push({
        id: taskId,
        timer,
        scheduledTime: pushTime.toISOString(),
        title,
        body
    });

    console.log(`📅 定时推送已创建: ${taskId}, 将在 ${pushTime.toLocaleString()} 触发`);

    res.json({
        success: true,
        taskId,
        message: `推送已安排在 ${pushTime.toLocaleString()}`,
        scheduledTime: pushTime.toISOString(),
        delaySeconds: Math.round(delay / 1000)
    });
});

// 查看定时任务
app.get('/api/scheduled', (req, res) => {
    res.json({
        tasks: scheduledPushes.map(t => ({
            id: t.id,
            scheduledTime: t.scheduledTime,
            title: t.title
        })),
        subscriptionCount: subscriptions.size
    });
});

// 取消定时任务
app.delete('/api/scheduled/:id', (req, res) => {
    const idx = scheduledPushes.findIndex(t => t.id === req.params.id);
    if (idx !== -1) {
        clearTimeout(scheduledPushes[idx].timer);
        scheduledPushes.splice(idx, 1);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: '任务不存在' });
    }
});

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        time: new Date().toISOString(),
        subscriptions: subscriptions.size,
        scheduledTasks: scheduledPushes.length
    });
});

// 首页
app.get('/', (req, res) => {
    res.json({
        name: 'PWA Push Server',
        version: '1.0.0',
        endpoints: {
            'GET /api/vapid-public-key': '获取 VAPID 公钥',
            'POST /api/subscribe': '订阅推送',
            'POST /api/push': '立即推送',
            'POST /api/schedule-push': '定时推送',
            'GET /api/scheduled': '查看定时任务',
            'DELETE /api/scheduled/:id': '取消定时任务'
        }
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Push Server running on port ${PORT}`);
    console.log(`📡 VAPID Public Key: ${VAPID_PUBLIC_KEY}`);
});

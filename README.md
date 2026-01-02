# PWA Push Server

推送通知后端服务，支持定时推送功能。

## 部署到 Render

1. 将此仓库推送到 GitHub
2. 访问 https://render.com 并登录
3. 点击 "New +" -> "Web Service"
4. 连接你的 GitHub 仓库
5. 设置如下：
   - Name: pwa-push-server
   - Runtime: Node
   - Build Command: npm install
   - Start Command: npm start
6. 点击 "Create Web Service"

## API 接口

- `GET /api/health` - 健康检查
- `GET /api/vapid-public-key` - 获取 VAPID 公钥
- `POST /api/subscribe` - 订阅推送
- `POST /api/push` - 立即推送
- `POST /api/schedule-push` - 定时推送
- `GET /api/scheduled` - 查看定时任务
- `DELETE /api/scheduled/:id` - 取消定时任务

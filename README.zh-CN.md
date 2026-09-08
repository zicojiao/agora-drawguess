<div align="center">

<img src="./public/draw-and-guess-logo-1024.png" alt="Draw & Guess" width="128" />

# Draw & Guess

**画出来，猜出来，再击败 FastH3。**

一个实时多人你画我猜游戏。AI 挑战者只有在猜对画作，并生成通过视觉验证的视频证明后，才算获胜。

[English](./README.md) · **简体中文**

[在线体验](https://drawguess.app)

</div>

![Draw & Guess 多人游戏与 FastH3 视频证明](./public/og-draw-and-guess.png)

## 核心能力

- 六位房间码、玩家准备、房主控制、轮流作画、计时与计分。
- Agora Interactive Whiteboard 实时同步画笔、图形、颜色、撤销和清屏。
- Agora RTC 语音通话，以及向房间内所有玩家同步 FastH3 证明视频。
- Agora RTM 负责低延迟房间刷新信号，Cloudflare D1 保存权威游戏状态。
- OpenAI 或兼容视觉模型负责看图猜词，并验证 FastH3 生成的视频帧。
- 空白画板保护、短期令牌、请求限流、SEO 元数据与可选 PostHog 分析。

## 本地运行

要求 Node.js 22+、pnpm 11、Cloudflare、Agora Whiteboard、Agora RTC/RTM 和一个视觉模型 API。

```bash
git clone https://github.com/zicojiao/soundoff.git draw-and-guess
cd draw-and-guess
pnpm install
cp .env.example .env.local
cp .dev.vars.example .dev.vars
cp wrangler.example.jsonc wrangler.jsonc
pnpm db:migrate:local
pnpm dev
```

浏览器变量写入 `.env.local`，Agora 证书、Whiteboard AK/SK 和模型密钥写入 `.dev.vars`。不要给服务端密钥添加 `VITE_` 前缀，因为 Vite 会把它们打进浏览器代码。

完整配置、架构、部署和 FastH3 验证流程请阅读 [English README](./README.md) 与 [架构文档](./docs/architecture.md)。

## 常用命令

```bash
pnpm dev
pnpm test
pnpm typecheck
pnpm build
pnpm deploy
```

## 安全与贡献

请勿提交 `.env.local`、`.dev.vars` 或生产 `wrangler.jsonc`。安全问题请参考 [SECURITY.md](./SECURITY.md)，贡献流程请参考 [CONTRIBUTING.md](./CONTRIBUTING.md)。

本项目基于 [MIT License](./LICENSE) 开源。

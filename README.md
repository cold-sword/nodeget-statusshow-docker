# NodeGet-StatusShow Docker

> [NodeGet-StatusShow](https://github.com/NodeSeekDev/NodeGet-StatusShow) 的第三方 Docker 镜像，自动跟随上游版本同步构建。  
> Third-party Docker image for [NodeGet-StatusShow](https://github.com/NodeSeekDev/NodeGet-StatusShow), automatically synced with upstream releases.

[![GitHub Actions](https://img.shields.io/github/actions/workflow/status/cold-sword/nodeget-statusshow-docker/sync-build-push.yml?label=sync%20%26%20build&logo=github)](https://github.com/cold-sword/nodeget-statusshow-docker/actions)
[![Docker Pulls](https://img.shields.io/docker/pulls/coldsword/nodeget-statusshow?logo=docker)](https://hub.docker.com/r/coldsword/nodeget-statusshow)
[![Image Version](https://img.shields.io/docker/v/coldsword/nodeget-statusshow?sort=semver&logo=docker)](https://hub.docker.com/r/coldsword/nodeget-statusshow/tags)

---

## 简介 / Introduction

**中文**

[NodeGet-StatusShow](https://github.com/NodeSeekDev/NodeGet-StatusShow) 是 [NodeGet](https://github.com/NodeSeekDev/NodeGet) 的公开探针展示页，以实时方式展示服务器状态、资源占用与基础设施概览。NodeGet 是一款基于 Rust 编写的新一代服务器监控与管理工具。

本仓库提供开箱即用的 Docker 镜像，通过 GitHub Actions 自动追踪上游 Release 并构建推送，无需手动维护。

**English**

[NodeGet-StatusShow](https://github.com/NodeSeekDev/NodeGet-StatusShow) is the public status page for [NodeGet](https://github.com/NodeSeekDev/NodeGet) — a next-generation server monitoring and management tool written in Rust. It displays real-time server status, resource usage, and infrastructure overview.

This repository provides a ready-to-use Docker image, automatically built and pushed via GitHub Actions whenever a new upstream release is published.

---

## 快速部署 / Quick Deploy

### 前置要求 / Prerequisites

- Docker `20.10+` 与 Docker Compose `v2.0+`
- 一个运行中的 NodeGet Server 实例 / A running NodeGet Server instance

### 1. 准备配置文件 / Prepare Config File

```bash
mkdir nodeget-statusshow && cd nodeget-statusshow
```

**`config.json`**（单节点 / Single node）

```json
{
  "site_name": "我的探针页",
  "site_logo": "",
  "footer": "Powered by NodeGet",
  "site_tokens": [
    {
      "name": "主节点",
      "backend_url": "wss://your-nodeget-server.example.com",
      "token": "your-token-here"
    }
  ]
}
```

多节点在 `site_tokens` 数组中追加对象即可 / For multiple nodes, append more objects:

```json
{
  "site_tokens": [
    { "name": "Node 1", "backend_url": "wss://node1.example.com", "token": "token-1" },
    { "name": "Node 2", "backend_url": "wss://node2.example.com", "token": "token-2" }
  ]
}
```

| 字段 / Field | 说明 / Description |
|---|---|
| `site_name` | 页面标题 / Page title |
| `site_logo` | Logo URL，留空不显示 / Leave empty to hide |
| `footer` | 页脚文本 / Footer text |
| `site_tokens[].name` | 节点显示名称 / Node display name |
| `site_tokens[].backend_url` | NodeGet Server WebSocket 地址 / WebSocket URL |
| `site_tokens[].token` | 访问 Token / Access token |

### 2. docker-compose.yml

```yaml
name: statusshow

services:
  nodeget-statusshow:
    image: ${STATUSSHOW_IMAGE:-coldsword/nodeget-statusshow:latest}
    restart: unless-stopped
    ports:
      - "${STATUS_HOST_PORT:-3000}:3000"
    volumes:
      - ./config.json:/app/config.json:ro
```

### 3. .env

```dotenv
STATUSSHOW_IMAGE=coldsword/nodeget-statusshow:latest
# 或 GHCR / Or GHCR:
# STATUSSHOW_IMAGE=ghcr.io/cold-sword/nodeget-statusshow:latest

STATUS_HOST_PORT=3000
```

### 4. 启动与更新 / Start & Update

```bash
# 首次启动 / First start
docker compose up -d

# 查看日志 / View logs
docker compose logs -f

# 修改 config.json 后重启 / Restart after config change
docker compose restart nodeget-statusshow

# 拉取新镜像并更新 / Pull new image and update
docker compose pull && docker compose up -d
```

---

## 本地构建 / Local Build

```bash
git clone https://github.com/cold-sword/nodeget-statusshow-docker.git
cd nodeget-statusshow-docker

# 构建镜像 / Build image
docker build \
  --build-arg STATUSSHOW_REF=main \
  -t nodeget-statusshow:local \
  ./statusshow

# 指定版本 / With specific version
docker build \
  --build-arg STATUSSHOW_REF=v1.3.2 \
  -t nodeget-statusshow:v1.3.2 \
  ./statusshow
```

| 构建参数 / ARG | 默认值 / Default | 说明 / Description |
|---|---|---|
| `STATUSSHOW_REPO` | `https://github.com/NodeSeekDev/NodeGet-StatusShow.git` | 上游仓库 / Upstream repo |
| `STATUSSHOW_REF` | `main` | 分支或 Tag / Branch or tag |

构建完成后，将 `docker-compose.yml` 中的 `image` 替换为本地镜像名称即可。  
After building, replace `image` in `docker-compose.yml` with your local image name.

---

## 反向代理 / Reverse Proxy

> **说明 / Note**：探针页由浏览器直接与 NodeGet Server 建立 WebSocket 连接，反向代理只提供静态文件，**无需**对本容器做 WebSocket 代理。  
> The browser connects to NodeGet Server via WebSocket directly. The reverse proxy only serves static files — **no WebSocket proxying** to this container needed.

### Nginx

```nginx
server {
    listen 80;
    server_name status.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name status.example.com;

    ssl_certificate     /etc/ssl/certs/status.example.com.crt;
    ssl_certificate_key /etc/ssl/private/status.example.com.key;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```

### Caddy

```caddyfile
status.example.com {
    reverse_proxy localhost:3000
}
```

### Traefik（Docker Labels）

```yaml
services:
  nodeget-statusshow:
    image: coldsword/nodeget-statusshow:latest
    restart: unless-stopped
    volumes:
      - ./config.json:/app/config.json:ro
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.statusshow.rule=Host(`status.example.com`)"
      - "traefik.http.routers.statusshow.entrypoints=websecure"
      - "traefik.http.routers.statusshow.tls.certresolver=letsencrypt"
      - "traefik.http.services.statusshow.loadbalancer.server.port=3000"
```

---

## 相关链接 / Related Links

| 资源 / Resource | 链接 / Link |
|---|---|
| 📦 NodeGet-StatusShow 上游仓库 | [NodeSeekDev/NodeGet-StatusShow](https://github.com/NodeSeekDev/NodeGet-StatusShow) |
| ⚙️ NodeGet 后端 | [NodeSeekDev/NodeGet](https://github.com/NodeSeekDev/NodeGet) |
| 🖥️ NodeGet Dashboard | [NodeSeekDev/NodeGet-board](https://github.com/NodeSeekDev/NodeGet-board) |
| 📖 官方文档 / Official Docs | [nodeget.com](https://nodeget.com) |
| 💬 Telegram 频道 / Channel | [@NodeGetProject](https://t.me/NodeGetProject) |
| 💬 Telegram 讨论组 / Group | [@NodegetGroup](https://t.me/NodegetGroup) |
| 🌐 NodeSeek 社区 / Community | [nodeseek.com](https://nodeseek.com) |
| 🐳 DockerHub | [coldsword/nodeget-statusshow](https://hub.docker.com/r/coldsword/nodeget-statusshow) |
| 📦 GHCR | [ghcr.io/cold-sword/nodeget-statusshow](https://ghcr.io/cold-sword/nodeget-statusshow) |

---

## 致谢 / Credits

本项目构建于 [NodeSeekDev/NodeGet-StatusShow](https://github.com/NodeSeekDev/NodeGet-StatusShow) 之上，前端代码著作权归原作者所有。  
This project builds upon [NodeSeekDev/NodeGet-StatusShow](https://github.com/NodeSeekDev/NodeGet-StatusShow). All frontend code copyright belongs to the original authors.

## License

本仓库的 Docker 打包脚本与 CI 配置以 [MIT License](LICENSE) 发布。  
The Docker packaging scripts and CI configuration are released under the [MIT License](LICENSE).  
The bundled NodeGet-StatusShow frontend follows its own upstream license.

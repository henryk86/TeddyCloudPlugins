# TeddyCloud Kids UI - Standalone Docker Deployment

Run the TeddyCloud Kids UI as a standalone web app, perfect for kids' tablets.

## Quick Start

1. **Set your TeddyCloud URL:**
   ```bash
   export TEDDYCLOUD_URL=http://192.168.1.100:80
   ```

2. **Start the container:**
   ```bash
   cd plugins/TeddycloudKidsUI/docker
   docker compose up -d
   ```

3. **Access the app:**
   Open `http://localhost:8080` in your browser.

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TEDDYCLOUD_URL` | `http://teddycloud:80` | URL of your TeddyCloud instance (no trailing slash) |

### Using .env file

Create a `.env` file in the docker directory:
```env
TEDDYCLOUD_URL=http://192.168.1.100:80
```

### Changing the port

Edit `docker-compose.yml` and change the port mapping:
```yaml
ports:
  - "3000:80"  # Access via port 3000 instead of 8080
```

## Network Configuration

### Option 1: TeddyCloud on same Docker host

If TeddyCloud runs in Docker on the same host, connect to its network:

```yaml
# docker-compose.yml
services:
  teddycloud-kids-ui:
    # ... other config ...
    environment:
      - TEDDYCLOUD_URL=http://teddycloud:80

networks:
  default:
    external: true
    name: teddycloud_default  # or your TeddyCloud network name
```

### Option 2: TeddyCloud on different host

Use the IP address or hostname:
```bash
export TEDDYCLOUD_URL=http://192.168.1.100:80
docker compose up -d
```

## Building the Image

```bash
cd plugins/TeddycloudKidsUI/docker
docker compose build
```

Or build manually:
```bash
cd plugins/TeddycloudKidsUI
docker build -f docker/Dockerfile -t teddycloud-kids-ui:latest .
```

## Use Case: Kids Tablet Setup

1. Deploy the container on your home server
2. On the tablet, open Chrome/Safari and go to the app URL
3. Add to home screen (creates an app-like icon)
4. Kids get a full-screen, simple interface without TeddyCloud admin menus

## Troubleshooting

### API requests fail (CORS errors)

The nginx proxy should handle CORS. If you see errors:
- Check that `TEDDYCLOUD_URL` is correct and reachable
- Verify TeddyCloud is running
- Check container logs: `docker compose logs -f`

### Container won't start

Check logs:
```bash
docker compose logs teddycloud-kids-ui
```

### Health check failing

Verify the container is running:
```bash
docker compose ps
curl http://localhost:8080/health
```

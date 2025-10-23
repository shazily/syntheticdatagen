# 🚀 Deployment Guide

This guide covers deploying the Synthetic Data Generator platform in various environments.

## 📋 Prerequisites

### Required Software
- **Docker** (v20.10+)
- **Docker Compose** (v2.0+)
- **Git** (for cloning repository)

### Required Services
- **n8n** (workflow automation)
- **Ollama** (AI model inference)
- **Qdrant** (vector database, optional)

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────┐
│   Frontend      │    │     n8n      │    │   Ollama    │
│   (Nginx)       │◄──►│  Workflows   │◄──►│    LLM      │
│   Port: 80/443  │    │  Port: 5678  │    │ Port: 11434 │
└─────────────────┘    └──────────────┘    └─────────────┘
         │                       │
         │                       ▼
         │                ┌─────────────┐
         │                │   Qdrant     │
         └───────────────►│ Vector DB   │
                          │ Port: 6333  │
                          └─────────────┘
```

## 🚀 Quick Deployment

### 1. Clone Repository
```bash
git clone https://github.com/yourusername/synthetic-data-generator.git
cd synthetic-data-generator
```

### 2. Start Core Services
```bash
# Start the main application
docker-compose up -d

# Verify containers are running
docker ps
```

### 3. Configure n8n Workflows
1. Open n8n: http://localhost:5678
2. Import workflows from `n8n-workflows/`:
   - `intelligent-generator-v3-dev-RAG-ENHANCED.json`
   - `simple-generator.json`
3. Activate both workflows

### 4. Setup Ollama
```bash
# Install Ollama (if not already installed)
curl -fsSL https://ollama.ai/install.sh | sh

# Pull the required model
ollama pull llama3.2:latest

# Verify installation
ollama list
```

### 5. Configure n8n → Ollama Connection
1. Open n8n workflow: "Intelligent Generator"
2. Click on "Ollama Chat Model" node
3. Set credentials:
   - **Base URL**: `http://localhost:11434`
   - **Model**: `llama3.2:latest`
4. Save and test

### 6. Access Application
- **Frontend**: http://localhost
- **n8n**: http://localhost:5678
- **Ollama**: http://localhost:11434

## 🔧 Environment-Specific Deployments

### Development Environment

**File:** `docker-compose.yml`
```yaml
version: '3.8'
services:
  synthetic-data-web:
    build: .
    ports:
      - "3006:80"  # Dev port
    volumes:
      - ./frontend-v3:/usr/share/nginx/html
    environment:
      - NODE_ENV=development
```

**Start:**
```bash
docker-compose up -d
```

### Production Environment

**File:** `docker-compose.prod.yml`
```yaml
version: '3.8'
services:
  synthetic-data-web:
    build: .
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./frontend:/usr/share/nginx/html
      - ./ssl:/etc/nginx/ssl
    environment:
      - NODE_ENV=production
    restart: unless-stopped
```

**Start:**
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Staging Environment

**File:** `docker-compose.staging.yml`
```yaml
version: '3.8'
services:
  synthetic-data-web:
    build: .
    ports:
      - "3005:80"
    volumes:
      - ./frontend:/usr/share/nginx/html
    environment:
      - NODE_ENV=staging
```

## 🌐 Cloud Deployment

### AWS Deployment

#### Using EC2
1. **Launch EC2 Instance:**
   - AMI: Ubuntu 20.04 LTS
   - Instance Type: t3.medium (2 vCPU, 4 GB RAM)
   - Security Groups: Allow ports 22, 80, 443, 5678, 11434

2. **Install Dependencies:**
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   sudo usermod -aG docker ubuntu
   
   # Install Docker Compose
   sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

3. **Deploy Application:**
   ```bash
   # Clone repository
   git clone https://github.com/yourusername/synthetic-data-generator.git
   cd synthetic-data-generator
   
   # Start services
   docker-compose up -d
   ```

#### Using ECS (Container Service)
1. **Create ECS Cluster**
2. **Build and Push Docker Image:**
   ```bash
   # Build image
   docker build -t synthetic-data-generator .
   
   # Tag for ECR
   docker tag synthetic-data-generator:latest your-account.dkr.ecr.region.amazonaws.com/synthetic-data-generator:latest
   
   # Push to ECR
   docker push your-account.dkr.ecr.region.amazonaws.com/synthetic-data-generator:latest
   ```

3. **Create ECS Task Definition**
4. **Deploy Service**

### Google Cloud Platform

#### Using Compute Engine
1. **Create VM Instance:**
   - Machine Type: e2-standard-2
   - Boot Disk: Ubuntu 20.04 LTS
   - Firewall: Allow HTTP, HTTPS traffic

2. **Install Docker:**
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   ```

3. **Deploy:**
   ```bash
   git clone https://github.com/yourusername/synthetic-data-generator.git
   cd synthetic-data-generator
   docker-compose up -d
   ```

#### Using Cloud Run
1. **Build Container:**
   ```bash
   gcloud builds submit --tag gcr.io/PROJECT-ID/synthetic-data-generator
   ```

2. **Deploy to Cloud Run:**
   ```bash
   gcloud run deploy synthetic-data-generator \
     --image gcr.io/PROJECT-ID/synthetic-data-generator \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated
   ```

### Azure Deployment

#### Using Container Instances
1. **Create Resource Group:**
   ```bash
   az group create --name synthetic-data-rg --location eastus
   ```

2. **Deploy Container:**
   ```bash
   az container create \
     --resource-group synthetic-data-rg \
     --name synthetic-data-generator \
     --image your-registry/synthetic-data-generator:latest \
     --dns-name-label synthetic-data-generator \
     --ports 80
   ```

## 🔒 Security Configuration

### SSL/TLS Setup

#### Using Let's Encrypt
1. **Install Certbot:**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   ```

2. **Generate Certificates:**
   ```bash
   sudo certbot --nginx -d yourdomain.com
   ```

3. **Update nginx.conf:**
   ```nginx
   server {
       listen 443 ssl;
       server_name yourdomain.com;
       
       ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
       
       location / {
           root /usr/share/nginx/html;
           index index.html;
       }
   }
   ```

#### Using Custom Certificates
1. **Add certificates to `ssl/` directory:**
   ```
   ssl/
   ├── cert.pem
   ├── key.pem
   └── ca.pem (optional)
   ```

2. **Update docker-compose.yml:**
   ```yaml
   volumes:
     - ./ssl:/etc/nginx/ssl:ro
   ```

### Firewall Configuration

#### UFW (Ubuntu)
```bash
# Allow SSH
sudo ufw allow 22

# Allow HTTP/HTTPS
sudo ufw allow 80
sudo ufw allow 443

# Allow n8n (if external access needed)
sudo ufw allow 5678

# Enable firewall
sudo ufw enable
```

#### iptables
```bash
# Allow HTTP/HTTPS
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Save rules
iptables-save > /etc/iptables/rules.v4
```

## 📊 Monitoring & Logging

### Health Checks

#### Application Health
```bash
# Check container status
docker ps

# Check application logs
docker logs synthetic-data-web

# Test endpoints
curl http://localhost/health
curl http://localhost:5678/healthz
```

#### Service Health
```bash
# Test n8n webhooks
curl -X POST http://localhost:5678/webhook/generate-simple \
  -H "Content-Type: application/json" \
  -d '{"schema":[{"name":"test","type":"firstName"}],"recordCount":1}'

# Test Ollama
curl http://localhost:11434/api/tags
```

### Log Management

#### Docker Logs
```bash
# View all logs
docker-compose logs

# Follow logs
docker-compose logs -f

# View specific service logs
docker-compose logs synthetic-data-web
```

#### Log Rotation
```bash
# Configure logrotate
sudo nano /etc/logrotate.d/docker
```

**Content:**
```
/var/lib/docker/containers/*/*.log {
    rotate 7
    daily
    compress
    size=1M
    missingok
    delaycompress
    copytruncate
}
```

### Performance Monitoring

#### Resource Usage
```bash
# Monitor container resources
docker stats

# Monitor system resources
htop
```

#### Application Metrics
- **Response Time**: Monitor API response times
- **Throughput**: Track requests per second
- **Error Rate**: Monitor failed requests
- **Resource Usage**: CPU, memory, disk usage

## 🔄 Backup & Recovery

### Data Backup

#### Application Data
```bash
# Backup frontend files
tar -czf frontend-backup-$(date +%Y%m%d).tar.gz frontend/

# Backup n8n workflows
tar -czf n8n-workflows-backup-$(date +%Y%m%d).tar.gz n8n-workflows/

# Backup Qdrant data
tar -czf qdrant-backup-$(date +%Y%m%d).tar.gz qdrant_storage/
```

#### Database Backup
```bash
# Backup Qdrant collections
curl -X POST "http://localhost:6333/collections/backup" \
  -H "Content-Type: application/json" \
  -d '{"collection_name": "successful_schemas"}'
```

### Recovery Procedures

#### Full System Recovery
1. **Restore from backup:**
   ```bash
   # Stop services
   docker-compose down
   
   # Restore files
   tar -xzf frontend-backup-YYYYMMDD.tar.gz
   tar -xzf n8n-workflows-backup-YYYYMMDD.tar.gz
   
   # Start services
   docker-compose up -d
   ```

2. **Verify functionality:**
   ```bash
   # Test endpoints
   curl http://localhost/health
   curl http://localhost:5678/healthz
   ```

## 🚨 Troubleshooting

### Common Issues

#### Container Won't Start
```bash
# Check logs
docker logs synthetic-data-web

# Check configuration
docker-compose config

# Rebuild container
docker-compose build --no-cache
docker-compose up -d
```

#### Port Conflicts
```bash
# Check port usage
netstat -tulpn | grep :80

# Kill process using port
sudo kill -9 $(lsof -t -i:80)

# Change port in docker-compose.yml
```

#### Permission Issues
```bash
# Fix file permissions
sudo chown -R $USER:$USER .
sudo chmod -R 755 frontend/
```

### Performance Issues

#### High Memory Usage
```bash
# Monitor memory
docker stats

# Limit container memory
docker-compose.yml:
  deploy:
    resources:
      limits:
        memory: 512M
```

#### Slow Response Times
```bash
# Check nginx logs
docker logs synthetic-data-web

# Optimize nginx configuration
# Update nginx.conf with caching headers
```

## 📞 Support

### Getting Help
1. **Check logs** for error messages
2. **Review documentation** for common solutions
3. **Test individual components** (n8n, Ollama, Qdrant)
4. **Check GitHub Issues** for known problems
5. **Contact support** for enterprise issues

### Debug Mode
```bash
# Enable debug logging
export DEBUG=true
docker-compose up -d

# View detailed logs
docker-compose logs -f --tail=100
```

---

**For additional support, see the main [README.md](README.md) or contact the development team.**

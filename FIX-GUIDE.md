# WhatsApp Ticket System Fix Guide

## Problem
You're experiencing a YAML syntax error in your docker-compose.yaml file at line 11, column 46. This is preventing Docker Compose from starting or rebuilding your containers.

## Solution
Here are two methods to fix the issue:

### Method 1: Using the Fix Script (Recommended)

1. First, create the fix script on your VPS:
```bash
nano ~/whaticket/fix-script.sh
```

2. Copy and paste the contents of the `fix-script.sh` file from this repository.

3. Save the file (CTRL+O, then Enter) and exit (CTRL+X).

4. Make the script executable:
```bash
chmod +x ~/whaticket/fix-script.sh
```

5. Run the script:
```bash
cd ~/whaticket
./fix-script.sh
```

6. The script will:
   - Backup your existing docker-compose.yaml file
   - Create a new fixed docker-compose.yaml file
   - Create the logs directory with proper permissions
   - Stop all containers
   - Rebuild the backend container
   - Start all services
   - Check the container status
   - Create a test log entry

### Method 2: Manual Fix

If you prefer to fix the issue manually, follow these steps:

1. Backup your current docker-compose.yaml file:
```bash
cd ~/whaticket
cp docker-compose.yaml docker-compose.yaml.backup
```

2. Open the file for editing:
```bash
nano docker-compose.yaml
```

3. Replace the entire contents with the fixed docker-compose.yaml from this repository.

4. Save the file (CTRL+O, then Enter) and exit (CTRL+X).

5. Create the logs directory and set permissions:
```bash
mkdir -p ~/whaticket/backend/logs
chmod -R 777 ~/whaticket/backend/logs
touch ~/whaticket/backend/logs/debug.log
chmod 666 ~/whaticket/backend/logs/debug.log
```

6. Rebuild and restart the services:
```bash
cd ~/whaticket
docker-compose down
docker-compose build --no-cache backend
docker-compose up -d
```

## Verifying Everything Works

After fixing the issue and restarting the services, check that everything is working:

1. Check container status:
```bash
docker-compose ps
```

2. Check for log file creation:
```bash
ls -la ~/whaticket/backend/logs/
tail -f ~/whaticket/backend/logs/debug.log
```

3. Check Docker container logs:
```bash
docker-compose logs backend
```

4. Send a test message from WhatsApp number 595984848082 to your WhatsApp Business account and check if OpenAI responds.

## Troubleshooting

If you encounter issues after the fix:

1. Check if the containers are running:
```bash
docker-compose ps
```

2. Inspect the logs:
```bash
docker-compose logs backend
tail -f ~/whaticket/backend/logs/debug.log
```

3. If needed, restart specific services:
```bash
docker-compose restart backend
```

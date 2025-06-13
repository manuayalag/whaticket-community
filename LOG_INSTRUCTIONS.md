# WhatsApp Ticket System with OpenAI Integration - Instructions

## Log File Location

The system is configured to write detailed logs to the following location:

- In Docker container: `/usr/src/app/logs/debug.log`
- On your host system: `./backend/logs/debug.log` (relative to the project root)

## How to Check Logs

### Method 1: Access logs directly from the host system

```bash
# View the entire log file
cat ./backend/logs/debug.log

# Follow log updates in real-time
tail -f ./backend/logs/debug.log
```

### Method 2: Check logs from inside the Docker container

```bash
# Access the Docker container
docker exec -it wha-ticket_backend_1 sh

# View logs from inside the container
cat /usr/src/app/logs/debug.log

# Follow logs in real-time
tail -f /usr/src/app/logs/debug.log
```

### Method 3: View Docker container logs

```bash
# View backend container logs
docker logs wha-ticket_backend_1

# Follow backend container logs in real-time
docker logs -f wha-ticket_backend_1
```

## Restarting the System

If you need to restart the system, use these commands:

```bash
# Restart all containers
docker-compose restart

# Restart only the backend
docker-compose restart backend
```

## Testing the OpenAI Integration

The system is configured to process messages from the following WhatsApp number with OpenAI:
- Target number: `595984848082`

When a message is received from this number, it will be:
1. Logged in detail to the log file
2. Processed by OpenAI
3. A response will be sent back automatically

## Troubleshooting

If the logs aren't being created or updated, check:

1. Permissions on the logs directory: `chmod -R 777 ./backend/logs/`
2. That the Docker volume is correctly mounted: `docker-compose config`
3. If needed, create the debug.log file manually: `touch ./backend/logs/debug.log && chmod 666 ./backend/logs/debug.log`
4. Verify the environment variable is set: `docker exec wha-ticket_backend_1 printenv LOG_FILE_PATH`

If OpenAI isn't responding to messages, check:
1. OpenAI API key configuration in the database
2. Network connectivity from the container
3. Details in the logs about any API errors

#!/usr/bin/env node

// This is a simple script to help with debugging the WhatsApp ticket system
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Constants
const CONTAINER_NAME = 'wha-ticket_backend_1';
const LOG_FILE = './backend/logs/debug.log';

// Helper functions
function runCommand(command) {
  try {
    console.log(`Running command: ${command}`);
    const output = execSync(command, { encoding: 'utf-8' });
    console.log(output);
    return output;
  } catch (error) {
    console.error(`Error running command: ${command}`);
    console.error(error.message);
    return null;
  }
}

function checkLogFile() {
  // Check if log file exists
  if (fs.existsSync(LOG_FILE)) {
    console.log(`Log file exists at: ${path.resolve(LOG_FILE)}`);
    
    // Check file size
    const stats = fs.statSync(LOG_FILE);
    console.log(`Log file size: ${(stats.size / 1024).toFixed(2)} KB`);
    
    // Display last 10 lines
    console.log('\nLast 10 lines from log file:');
    const content = fs.readFileSync(LOG_FILE, 'utf-8');
    const lines = content.split('\n');
    console.log(lines.slice(-10).join('\n'));
    return true;
  } else {
    console.log(`Log file does not exist at: ${path.resolve(LOG_FILE)}`);
    return false;
  }
}

function viewLogs() {
  if (fs.existsSync(LOG_FILE)) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question('How many lines to display? [50]: ', (answer) => {
      const lines = parseInt(answer || '50');
      console.log(`\nDisplaying last ${lines} lines from log file:`);
      const content = fs.readFileSync(LOG_FILE, 'utf-8');
      const allLines = content.split('\n');
      console.log(allLines.slice(-lines).join('\n'));
      rl.close();
      showMenu();
    });
  } else {
    console.log('Log file does not exist. Please check your configuration.');
    showMenu();
  }
}

function checkDocker() {
  console.log('\nChecking Docker status...');
  runCommand('docker ps');
  
  console.log('\nChecking backend container status...');
  runCommand(`docker inspect --format='{{.State.Status}}' ${CONTAINER_NAME}`);
  
  console.log('\nChecking backend container environment variables...');
  runCommand(`docker exec ${CONTAINER_NAME} printenv LOG_FILE_PATH`);
  
  // Check logs directory in container
  console.log('\nChecking logs directory in container...');
  runCommand(`docker exec ${CONTAINER_NAME} ls -la /usr/src/app/logs`);
  
  console.log('\nChecking log file in container...');
  runCommand(`docker exec ${CONTAINER_NAME} ls -la /usr/src/app/logs/debug.log 2>/dev/null || echo "Log file not found in container"`);
}

function restartBackend() {
  console.log('Restarting backend container...');
  runCommand(`docker-compose restart backend`);
  console.log('Waiting for backend to restart (10 seconds)...');
  setTimeout(() => {
    console.log('Checking backend status after restart...');
    runCommand(`docker inspect --format='{{.State.Status}}' ${CONTAINER_NAME}`);
    showMenu();
  }, 10000);
}

function createLogDirs() {
  console.log('Creating log directories and setting permissions...');
  
  // Create local log directory
  if (!fs.existsSync('./backend/logs')) {
    fs.mkdirSync('./backend/logs', { recursive: true });
    console.log('Created ./backend/logs directory');
  }
  
  // Create log file if it doesn't exist
  if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, '=== LOG FILE CREATED ===\n');
    console.log('Created log file');
  }
  
  // Set permissions in container
  runCommand(`docker exec ${CONTAINER_NAME} mkdir -p /usr/src/app/logs`);
  runCommand(`docker exec ${CONTAINER_NAME} chmod -R 777 /usr/src/app/logs`);
  runCommand(`docker exec ${CONTAINER_NAME} touch /usr/src/app/logs/debug.log`);
  runCommand(`docker exec ${CONTAINER_NAME} chmod 666 /usr/src/app/logs/debug.log`);
  
  console.log('Permissions set');
  showMenu();
}

function tailLogs() {
  console.log('Press Ctrl+C to stop watching logs\n');
  runCommand(`docker logs -f ${CONTAINER_NAME}`);
}

function showMenu() {
  console.log('\n==== WhatsApp Ticket System Debug Menu ====');
  console.log('1. Check log file status');
  console.log('2. View log file contents');
  console.log('3. Check Docker and container status');
  console.log('4. Restart backend container');
  console.log('5. Create log directories and set permissions');
  console.log('6. Watch container logs in real-time');
  console.log('7. Exit');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  rl.question('\nSelect an option: ', (answer) => {
    rl.close();
    
    switch (answer) {
      case '1':
        checkLogFile();
        showMenu();
        break;
      case '2':
        viewLogs();
        break;
      case '3':
        checkDocker();
        showMenu();
        break;
      case '4':
        restartBackend();
        break;
      case '5':
        createLogDirs();
        break;
      case '6':
        tailLogs();
        break;
      case '7':
        console.log('Exiting...');
        process.exit(0);
      default:
        console.log('Invalid option');
        showMenu();
    }
  });
}

// Start the program
console.log('WhatsApp Ticket System Debug Tool');
showMenu();

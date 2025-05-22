const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Function to execute shell commands
function executeCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`Executing: ${command} ${args.join(' ')}`);
    
    const proc = spawn(command, args, {
      ...options,
      shell: true,
      stdio: 'pipe'
    });
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      console.log(output);
    });
    
    proc.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      console.error(output);
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command failed with exit code ${code}: ${stderr}`));
      }
    });
  });
}

// Run deployment process
async function deploy() {
  try {
    console.log('Starting direct deployment...');
    
    // 1. Prepare files - copy our fixed site-audit.js to ensure it's included
    console.log('Copying fixed files and optimized versions...');
    
    // Copy optimized core files
    fs.copyFileSync(
      path.join(__dirname, 'api', 'index.optimized.js'),
      path.join(__dirname, 'api', 'index.js')
    );
    fs.copyFileSync(
      path.join(__dirname, 'api', 'lib', 'redis.optimized.js'),
      path.join(__dirname, 'api', 'lib', 'redis.js')
    );
    fs.copyFileSync(
      path.join(__dirname, '.env.railway'),
      path.join(__dirname, '.env')
    );
    
    // Create Procfile with memory limit
    fs.writeFileSync(
      path.join(__dirname, 'Procfile'),
      'web: node --max-old-space-size=256 app.js'
    );
    
    // 2. Check if direct push to railway is possible
    console.log('Checking Railway login status...');
    
    try {
      // Get current project & service directly
      await executeCommand('railway', ['service', 'marden-backend-service']);
      
      // 3. Direct upload and deploy with specific service
      console.log('Pushing code directly to railway...');
      await executeCommand('railway', ['up', '--service=marden-backend-service']);
      
      // 4. Deploy it
      console.log('Deploying the updated service...');
      await executeCommand('railway', ['deploy', '--service=marden-backend-service']);
      
      console.log('Deployment completed successfully!');
      console.log('To verify, check the /health endpoint of your Railway service.');
    } catch (error) {
      console.error('Deployment error:', error.message);
      console.log('You may need to deploy manually:');
      console.log('1. Run: railway service');
      console.log('2. Select the marden-backend-service');
      console.log('3. Run: railway up');
      console.log('4. Run: railway deploy');
    }
  } catch (error) {
    console.error('Deployment failed:', error.message);
    process.exit(1);
  }
}

// Run the deployment
deploy();
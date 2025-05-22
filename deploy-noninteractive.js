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
    console.log('Starting non-interactive deployment...');
    
    // 1. Prepare files
    console.log('Copying optimized files...');
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
    
    // 2. Check if we're already linked to a project
    let { stdout: statusOutput } = await executeCommand('railway', ['status']);
    
    // 3. If not linked, create or link to a project
    if (statusOutput.includes('No linked project found')) {
      console.log('No linked project. Creating a new one...');
      
      try {
        // Try to create a new project
        await executeCommand('railway', ['init', '--name=marden-audit-backend-auto']);
      } catch (error) {
        console.error('Failed to create project:', error.message);
        // Try to link to existing project as fallback
        console.log('Attempting to link to existing project instead...');
        try {
          await executeCommand('railway', ['link', 'e058e3c6-91fb-4086-9401-93d9e3f04710']);
        } catch (secondError) {
          console.error('Failed to link to existing project:', secondError.message);
          throw new Error('Could not create or link to a project');
        }
      }
    } else {
      console.log('Already linked to a project.');
    }
    
    // 4. Check if we have a service
    let serviceExists = false;
    try {
      const { stdout: serviceStatus } = await executeCommand('railway', ['service']);
      serviceExists = !serviceStatus.includes('No service could be found');
    } catch (error) {
      console.log('Service check failed, assuming no service exists');
    }
    
    // 5. If no service, create one
    if (!serviceExists) {
      console.log('Creating a new service...');
      try {
        await executeCommand('railway', ['add', '--service=marden-backend-auto']);
      } catch (error) {
        console.error('Failed to create service:', error.message);
        // Try without name as fallback
        try {
          await executeCommand('railway', ['add']);
        } catch (secondError) {
          console.error('Failed to create service without name:', secondError.message);
          throw new Error('Could not create a service');
        }
      }
    }
    
    // 6. Set environment variables
    console.log('Setting environment variables...');
    const envVars = [
      'PORT=3000',
      'NODE_ENV=production',
      'UPSTASH_REDIS_REST_URL=redis://default:f73f7af346764a31b543ad56dec2b8a8@smiling-shrimp-21387.upstash.io:6379',
      'UPSTASH_REDIS_REST_TOKEN=AYn_ACQgNTgyOWQyNzQtNDEwMS00NjUxLTgyOGEtYzZhZmNlNjczMDk2',
      'CORS_ORIGIN=https://audit.mardenseo.com,https://marden-audit-reimagined-production.up.railway.app,http://localhost:9090',
      'MAX_CONCURRENCY=3',
      'MAX_MEMORY_PERCENT=80',
      'REDIS_TIMEOUT=2000',
      'ANALYSIS_TIMEOUT=15000',
      'RAILWAY_NIXPACKS_START_CMD=node --max-old-space-size=256 app.js'
    ];
    
    // Set each variable
    for (const envVar of envVars) {
      const [key, value] = envVar.split('=', 2);
      try {
        await executeCommand('railway', ['variables', '--set', `${key}=${value}`]);
      } catch (error) {
        console.error(`Failed to set environment variable ${key}:`, error.message);
      }
    }
    
    // 7. Upload and deploy
    console.log('Uploading code...');
    await executeCommand('railway', ['up']);
    
    // 8. Try to redeploy
    console.log('Redeploying service...');
    try {
      await executeCommand('railway', ['redeploy']);
    } catch (error) {
      console.error('Redeploy failed, but deployment might still be in progress:', error.message);
    }
    
    // 9. Get domain
    console.log('Getting service domain...');
    try {
      const { stdout: domainOutput } = await executeCommand('railway', ['domain']);
      console.log('Deployment successful!');
      console.log('Domain:', domainOutput.trim());
    } catch (error) {
      console.error('Failed to get domain, but deployment might still be in progress:', error.message);
    }
    
  } catch (error) {
    console.error('Deployment failed:', error.message);
    process.exit(1);
  }
}

// Run the deployment
deploy();

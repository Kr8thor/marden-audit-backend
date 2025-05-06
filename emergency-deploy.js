/**
 * Emergency deployment script for Railway
 * This bypasses automatic hooks and forces a direct deployment
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Force deployment without restart loops
async function emergencyDeploy() {
  try {
    console.log('EMERGENCY DEPLOYMENT PROCEDURE');
    console.log('==============================');
    
    // 1. Make sure we're logged in
    console.log('\n[1/5] Verifying Railway login...');
    try {
      const whoamiOutput = execSync('railway whoami', { encoding: 'utf8' });
      console.log(whoamiOutput.trim());
    } catch (error) {
      console.error('Not logged in to Railway. Please run "railway login" first.');
      process.exit(1);
    }
    
    // 2. Create Procfile with explicit command
    console.log('\n[2/5] Creating emergency Procfile...');
    fs.writeFileSync(
      path.join(__dirname, 'Procfile'),
      'web: node --max-old-space-size=220 app.js\n'
    );
    console.log('Created Procfile with explicit memory limits');
    
    // 3. Create .env file if it doesn't exist
    console.log('\n[3/5] Setting up environment...');
    if (!fs.existsSync(path.join(__dirname, '.env'))) {
      fs.copyFileSync(
        path.join(__dirname, '.env.railway'),
        path.join(__dirname, '.env')
      );
      console.log('Copied .env.railway to .env');
    }
    
    // 4. Force upload
    console.log('\n[4/5] Uploading code to Railway...');
    try {
      const upOutput = execSync('railway up', { encoding: 'utf8' });
      console.log(upOutput.trim());
    } catch (error) {
      console.error('Upload failed:', error.message);
      console.error('You may need to run "railway up" manually');
    }
    
    // 5. Force deploy with explicit service
    console.log('\n[5/5] Forcing service redeployment...');
    try {
      const redeployOutput = execSync('railway redeploy', { encoding: 'utf8' });
      console.log(redeployOutput.trim());
      console.log('\nEmergency deployment completed!');
      
      // Get domain
      try {
        const domainOutput = execSync('railway domain', { encoding: 'utf8' });
        console.log('\nService domain:', domainOutput.trim());
      } catch (error) {
        console.error('Could not get domain, but deployment may still be in progress.');
      }
    } catch (error) {
      console.error('Redeployment failed:', error.message);
      console.error('You may need to run "railway redeploy" manually');
    }
  } catch (error) {
    console.error('Emergency deployment failed:', error.message);
    process.exit(1);
  }
}

// Run emergency deployment
emergencyDeploy();

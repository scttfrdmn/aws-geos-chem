#!/usr/bin/env node
/**
 * cleanup.js
 * Script to clean up GEOS-Chem AWS Cloud Runner resources.
 * This helps to ensure proper resource deletion and avoid unexpected costs.
 * 
 * Usage: node cleanup.js <environment> [--force]
 * Where environment is one of: dev, test, prod
 * And --force bypasses confirmation prompts (use with caution!)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');
const readline = require('readline');
const { loadEnvConfig } = require('./deploy');

// Constants
const DEFAULT_PROFILE = 'default';

// Constants
const VALID_ENVIRONMENTS = ['dev', 'test', 'prod'];
const DEFAULT_ENV = 'dev';

/**
 * Create a readline interface for user input
 */
function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

/**
 * Prompt user for confirmation
 * @param {string} message - Confirmation message to display
 * @returns {Promise<boolean>} True if user confirms, false otherwise
 */
async function confirmAction(message) {
  const rl = createReadlineInterface();
  
  return new Promise(resolve => {
    rl.question(`${message} (y/N): `, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

/**
 * Empty S3 buckets before stack deletion to avoid deletion failure
 * @param {Object} config - Environment configuration
 */
async function emptyS3Buckets(config) {
  console.log('Checking for S3 buckets to empty...');
  
  // Configure AWS SDK with profile if specified
  const awsProfile = config.AWS_PROFILE || DEFAULT_PROFILE;
  const awsOptions = { region: config.AWS_REGION };

  if (awsProfile !== 'default') {
    process.env.AWS_SDK_LOAD_CONFIG = 1; // Ensure SDK loads config from ~/.aws/config
    AWS.config.credentials = new AWS.SharedIniFileCredentials({ profile: awsProfile });
  }

  // List all stacks using AWS SDK
  const cloudformation = new AWS.CloudFormation(awsOptions);
  const stackPrefix = config.PROJECT_PREFIX;
  
  try {
    // Get all stacks with the project prefix
    const { Stacks } = await cloudformation.describeStacks({}).promise();
    const projectStacks = Stacks.filter(stack => stack.StackName.startsWith(stackPrefix));
    
    // Get stack resources to find buckets
    for (const stack of projectStacks) {
      console.log(`Checking resources in stack: ${stack.StackName}`);
      
      const { StackResources } = await cloudformation.listStackResources({
        StackName: stack.StackName
      }).promise();
      
      // Filter for S3 bucket resources
      const buckets = StackResources.filter(resource => 
        resource.ResourceType === 'AWS::S3::Bucket'
      );
      
      if (buckets.length > 0) {
        console.log(`Found ${buckets.length} buckets in stack ${stack.StackName}`);
        
        // Confirm bucket emptying
        const force = process.argv.includes('--force');
        const shouldEmpty = force || await confirmAction(
          `Do you want to empty these buckets (required for stack deletion)?`
        );
        
        if (shouldEmpty) {
          for (const bucket of buckets) {
            const bucketName = bucket.PhysicalResourceId;
            console.log(`Emptying bucket: ${bucketName}`);
            
            try {
              // Use AWS CLI to empty bucket (handles versioned objects too)
              const profileParam = awsProfile !== 'default' ? `--profile ${awsProfile}` : '';
              execSync(`aws s3 rm s3://${bucketName} --recursive ${profileParam}`, {
                encoding: 'utf8',
                stdio: 'inherit'
              });
              console.log(`Successfully emptied bucket: ${bucketName}`);
            } catch (error) {
              console.error(`Error emptying bucket ${bucketName}:`, error.message);
            }
          }
        } else {
          console.log('Skipping bucket emptying. Stack deletion may fail for non-empty buckets.');
        }
      }
    }
  } catch (error) {
    console.error('Error listing stacks or resources:', error.message);
  }
}

/**
 * Delete all CloudFormation stacks for the GEOS-Chem Cloud Runner
 * @param {Object} config - Environment configuration
 */
async function deleteStacks(config) {
  console.log(`Preparing to delete stacks for ${config.ENV} environment...`);
  
  // Confirm stack deletion
  const force = process.argv.includes('--force');
  const shouldDelete = force || await confirmAction(
    `WARNING: This will delete all GEOS-Chem Cloud Runner resources in the ${config.ENV} environment. Are you sure?`
  );
  
  if (!shouldDelete) {
    console.log('Stack deletion cancelled.');
    return;
  }
  
  console.log('Deleting stacks in reverse dependency order...');
  
  try {
    // Configure AWS profile
    const awsProfile = config.AWS_PROFILE || DEFAULT_PROFILE;
    const profileParam = awsProfile !== 'default' ? `--profile ${awsProfile}` : '';

    // Use CDK destroy to properly handle dependencies
    execSync(`cdk destroy --all --force ${profileParam}`, {
      encoding: 'utf8',
      stdio: 'inherit',
      env: {
        ...process.env,
        CDK_DEFAULT_REGION: config.AWS_REGION,
        PROJECT_PREFIX: config.PROJECT_PREFIX,
        ENV: config.ENV,
        AWS_PROFILE: awsProfile,
        AWS_SDK_LOAD_CONFIG: '1'
      }
    });
    console.log(`\nStack deletion completed successfully!`);
  } catch (error) {
    console.error('Error deleting stacks:', error.message);
  }
}

/**
 * Main cleanup function
 */
async function main() {
  // Get the target environment from command line arguments
  const args = process.argv.slice(2);
  let environment = args[0] || DEFAULT_ENV;

  // Validate the environment
  if (!VALID_ENVIRONMENTS.includes(environment)) {
    console.error(`Invalid environment: ${environment}`);
    console.error(`Valid environments are: ${VALID_ENVIRONMENTS.join(', ')}`);
    process.exit(1);
  }

  // Parse --profile flag if provided
  let customProfile = DEFAULT_PROFILE;
  const profileFlagIndex = args.findIndex(arg => arg.startsWith('--profile='));
  if (profileFlagIndex !== -1) {
    customProfile = args[profileFlagIndex].split('=')[1];
    if (!customProfile) {
      console.error('Invalid profile format. Use --profile=<profile_name>');
      process.exit(1);
    }
  }

  console.log(`=== GEOS-Chem AWS Cloud Runner Cleanup ===`);
  console.log(`Target Environment: ${environment.toUpperCase()}`);

  if (environment === 'prod' && !args.includes('--force')) {
    const doubleConfirm = await confirmAction(
      `WARNING: You are about to delete PRODUCTION resources. Type 'CONFIRM-PROD-DELETION' to continue:`
    );

    if (!doubleConfirm) {
      console.log('Production cleanup cancelled.');
      process.exit(0);
    }
  }

  // Load environment configuration
  const config = loadEnvConfig(environment);

  // Override profile if provided via command line
  if (customProfile !== DEFAULT_PROFILE) {
    config.AWS_PROFILE = customProfile;
    console.log(`Using AWS profile from command line: ${customProfile}`);
  }
  
  // Empty S3 buckets to allow stack deletion
  await emptyS3Buckets(config);
  
  // Delete the CloudFormation stacks
  await deleteStacks(config);
}

// Execute main function
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error during cleanup:', error);
    process.exit(1);
  });
}

module.exports = {
  emptyS3Buckets,
  deleteStacks
};
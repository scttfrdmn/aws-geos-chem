/**
 * validate-configuration.js
 *
 * Lambda function to validate simulation configuration before submission to AWS Batch.
 * Checks resource availability, quotas, and configuration validity.
 *
 * Environment Variables:
 * - SIMULATIONS_TABLE: DynamoDB table name for simulations
 * - SYSTEM_BUCKET: S3 bucket for system data (templates, validation rules)
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');

// Initialize AWS clients
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const s3Client = new S3Client({});

// Environment variables
const SIMULATIONS_TABLE = process.env.SIMULATIONS_TABLE;
const SYSTEM_BUCKET = process.env.SYSTEM_BUCKET;

// Configuration limits
const LIMITS = {
  MAX_SIMULATION_DAYS: 3650, // 10 years
  MAX_CONCURRENT_JOBS_PER_USER: 10,
  MAX_NODES_GCHP: 20,
  MAX_VCPUS: 256,
  MAX_MEMORY_GB: 1024
};

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
  console.log('Validating configuration:', JSON.stringify(event, null, 2));

  const { userId, simulationId, configuration } = event;

  const validationResults = {
    valid: true,
    errors: [],
    warnings: [],
    recommendations: []
  };

  try {
    // 1. Validate configuration parameters
    await validateConfigurationParameters(configuration, validationResults);

    // 2. Check user quotas
    await checkUserQuotas(userId, validationResults);

    // 3. Validate S3 bucket access
    await validateS3Access(userId, validationResults);

    // 4. Validate resource requirements
    validateResourceRequirements(configuration, validationResults);

    // 5. Generate recommendations
    generateRecommendations(configuration, validationResults);

    // Determine overall validity
    validationResults.valid = validationResults.errors.length === 0;

    console.log('Validation results:', JSON.stringify(validationResults, null, 2));

    // Return results for Step Functions
    return {
      ...event,
      validation: validationResults
    };

  } catch (error) {
    console.error('Error during validation:', error);

    return {
      ...event,
      validation: {
        valid: false,
        errors: [`Validation failed: ${error.message}`],
        warnings: [],
        recommendations: []
      }
    };
  }
};

/**
 * Validate configuration parameters
 */
async function validateConfigurationParameters(config, results) {
  // Calculate simulation duration
  const startDate = new Date(config.startDate);
  const endDate = new Date(config.endDate);
  const durationDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

  if (durationDays > LIMITS.MAX_SIMULATION_DAYS) {
    results.errors.push(`Simulation duration (${durationDays} days) exceeds maximum (${LIMITS.MAX_SIMULATION_DAYS} days)`);
  }

  if (durationDays < 1) {
    results.errors.push('Simulation duration must be at least 1 day');
  }

  // Warn about long simulations
  if (durationDays > 365) {
    results.warnings.push('Simulation duration exceeds 1 year. Consider breaking into smaller segments.');
  }

  // Validate GCHP node count
  if (config.simulationType === 'GCHP') {
    if (config.nodes > LIMITS.MAX_NODES_GCHP) {
      results.errors.push(`Node count (${config.nodes}) exceeds maximum (${LIMITS.MAX_NODES_GCHP})`);
    }
    if (config.nodes < 1) {
      results.errors.push('GCHP requires at least 1 node');
    }
  }

  // Validate chemistry and resolution compatibility
  if (config.resolution === '0.25x0.3125' && config.chemistryOption === 'fullchem') {
    results.warnings.push('Full chemistry at 0.25x0.3125 resolution requires significant memory and compute resources');
  }

  // Validate date range (not too far in the past for met data availability)
  const minDate = new Date('2015-01-01');
  if (startDate < minDate) {
    results.warnings.push(`Met data may not be available before ${minDate.toISOString().split('T')[0]}`);
  }

  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 7); // Allow 7 days into future for forecast data
  if (endDate > maxDate) {
    results.errors.push('Simulation end date cannot be more than 7 days in the future');
  }
}

/**
 * Check user quotas and concurrent job limits
 */
async function checkUserQuotas(userId, results) {
  try {
    // Query for active simulations by user
    const response = await docClient.send(new QueryCommand({
      TableName: SIMULATIONS_TABLE,
      KeyConditionExpression: 'userId = :userId',
      FilterExpression: '#status IN (:submitted, :running)',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':userId': userId,
        ':submitted': 'SUBMITTED',
        ':running': 'RUNNING'
      }
    }));

    const activeJobs = response.Items?.length || 0;

    if (activeJobs >= LIMITS.MAX_CONCURRENT_JOBS_PER_USER) {
      results.errors.push(
        `Maximum concurrent jobs (${LIMITS.MAX_CONCURRENT_JOBS_PER_USER}) reached. ` +
        `Please wait for existing jobs to complete.`
      );
    } else if (activeJobs >= LIMITS.MAX_CONCURRENT_JOBS_PER_USER - 2) {
      results.warnings.push(
        `You have ${activeJobs} active jobs. ` +
        `Limit is ${LIMITS.MAX_CONCURRENT_JOBS_PER_USER}.`
      );
    }

  } catch (error) {
    console.error('Error checking user quotas:', error);
    results.warnings.push('Unable to verify user quotas');
  }
}

/**
 * Validate S3 bucket access
 */
async function validateS3Access(userId, results) {
  try {
    // Try to access system bucket (basic connectivity check)
    await s3Client.send(new HeadObjectCommand({
      Bucket: SYSTEM_BUCKET.replace('s3://', ''),
      Key: 'health-check.txt'
    }));

  } catch (error) {
    // If health check file doesn't exist, that's okay
    if (error.name === 'NotFound' || error.name === 'NoSuchKey') {
      return;
    }

    console.error('Error validating S3 access:', error);
    results.warnings.push('Unable to verify S3 bucket access. Simulation may fail if permissions are incorrect.');
  }
}

/**
 * Validate resource requirements
 */
function validateResourceRequirements(config, results) {
  // Estimate vCPU requirements
  let estimatedVCPUs = 16; // Default

  if (config.instanceSize === 'small') estimatedVCPUs = 4;
  if (config.instanceSize === 'medium') estimatedVCPUs = 16;
  if (config.instanceSize === 'large') estimatedVCPUs = 32;
  if (config.instanceSize === 'xlarge') estimatedVCPUs = 64;

  if (config.simulationType === 'GCHP') {
    estimatedVCPUs *= config.nodes;
  }

  if (estimatedVCPUs > LIMITS.MAX_VCPUS) {
    results.errors.push(
      `Estimated vCPU requirement (${estimatedVCPUs}) exceeds limit (${LIMITS.MAX_VCPUS})`
    );
  }

  // Estimate memory requirements
  let estimatedMemoryGB = 32; // Default

  if (config.memory === 'standard') estimatedMemoryGB = 32;
  if (config.memory === 'high') estimatedMemoryGB = 64;

  // Adjust for resolution
  if (config.resolution === '0.25x0.3125' || config.cubedsphereRes === 'C360') {
    estimatedMemoryGB *= 2;
  }

  if (config.simulationType === 'GCHP') {
    estimatedMemoryGB *= config.nodes;
  }

  if (estimatedMemoryGB > LIMITS.MAX_MEMORY_GB) {
    results.errors.push(
      `Estimated memory requirement (${estimatedMemoryGB} GB) exceeds limit (${LIMITS.MAX_MEMORY_GB} GB)`
    );
  }

  // Warn about high-resolution simulations
  if (config.resolution === '0.5x0.625' || config.resolution === '0.25x0.3125') {
    results.warnings.push(
      'High-resolution simulations require significant resources and may incur high costs'
    );
  }

  if (config.cubedsphereRes === 'C180' || config.cubedsphereRes === 'C360') {
    results.warnings.push(
      'High-resolution GCHP simulations require significant resources and may incur high costs'
    );
  }
}

/**
 * Generate recommendations
 */
function generateRecommendations(config, results) {
  // Recommend spot instances if not selected
  if (!config.useSpot) {
    results.recommendations.push(
      'Consider using spot instances for 70% cost savings. ' +
      'Spot instances are suitable for most simulations.'
    );
  }

  // Recommend appropriate processor for workload
  if (config.simulationType === 'GC_CLASSIC' && config.processorType !== 'amd') {
    results.recommendations.push(
      'AMD EPYC processors provide the best price-performance for GC Classic simulations'
    );
  }

  if (config.simulationType === 'GCHP' && config.processorType !== 'graviton3') {
    results.recommendations.push(
      'Graviton3 processors provide excellent price-performance for GCHP simulations'
    );
  }

  // Recommend reducing output frequency for long simulations
  const startDate = new Date(config.startDate);
  const endDate = new Date(config.endDate);
  const durationDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

  if (durationDays > 90 && config.outputFrequency === 'hourly') {
    results.recommendations.push(
      'Consider reducing output frequency for long simulations to save storage costs'
    );
  }

  // Recommend spinup for long simulations
  if (durationDays > 30 && config.spinupDays === 0) {
    results.recommendations.push(
      'Consider adding a spinup period for simulations longer than 1 month'
    );
  }
}

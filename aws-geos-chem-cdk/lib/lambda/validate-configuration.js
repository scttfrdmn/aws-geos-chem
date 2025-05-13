/**
 * validate-configuration.js
 * Lambda function to validate simulation configuration
 */

const AWS = require('aws-sdk');
const s3 = new AWS.S3();

// Define configuration schema and constraints
const CONFIG_CONSTRAINTS = {
  simulationType: ['fullchem', 'aerosol', 'transport', 'ch4', 'co2'],
  resolutions: {
    global: ['4x5', '2x2.5', '0.5x0.625'],
    nested: ['AS', 'NA', 'EU', 'custom']
  },
  instanceTypes: {
    graviton: ['c7g.8xlarge', 'c7g.16xlarge'],
    intel: ['c6i.8xlarge', 'c6i.16xlarge'],
    amd: ['c6a.8xlarge', 'c6a.16xlarge']
  },
  maxDurationDays: 366,
  minDurationDays: 1
};

/**
 * Handler for the validate-configuration Lambda function
 */
exports.handler = async (event) => {
  console.log('Validate Configuration Handler - Event:', JSON.stringify(event));
  
  try {
    const { configLocation, userId, simulationId } = event;
    
    if (!configLocation) {
      throw new Error('Missing required parameter: configLocation');
    }
    
    // Parse S3 URL to get bucket and key
    const s3Params = parseS3Url(configLocation);
    
    // Get configuration file from S3
    const configResponse = await s3.getObject({
      Bucket: s3Params.bucket,
      Key: s3Params.key
    }).promise();
    
    // Parse configuration JSON
    const config = JSON.parse(configResponse.Body.toString('utf-8'));
    
    // Validate configuration
    const validationResult = validateConfiguration(config);
    
    if (!validationResult.isValid) {
      throw new Error(`Configuration validation failed: ${validationResult.errors.join(', ')}`);
    }
    
    // Return validated configuration and continue workflow
    return {
      ...event,
      validatedConfig: config,
      validationResult
    };
    
  } catch (error) {
    console.error('Error validating configuration:', error);
    throw error;
  }
};

/**
 * Parse S3 URL to extract bucket and key
 * @param {string} s3Url - S3 URL in format s3://bucket/key
 * @returns {Object} - Object with bucket and key properties
 */
function parseS3Url(s3Url) {
  if (!s3Url.startsWith('s3://')) {
    throw new Error('Invalid S3 URL format. Expected s3://bucket/key');
  }
  
  const parts = s3Url.substring(5).split('/');
  const bucket = parts[0];
  const key = parts.slice(1).join('/');
  
  return { bucket, key };
}

/**
 * Validate configuration against constraints
 * @param {Object} config - Simulation configuration to validate
 * @returns {Object} - Validation result with isValid flag and errors array
 */
function validateConfiguration(config) {
  const errors = [];
  
  // Check required fields
  const requiredFields = ['simulationType', 'instanceType', 'durationDays', 'startDate'];
  for (const field of requiredFields) {
    if (!config[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  
  // Check simulation type
  if (config.simulationType && !CONFIG_CONSTRAINTS.simulationType.includes(config.simulationType)) {
    errors.push(`Invalid simulation type: ${config.simulationType}. Allowed values: ${CONFIG_CONSTRAINTS.simulationType.join(', ')}`);
  }
  
  // Check instance type
  let validInstanceType = false;
  if (config.instanceType) {
    for (const category in CONFIG_CONSTRAINTS.instanceTypes) {
      if (CONFIG_CONSTRAINTS.instanceTypes[category].includes(config.instanceType)) {
        validInstanceType = true;
        break;
      }
    }
    
    if (!validInstanceType) {
      errors.push(`Invalid instance type: ${config.instanceType}`);
    }
  }
  
  // Check duration
  if (config.durationDays) {
    const durationDays = parseInt(config.durationDays);
    if (isNaN(durationDays) || durationDays < CONFIG_CONSTRAINTS.minDurationDays || durationDays > CONFIG_CONSTRAINTS.maxDurationDays) {
      errors.push(`Invalid duration: ${config.durationDays}. Must be between ${CONFIG_CONSTRAINTS.minDurationDays} and ${CONFIG_CONSTRAINTS.maxDurationDays} days`);
    }
  }
  
  // Check resolution
  if (config.domainType === 'global' && config.resolution) {
    if (!CONFIG_CONSTRAINTS.resolutions.global.includes(config.resolution)) {
      errors.push(`Invalid global resolution: ${config.resolution}. Allowed values: ${CONFIG_CONSTRAINTS.resolutions.global.join(', ')}`);
    }
  } else if (config.domainType === 'nested' && config.nestedDomain) {
    if (!CONFIG_CONSTRAINTS.resolutions.nested.includes(config.nestedDomain)) {
      errors.push(`Invalid nested domain: ${config.nestedDomain}. Allowed values: ${CONFIG_CONSTRAINTS.resolutions.nested.join(', ')}`);
    }
  }
  
  // Check date format
  if (config.startDate) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(config.startDate)) {
      errors.push(`Invalid start date format: ${config.startDate}. Expected format: YYYY-MM-DD`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}
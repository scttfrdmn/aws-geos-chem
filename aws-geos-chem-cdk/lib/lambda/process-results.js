/**
 * process-results.js
 * Lambda function to process simulation results
 */

const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Get environment variables
const SIMULATIONS_TABLE = process.env.SIMULATIONS_TABLE;
const USERS_BUCKET = process.env.USERS_BUCKET;

/**
 * Handler for the process-results Lambda function
 */
exports.handler = async (event) => {
  console.log('Process Results Handler - Event:', JSON.stringify(event));
  
  try {
    const { simulationId, userId, outputLocation } = event;
    
    if (!simulationId || !userId || !outputLocation) {
      throw new Error('Missing required parameters');
    }
    
    // Parse S3 URL
    const s3Params = parseS3Url(outputLocation);
    
    // Check if results exist in S3
    const manifestKey = `${s3Params.key}manifest.json`;
    try {
      await s3.headObject({
        Bucket: s3Params.bucket,
        Key: manifestKey
      }).promise();
    } catch (error) {
      console.warn(`Manifest not found at ${outputLocation}manifest.json`);
      // We'll continue anyway since the results might be in different format
    }
    
    // List all files in the output directory
    const listParams = {
      Bucket: s3Params.bucket,
      Prefix: s3Params.key
    };
    
    const listedObjects = await s3.listObjectsV2(listParams).promise();
    
    // Process the result files
    const resultFiles = {
      outputFiles: [],
      logFiles: [],
      configFiles: [],
      restartFiles: []
    };
    
    if (listedObjects.Contents) {
      for (const object of listedObjects.Contents) {
        const key = object.Key;
        const size = object.Size;
        const lastModified = object.LastModified;
        
        // Categorize files
        const filename = key.split('/').pop();
        const fileInfo = {
          filename,
          key,
          size,
          lastModified,
          url: `s3://${s3Params.bucket}/${key}`
        };
        
        if (key.endsWith('.nc') || key.includes('OutputDir')) {
          resultFiles.outputFiles.push(fileInfo);
        } else if (key.endsWith('.log')) {
          resultFiles.logFiles.push(fileInfo);
        } else if (key.endsWith('.yml') || key.endsWith('.rc')) {
          resultFiles.configFiles.push(fileInfo);
        } else if (key.includes('Restarts')) {
          resultFiles.restartFiles.push(fileInfo);
        }
      }
    }
    
    // Get manifest if it exists
    let manifest = null;
    try {
      const manifestObject = await s3.getObject({
        Bucket: s3Params.bucket,
        Key: manifestKey
      }).promise();
      
      manifest = JSON.parse(manifestObject.Body.toString('utf-8'));
    } catch (error) {
      console.warn('Could not load manifest:', error);
    }
    
    // Extract performance data from manifest or logs
    const performanceData = extractPerformanceData(manifest, resultFiles);
    
    // Create a results summary
    const resultsSummary = {
      simulationId,
      userId,
      processedAt: new Date().toISOString(),
      resultLocation: outputLocation,
      fileCount: {
        outputFiles: resultFiles.outputFiles.length,
        logFiles: resultFiles.logFiles.length,
        configFiles: resultFiles.configFiles.length,
        restartFiles: resultFiles.restartFiles.length
      },
      totalSizeBytes: calculateTotalSize(resultFiles),
      performanceData
    };
    
    // Save results summary to S3
    const summaryKey = `${userId}/results/${simulationId}/summary.json`;
    await s3.putObject({
      Bucket: USERS_BUCKET,
      Key: summaryKey,
      Body: JSON.stringify(resultsSummary, null, 2),
      ContentType: 'application/json'
    }).promise();
    
    // Update simulation record in DynamoDB
    await dynamoDB.update({
      TableName: SIMULATIONS_TABLE,
      Key: {
        userId,
        simulationId
      },
      UpdateExpression: 'SET resultSummary = :summary, resultLocation = :location, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':summary': resultsSummary,
        ':location': outputLocation,
        ':updatedAt': new Date().toISOString()
      }
    }).promise();
    
    // Return results summary
    return {
      ...event,
      resultsSummary
    };
    
  } catch (error) {
    console.error('Error processing results:', error);
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
 * Calculate total size of all result files
 * @param {Object} resultFiles - Object with categorized file lists
 * @returns {number} - Total size in bytes
 */
function calculateTotalSize(resultFiles) {
  let totalSize = 0;
  
  for (const category in resultFiles) {
    for (const file of resultFiles[category]) {
      totalSize += file.size || 0;
    }
  }
  
  return totalSize;
}

/**
 * Extract performance data from manifest or logs
 * @param {Object} manifest - Manifest JSON if available
 * @param {Object} resultFiles - Object with categorized file lists
 * @returns {Object} - Performance data object
 */
function extractPerformanceData(manifest, resultFiles) {
  // If manifest has run_summary with performance data, use that
  if (manifest && manifest.run_summary) {
    return {
      wallTime: manifest.run_summary.wall_time || null,
      computeTime: manifest.run_summary.compute_time || null,
      totalModelTime: manifest.run_summary.total_model_time || null,
      instanceType: manifest.run_summary.instance_type || null,
      startTime: manifest.run_summary.start_time || null,
      endTime: manifest.run_summary.end_time || null,
      durationSeconds: manifest.run_summary.duration_seconds || null,
      throughputDaysPerDay: calculateThroughput(manifest.run_summary),
      source: 'manifest'
    };
  }
  
  // If no manifest, return empty performance data
  // In a real implementation, you might try to parse logs to extract this data
  return {
    source: 'none',
    wallTime: null,
    computeTime: null,
    instanceType: null,
    throughputDaysPerDay: null
  };
}

/**
 * Calculate simulation throughput in simulation days per wall day
 * @param {Object} runSummary - Run summary from manifest
 * @returns {number|null} - Throughput or null if can't be calculated
 */
function calculateThroughput(runSummary) {
  if (!runSummary || !runSummary.duration_seconds) {
    return null;
  }
  
  // This is a simplified example - in reality, you would
  // need to know the simulation period from the configuration
  // Assuming simulation duration info is available in the run summary
  if (runSummary.simulation_days && runSummary.duration_seconds) {
    const wallDays = runSummary.duration_seconds / (24 * 60 * 60);
    return runSummary.simulation_days / wallDays;
  }
  
  return null;
}
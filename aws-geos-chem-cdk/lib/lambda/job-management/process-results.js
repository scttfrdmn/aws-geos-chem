/**
 * process-results.js
 *
 * Lambda function to process simulation results from S3.
 * Generates result manifest, extracts key metrics, and triggers visualization.
 *
 * Environment Variables:
 * - SIMULATIONS_TABLE: DynamoDB table name for simulations
 * - USERS_BUCKET: S3 bucket for user data
 * - VISUALIZATION_FUNCTION_ARN: ARN of visualization Lambda (optional)
 */

const { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');

// Initialize AWS clients
const s3Client = new S3Client({});
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const lambdaClient = new LambdaClient({});

// Environment variables
const SIMULATIONS_TABLE = process.env.SIMULATIONS_TABLE;
const USERS_BUCKET = process.env.USERS_BUCKET;
const VISUALIZATION_FUNCTION_ARN = process.env.VISUALIZATION_FUNCTION_ARN;

/**
 * Main Lambda handler
 */
exports.handler = async (event) => {
  console.log('Processing results:', JSON.stringify(event, null, 2));

  const { userId, simulationId, outputPath } = event;

  try {
    // 1. List all output files
    const outputFiles = await listOutputFiles(outputPath);

    if (outputFiles.length === 0) {
      console.warn('No output files found');
      return {
        ...event,
        resultsProcessed: false,
        error: 'No output files found'
      };
    }

    console.log(`Found ${outputFiles.length} output files`);

    // 2. Parse output files and extract metadata
    const fileMetadata = await parseOutputFiles(outputFiles);

    // 3. Extract key metrics from outputs
    const metrics = await extractMetrics(outputFiles, outputPath);

    // 4. Generate result manifest
    const manifest = {
      simulationId,
      userId,
      processedAt: new Date().toISOString(),
      outputPath,
      fileCount: outputFiles.length,
      totalSizeBytes: fileMetadata.totalSize,
      files: fileMetadata.files,
      metrics,
      dataTypes: fileMetadata.dataTypes
    };

    // 5. Upload manifest to S3
    const manifestPath = outputPath.replace(/\/$/, '') + '/manifest.json';
    await uploadManifest(manifestPath, manifest);

    // 6. Update DynamoDB with result info
    await updateSimulationResults(userId, simulationId, {
      resultPath: outputPath,
      manifestPath,
      fileCount: outputFiles.length,
      totalSizeBytes: fileMetadata.totalSize,
      dataTypes: fileMetadata.dataTypes,
      resultsProcessedAt: new Date().toISOString()
    });

    // 7. Trigger visualization generation (optional, async)
    if (VISUALIZATION_FUNCTION_ARN) {
      await triggerVisualization(userId, simulationId, outputPath, manifest).catch(error => {
        console.warn('Visualization trigger failed:', error.message);
        // Don't fail the whole process if visualization fails
      });
    }

    console.log('Results processed successfully');

    return {
      ...event,
      resultsProcessed: true,
      manifest,
      fileCount: outputFiles.length
    };

  } catch (error) {
    console.error('Error processing results:', error);

    // Update DynamoDB with error
    await updateSimulationResults(userId, simulationId, {
      resultProcessingError: error.message,
      resultsProcessedAt: new Date().toISOString()
    });

    throw error;
  }
};

/**
 * List all output files from S3
 */
async function listOutputFiles(outputPath) {
  const bucketName = outputPath.match(/s3:\/\/([^\/]+)/)[1];
  const prefix = outputPath.replace(`s3://${bucketName}/`, '');

  const files = [];
  let continuationToken;

  do {
    const response = await s3Client.send(new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix,
      ContinuationToken: continuationToken
    }));

    if (response.Contents) {
      files.push(...response.Contents.map(obj => ({
        key: obj.Key,
        size: obj.Size,
        lastModified: obj.LastModified,
        etag: obj.ETag
      })));
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return files;
}

/**
 * Parse output files and categorize them
 */
async function parseOutputFiles(files) {
  const dataTypes = new Set();
  let totalSize = 0;

  const parsedFiles = files.map(file => {
        const fileName = file.key.split('/').pop();
    const extension = fileName.split('.').pop();

    // Categorize file types
    if (extension === 'nc' || extension === 'nc4') {
      dataTypes.add('netcdf');
    } else if (extension === 'log') {
      dataTypes.add('logs');
    } else if (extension === 'txt') {
      dataTypes.add('text');
    } else if (extension === 'json') {
      dataTypes.add('json');
    }

    totalSize += file.size;

    return {
      name: fileName,
      path: file.key,
      size: file.size,
      lastModified: file.lastModified,
      type: extension
    };
  });

  return {
    files: parsedFiles,
    totalSize,
    dataTypes: Array.from(dataTypes)
  };
}

/**
 * Extract key metrics from output files
 */
async function extractMetrics(files, outputPath) {
  const metrics = {
    outputFileCount: files.length,
    netcdfFiles: files.filter(f => f.key.endsWith('.nc') || f.key.endsWith('.nc4')).length,
    logFiles: files.filter(f => f.key.endsWith('.log')).length,
    diagnosticFiles: files.filter(f => f.key.includes('diagnostic') || f.key.includes('HEMCO')).length
  };

  // Try to find and parse key output files
  const timingFile = files.find(f => f.key.endsWith('GEOSChem.Timing.txt') || f.key.endsWith('timing.log'));
  if (timingFile) {
    try {
      const timing = await parseTimingFile(outputPath, timingFile.key);
      metrics.timing = timing;
    } catch (error) {
      console.warn('Could not parse timing file:', error.message);
    }
  }

  // Look for HEMCO diagnostics
  const hemcoFile = files.find(f => f.key.includes('HEMCO') && f.key.endsWith('.nc'));
  if (hemcoFile) {
    metrics.hasEmissions = true;
  }

  // Look for species concentrations
  const speciesFile = files.find(f => f.key.includes('SpeciesConc') && f.key.endsWith('.nc'));
  if (speciesFile) {
    metrics.hasSpeciesOutput = true;
  }

  return metrics;
}

/**
 * Parse timing file to extract performance data
 */
async function parseTimingFile(outputPath, timingKey) {
  const bucketName = outputPath.match(/s3:\/\/([^\/]+)/)[1];

  try {
    const response = await s3Client.send(new GetObjectCommand({
      Bucket: bucketName,
      Key: timingKey
    }));

    const content = await streamToString(response.Body);

    // Parse timing information (simplified - real implementation would be more sophisticated)
    const timing = {};

    // Look for wall time
    const wallTimeMatch = content.match(/Wall\s+Time:\s+([\d.]+)/i);
    if (wallTimeMatch) {
      timing.wallTimeSeconds = parseFloat(wallTimeMatch[1]);
    }

    // Look for CPU time
    const cpuTimeMatch = content.match(/CPU\s+Time:\s+([\d.]+)/i);
    if (cpuTimeMatch) {
      timing.cpuTimeSeconds = parseFloat(cpuTimeMatch[1]);
    }

    // Calculate efficiency if both are available
    if (timing.wallTimeSeconds && timing.cpuTimeSeconds) {
      timing.cpuEfficiency = (timing.cpuTimeSeconds / timing.wallTimeSeconds * 100).toFixed(2);
    }

    return timing;
  } catch (error) {
    console.warn('Error parsing timing file:', error.message);
    return null;
  }
}

/**
 * Convert stream to string
 */
async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

/**
 * Upload manifest to S3
 */
async function uploadManifest(manifestPath, manifest) {
  const bucketName = manifestPath.match(/s3:\/\/([^\/]+)/)[1];
  const key = manifestPath.replace(`s3://${bucketName}/`, '');

  await s3Client.send(new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: JSON.stringify(manifest, null, 2),
    ContentType: 'application/json'
  }));

  console.log(`Manifest uploaded to ${manifestPath}`);
}

/**
 * Update simulation results in DynamoDB
 */
async function updateSimulationResults(userId, simulationId, resultInfo) {
  const updateExpressions = [];
  const attributeValues = { ':timestamp': new Date().toISOString() };

  Object.keys(resultInfo).forEach((key, index) => {
    if (resultInfo[key] !== undefined && resultInfo[key] !== null) {
      const valueName = `:val${index}`;
      updateExpressions.push(`${key} = ${valueName}`);
      attributeValues[valueName] = resultInfo[key];
    }
  });

  updateExpressions.push('updatedAt = :timestamp');

  await docClient.send(new UpdateCommand({
    TableName: SIMULATIONS_TABLE,
    Key: { userId, simulationId },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeValues: attributeValues
  }));
}

/**
 * Trigger visualization generation Lambda
 */
async function triggerVisualization(userId, simulationId, outputPath, manifest) {
  if (!VISUALIZATION_FUNCTION_ARN) {
    console.log('No visualization function configured');
    return;
  }

  const payload = {
    userId,
    simulationId,
    outputPath,
    manifest,
    visualizationTypes: ['timeseries', 'spatial']
  };

  try {
    await lambdaClient.send(new InvokeCommand({
      FunctionName: VISUALIZATION_FUNCTION_ARN,
      InvocationType: 'Event', // Async invocation
      Payload: JSON.stringify(payload)
    }));

    console.log('Visualization generation triggered');
  } catch (error) {
    console.error('Error triggering visualization:', error);
    throw error;
  }
}

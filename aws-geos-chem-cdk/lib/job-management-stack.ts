import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as batch from 'aws-cdk-lib/aws-batch';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as path from 'path';

interface JobManagementStackProps extends cdk.StackProps {
  simulationsTable: dynamodb.Table;
  usersBucket: s3.Bucket;
  systemBucket: s3.Bucket;
  jobQueue: batch.JobQueue;
}

export class JobManagementStack extends cdk.Stack {
  public readonly submitSimulationLambda: lambda.Function;
  public readonly geosChemStateMachine: sfn.StateMachine;
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: JobManagementStackProps) {
    super(scope, id, props);

    // Create IAM role for Lambda functions
    const lambdaExecutionRole = new iam.Role(this, 'JobManagementLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ]
    });

    // Add permissions for DynamoDB, S3, and Batch
    lambdaExecutionRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:Query'
      ],
      resources: [props.simulationsTable.tableArn]
    }));

    lambdaExecutionRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:GetObject',
        's3:PutObject',
        's3:ListBucket'
      ],
      resources: [
        props.usersBucket.arnForObjects('*'),
        props.usersBucket.bucketArn,
        props.systemBucket.arnForObjects('*'),
        props.systemBucket.bucketArn
      ]
    }));

    lambdaExecutionRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'batch:SubmitJob',
        'batch:DescribeJobs',
        'batch:TerminateJob'
      ],
      resources: ['*']
    }));

    // Create Lambda functions for each step of the workflow
    // Using job-management subdirectory for Lambda code
    const lambdaCodePath = path.join(__dirname, 'lambda', 'job-management');

    this.submitSimulationLambda = new lambda.Function(this, 'SubmitSimulationHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'submit-simulation.handler',
      code: lambda.Code.fromAsset(lambdaCodePath),
      role: lambdaExecutionRole,
      environment: {
        SIMULATIONS_TABLE: props.simulationsTable.tableName,
        USERS_BUCKET: props.usersBucket.bucketName,
        SYSTEM_BUCKET: props.systemBucket.bucketName,
        STATE_MACHINE_ARN: '', // Will be set after state machine creation
      },
      timeout: cdk.Duration.seconds(30)
    });

    // Validate configuration Lambda
    const validateConfigurationLambda = new lambda.Function(this, 'ValidateConfigurationHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'validate-configuration.handler',
      code: lambda.Code.fromAsset(lambdaCodePath),
      role: lambdaExecutionRole,
      environment: {
        SIMULATIONS_TABLE: props.simulationsTable.tableName,
        SYSTEM_BUCKET: props.systemBucket.bucketName
      },
      timeout: cdk.Duration.seconds(30)
    });

    // Submit batch job Lambda
    const submitBatchJobLambda = new lambda.Function(this, 'SubmitBatchJobHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'submit-batch-job.handler',
      code: lambda.Code.fromAsset(lambdaCodePath),
      role: lambdaExecutionRole,
      environment: {
        SIMULATIONS_TABLE: props.simulationsTable.tableName,
        JOB_QUEUE_GRAVITON: 'geos-chem-graviton-queue',
        JOB_QUEUE_X86: 'geos-chem-x86-queue',
        ECR_REPOSITORY: `${cdk.Aws.ACCOUNT_ID}.dkr.ecr.${cdk.Aws.REGION}.amazonaws.com/geos-chem`,
        AWS_REGION: cdk.Aws.REGION,
        AWS_ACCOUNT_ID: cdk.Aws.ACCOUNT_ID
      },
      timeout: cdk.Duration.seconds(30)
    });

    // Monitor job status Lambda
    const monitorJobStatusLambda = new lambda.Function(this, 'MonitorJobStatusHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'monitor-job-status.handler',
      code: lambda.Code.fromAsset(lambdaCodePath),
      role: lambdaExecutionRole,
      environment: {
        SIMULATIONS_TABLE: props.simulationsTable.tableName
      },
      timeout: cdk.Duration.seconds(30)
    });

    // Process results Lambda
    const processResultsLambda = new lambda.Function(this, 'ProcessResultsHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'process-results.handler',
      code: lambda.Code.fromAsset(lambdaCodePath),
      role: lambdaExecutionRole,
      environment: {
        SIMULATIONS_TABLE: props.simulationsTable.tableName,
        USERS_BUCKET: props.usersBucket.bucketName
      },
      timeout: cdk.Duration.minutes(5)
    });

    // Update simulation status Lambda
    const updateSimulationStatusLambda = new lambda.Function(this, 'UpdateSimulationStatusHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'update-simulation-status.handler',
      code: lambda.Code.fromAsset(lambdaCodePath),
      role: lambdaExecutionRole,
      environment: {
        SIMULATIONS_TABLE: props.simulationsTable.tableName
      },
      timeout: cdk.Duration.seconds(30)
    });

    // Create Step Functions tasks for each Lambda function
    const validateConfigurationTask = new tasks.LambdaInvoke(this, 'ValidateConfigurationTask', {
      lambdaFunction: validateConfigurationLambda,
      outputPath: '$.Payload'
    });

    const submitBatchJobTask = new tasks.LambdaInvoke(this, 'SubmitBatchJobTask', {
      lambdaFunction: submitBatchJobLambda,
      outputPath: '$.Payload'
    });

    const monitorJobStatusTask = new tasks.LambdaInvoke(this, 'MonitorJobStatusTask', {
      lambdaFunction: monitorJobStatusLambda,
      outputPath: '$.Payload'
    });

    const processResultsTask = new tasks.LambdaInvoke(this, 'ProcessResultsTask', {
      lambdaFunction: processResultsLambda,
      outputPath: '$.Payload'
    });

    const updateSuccessStatusTask = new tasks.LambdaInvoke(this, 'UpdateSuccessStatusTask', {
      lambdaFunction: updateSimulationStatusLambda,
      payload: sfn.TaskInput.fromObject({
        simulationId: sfn.JsonPath.stringAt('$.simulationId'),
        userId: sfn.JsonPath.stringAt('$.userId'),
        status: 'COMPLETED',
        statusDetails: 'Simulation completed successfully'
      }),
      outputPath: '$.Payload'
    });

    const updateFailedStatusTask = new tasks.LambdaInvoke(this, 'UpdateFailedStatusTask', {
      lambdaFunction: updateSimulationStatusLambda,
      payload: sfn.TaskInput.fromObject({
        simulationId: sfn.JsonPath.stringAt('$.simulationId'),
        userId: sfn.JsonPath.stringAt('$.userId'),
        status: 'FAILED',
        statusDetails: sfn.JsonPath.stringAt('$.error')
      }),
      outputPath: '$.Payload'
    });

    // Create the state machine
    const jobSucceededCondition = sfn.Condition.stringEquals('$.jobStatus', 'SUCCEEDED');
    const jobFailedCondition = sfn.Condition.stringEquals('$.jobStatus', 'FAILED');
    const jobInProgressCondition = sfn.Condition.or(
      sfn.Condition.stringEquals('$.jobStatus', 'SUBMITTED'),
      sfn.Condition.stringEquals('$.jobStatus', 'PENDING'),
      sfn.Condition.stringEquals('$.jobStatus', 'RUNNABLE'),
      sfn.Condition.stringEquals('$.jobStatus', 'STARTING'),
      sfn.Condition.stringEquals('$.jobStatus', 'RUNNING')
    );

    // Wait state for monitoring job completion
    const waitForJobCompletion = new sfn.Wait(this, 'WaitForJobCompletion', {
      time: sfn.WaitTime.duration(cdk.Duration.seconds(60))
    });

    // Create state machine definition
    const definition = validateConfigurationTask
      .next(submitBatchJobTask)
      .next(monitorJobStatusTask)
      .next(new sfn.Choice(this, 'CheckJobStatus')
        .when(jobSucceededCondition, processResultsTask.next(updateSuccessStatusTask))
        .when(jobFailedCondition, updateFailedStatusTask)
        .when(jobInProgressCondition, waitForJobCompletion.next(monitorJobStatusTask))
        .otherwise(updateFailedStatusTask)
      );

    // Create state machine
    this.geosChemStateMachine = new sfn.StateMachine(this, 'GEOSChemWorkflow', {
      definition,
      timeout: cdk.Duration.hours(48),
      tracingEnabled: true,
      logs: {
        destination: new logs.LogGroup(this, 'GEOSChemWorkflowLogs', {
          retention: logs.RetentionDays.ONE_MONTH
        }),
        level: sfn.LogLevel.ALL
      }
    });

    // Update submit simulation Lambda with state machine ARN
    this.submitSimulationLambda.addEnvironment('STATE_MACHINE_ARN', this.geosChemStateMachine.stateMachineArn);

    // Grant permissions to start state machine
    this.geosChemStateMachine.grantStartExecution(this.submitSimulationLambda);

    // Create Lambda functions for API operations
    // Get simulation status Lambda
    const getSimulationLambda = new lambda.Function(this, 'GetSimulationHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'get-simulation.handler',
      code: lambda.Code.fromAsset(lambdaCodePath),
      role: lambdaExecutionRole,
      environment: {
        SIMULATIONS_TABLE: props.simulationsTable.tableName
      },
      timeout: cdk.Duration.seconds(30)
    });

    // List simulations Lambda
    const listSimulationsLambda = new lambda.Function(this, 'ListSimulationsHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'list-simulations.handler',
      code: lambda.Code.fromAsset(lambdaCodePath),
      role: lambdaExecutionRole,
      environment: {
        SIMULATIONS_TABLE: props.simulationsTable.tableName
      },
      timeout: cdk.Duration.seconds(30)
    });

    // Cancel simulation Lambda
    const cancelSimulationLambda = new lambda.Function(this, 'CancelSimulationHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'cancel-simulation.handler',
      code: lambda.Code.fromAsset(lambdaCodePath),
      role: lambdaExecutionRole,
      environment: {
        SIMULATIONS_TABLE: props.simulationsTable.tableName
      },
      timeout: cdk.Duration.seconds(30)
    });

    // Grant Step Functions permissions to cancel execution
    this.geosChemStateMachine.grantExecution(cancelSimulationLambda, 'states:StopExecution');

    // Create API Gateway REST API
    this.api = new apigateway.RestApi(this, 'SimulationsApi', {
      restApiName: 'GEOS-Chem Simulations API',
      description: 'API for managing GEOS-Chem simulations',
      deployOptions: {
        stageName: 'prod',
        tracingEnabled: true,
        dataTraceEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        metricsEnabled: true
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token'
        ],
        allowCredentials: true
      }
    });

    // Create request validator
    const requestValidator = new apigateway.RequestValidator(this, 'RequestValidator', {
      restApi: this.api,
      validateRequestBody: true,
      validateRequestParameters: true
    });

    // Create API Gateway models for request/response validation
    const simulationConfigModel = new apigateway.Model(this, 'SimulationConfigModel', {
      restApi: this.api,
      contentType: 'application/json',
      description: 'Simulation configuration request model',
      schema: {
        type: apigateway.JsonSchemaType.OBJECT,
        required: ['simulationType', 'startDate', 'endDate', 'resolution'],
        properties: {
          simulationType: {
            type: apigateway.JsonSchemaType.STRING,
            enum: ['GC_CLASSIC', 'GCHP']
          },
          startDate: {
            type: apigateway.JsonSchemaType.STRING,
            pattern: '^\\d{4}-\\d{2}-\\d{2}$'
          },
          endDate: {
            type: apigateway.JsonSchemaType.STRING,
            pattern: '^\\d{4}-\\d{2}-\\d{2}$'
          },
          resolution: {
            type: apigateway.JsonSchemaType.STRING,
            enum: ['4x5', '2x2.5', '0.5x0.625', 'C24', 'C48', 'C90', 'C180', 'C360']
          },
          chemistry: {
            type: apigateway.JsonSchemaType.STRING
          },
          processorType: {
            type: apigateway.JsonSchemaType.STRING,
            enum: ['graviton4', 'graviton3', 'amd', 'intel']
          },
          instanceSize: {
            type: apigateway.JsonSchemaType.STRING,
            enum: ['small', 'medium', 'large', 'xlarge']
          },
          useSpot: {
            type: apigateway.JsonSchemaType.BOOLEAN
          }
        }
      }
    });

    // Create /simulations resource
    const simulationsResource = this.api.root.addResource('simulations');

    // POST /simulations - Submit new simulation
    const submitIntegration = new apigateway.LambdaIntegration(this.submitSimulationLambda, {
      proxy: true,
      integrationResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'"
          }
        }
      ]
    });

    simulationsResource.addMethod('POST', submitIntegration, {
      requestValidator,
      requestModels: {
        'application/json': simulationConfigModel
      },
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true
          }
        }
      ]
    });

    // GET /simulations - List all simulations for user
    const listIntegration = new apigateway.LambdaIntegration(listSimulationsLambda, {
      proxy: true,
      integrationResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'"
          }
        }
      ]
    });

    simulationsResource.addMethod('GET', listIntegration, {
      requestParameters: {
        'method.request.querystring.status': false,
        'method.request.querystring.limit': false,
        'method.request.querystring.nextToken': false
      },
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true
          }
        }
      ]
    });

    // Create /simulations/{simulationId} resource
    const simulationResource = simulationsResource.addResource('{simulationId}');

    // GET /simulations/{simulationId} - Get specific simulation
    const getIntegration = new apigateway.LambdaIntegration(getSimulationLambda, {
      proxy: true,
      integrationResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'"
          }
        }
      ]
    });

    simulationResource.addMethod('GET', getIntegration, {
      requestParameters: {
        'method.request.path.simulationId': true
      },
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true
          }
        }
      ]
    });

    // POST /simulations/{simulationId}/cancel - Cancel simulation
    const cancelResource = simulationResource.addResource('cancel');
    const cancelIntegration = new apigateway.LambdaIntegration(cancelSimulationLambda, {
      proxy: true,
      integrationResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'"
          }
        }
      ]
    });

    cancelResource.addMethod('POST', cancelIntegration, {
      requestParameters: {
        'method.request.path.simulationId': true
      },
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true
          }
        }
      ]
    });

    // Create usage plan for throttling
    const usagePlan = this.api.addUsagePlan('SimulationsApiUsagePlan', {
      name: 'Standard Usage Plan',
      description: 'Standard usage plan with rate limiting',
      throttle: {
        rateLimit: 100,  // requests per second
        burstLimit: 200  // maximum concurrent requests
      },
      quota: {
        limit: 10000,    // requests per period
        period: apigateway.Period.DAY
      }
    });

    usagePlan.addApiStage({
      stage: this.api.deploymentStage
    });

    // Output values
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      description: 'GEOS-Chem Simulations API URL',
      exportName: 'GeosChemApiUrl'
    });

    new cdk.CfnOutput(this, 'SubmitSimulationLambdaArn', {
      value: this.submitSimulationLambda.functionArn,
      description: 'ARN of the submit simulation Lambda function'
    });

    new cdk.CfnOutput(this, 'StateMachineArn', {
      value: this.geosChemStateMachine.stateMachineArn,
      description: 'ARN of the GEOS-Chem workflow state machine'
    });
  }
}
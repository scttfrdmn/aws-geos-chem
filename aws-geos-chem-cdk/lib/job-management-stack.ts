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
    this.submitSimulationLambda = new lambda.Function(this, 'SubmitSimulationHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'submit-simulation.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda')),
      role: lambdaExecutionRole,
      environment: {
        SIMULATIONS_TABLE: props.simulationsTable.tableName,
        USERS_BUCKET: props.usersBucket.bucketName,
        SYSTEM_BUCKET: props.systemBucket.bucketName,
        JOB_QUEUE: props.jobQueue.jobQueueName
      },
      timeout: cdk.Duration.seconds(30)
    });

    // Validate configuration Lambda
    const validateConfigurationLambda = new lambda.Function(this, 'ValidateConfigurationHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'validate-configuration.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda')),
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
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda')),
      role: lambdaExecutionRole,
      environment: {
        SIMULATIONS_TABLE: props.simulationsTable.tableName,
        JOB_QUEUE: props.jobQueue.jobQueueName
      },
      timeout: cdk.Duration.seconds(30)
    });

    // Monitor job status Lambda
    const monitorJobStatusLambda = new lambda.Function(this, 'MonitorJobStatusHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'monitor-job-status.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda')),
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
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda')),
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
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda')),
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

    // Output values
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
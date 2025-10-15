#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BenchmarkingStack } from '../lib/benchmarking-stack';

const app = new cdk.App();

// Environment configuration
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-west-2'
};

// Get environment name (dev, test, prod) defaulting to dev
const environment = process.env.ENV || 'dev';
console.log(`Deploying to environment: ${environment}`);

// Prefix for all resources
const projectPrefix = 'geos-chem';
console.log(`Using project prefix: ${projectPrefix}`);

// Create BenchmarkingStack
const benchmarkingStack = new BenchmarkingStack(app, `BenchmarkingStack`, {
  env,
  description: `Benchmarking services for GEOS-Chem AWS Cloud Runner (${environment})`
});

// Add tags to all resources
cdk.Tags.of(app).add('Project', 'GEOS-Chem-Cloud-Runner');
cdk.Tags.of(app).add('Environment', environment);
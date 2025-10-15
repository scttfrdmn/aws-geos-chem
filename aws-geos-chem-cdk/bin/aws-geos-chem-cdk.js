#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
require("source-map-support/register");
const cdk = __importStar(require("aws-cdk-lib"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const core_infrastructure_stack_1 = require("../lib/core-infrastructure-stack");
const web_application_stack_1 = require("../lib/web-application-stack");
const compute_resources_stack_1 = require("../lib/compute-resources-stack");
const data_services_stack_1 = require("../lib/data-services-stack");
const job_management_stack_1 = require("../lib/job-management-stack");
const visualization_stack_1 = require("../lib/visualization-stack");
const auth_stack_1 = require("../lib/auth-stack");
const cost_tracking_stack_1 = require("../lib/cost-tracking-stack");
const app = new cdk.App();
// Load custom tags if available
let customTags = {};
const tagsPath = path.join(__dirname, 'cdk-tags.js');
if (fs.existsSync(tagsPath)) {
    try {
        customTags = require('./cdk-tags');
        console.log('Loaded custom CDK tags:', customTags);
    }
    catch (error) {
        console.warn('Error loading custom CDK tags:', error.message);
    }
}
// Environment configuration
const env = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
};
// Get environment name (dev, test, prod) defaulting to dev
const environment = process.env.ENV || 'dev';
console.log(`Deploying to environment: ${environment}`);
// Prefix for all resources - can be overridden by environment variables
const projectPrefix = process.env.PROJECT_PREFIX || 'geos-chem';
console.log(`Using project prefix: ${projectPrefix}`);
// Create the stacks
const coreInfraProps = {
    env,
    description: `Core infrastructure components for GEOS-Chem AWS Cloud Runner (${environment})`,
    vpcCidr: process.env.VPC_CIDR || '10.0.0.0/16',
    maxAzs: parseInt(process.env.MAX_AZS || '2', 10),
    natGateways: parseInt(process.env.NAT_GATEWAYS || '1', 10)
};
const coreInfraStack = new core_infrastructure_stack_1.CoreInfrastructureStack(app, `${projectPrefix}-core-infra`, coreInfraProps);
const dataServicesStack = new data_services_stack_1.DataServicesStack(app, `${projectPrefix}-data`, {
    env,
    description: `Data services components for GEOS-Chem AWS Cloud Runner (${environment})`,
    vpc: coreInfraStack.vpc,
    logRetentionDays: parseInt(process.env.LOG_RETENTION_DAYS || '90', 10),
    logTransitionDays: parseInt(process.env.LOG_TRANSITION_DAYS || '30', 10),
    userDataTransitionDays: parseInt(process.env.USER_DATA_TRANSITION_DAYS || '30', 10)
});
const computeResourcesStack = new compute_resources_stack_1.ComputeResourcesStack(app, `${projectPrefix}-compute`, {
    env,
    description: `Compute resources for GEOS-Chem AWS Cloud Runner (${environment})`,
    vpc: coreInfraStack.vpc,
    gravitonInstanceTypes: (process.env.GRAVITON_INSTANCE_TYPES || 'c7g.4xlarge,c7g.8xlarge').split(','),
    x86InstanceTypes: (process.env.X86_INSTANCE_TYPES || 'c6i.4xlarge,c6i.8xlarge').split(','),
    highMemInstanceTypes: (process.env.HIGH_MEM_INSTANCE_TYPES || 'r7g.4xlarge,r6i.8xlarge').split(','),
    batchMinVcpu: parseInt(process.env.BATCH_MIN_VCPU || '0', 10),
    batchMaxVcpu: parseInt(process.env.BATCH_MAX_VCPU || '1000', 10),
    batchDesiredVcpu: parseInt(process.env.BATCH_DESIRED_VCPU || '0', 10),
    batchHighMemMaxVcpu: parseInt(process.env.BATCH_HIGHMEM_MAX_VCPU || '500', 10),
    jobQueueName: process.env.JOB_QUEUE_NAME || 'geos-chem-standard',
    highPriorityQueueName: process.env.HIGH_PRIORITY_QUEUE_NAME || 'geos-chem-high-priority',
    ecrRepositoryName: process.env.ECR_REPOSITORY_NAME || 'geos-chem',
    ecrMaxImages: parseInt(process.env.ECR_MAX_IMAGES || '10', 10)
});
const authStack = new auth_stack_1.AuthStack(app, `${projectPrefix}-auth`, {
    env,
    description: `Authentication services for GEOS-Chem AWS Cloud Runner (${environment})`
});
const jobManagementStack = new job_management_stack_1.JobManagementStack(app, `${projectPrefix}-job-management`, {
    env,
    description: `Job management services for GEOS-Chem AWS Cloud Runner (${environment})`,
    simulationsTable: dataServicesStack.simulationsTable,
    usersBucket: dataServicesStack.usersBucket,
    systemBucket: dataServicesStack.systemBucket,
    jobQueue: computeResourcesStack.jobQueue
});
const visualizationStack = new visualization_stack_1.VisualizationStack(app, `${projectPrefix}-visualization`, {
    env,
    description: `Visualization services for GEOS-Chem AWS Cloud Runner (${environment})`,
    usersBucket: dataServicesStack.usersBucket,
    simulationsTable: dataServicesStack.simulationsTable
});
const costTrackingStack = new cost_tracking_stack_1.CostTrackingStack(app, `${projectPrefix}-cost-tracking`, {
    env,
    description: `Cost tracking and optimization services for GEOS-Chem AWS Cloud Runner (${environment})`,
    simulationsTable: dataServicesStack.simulationsTable
});
const webAppStack = new web_application_stack_1.WebApplicationStack(app, `${projectPrefix}-web-app`, {
    env,
    description: `Web application components for GEOS-Chem AWS Cloud Runner (${environment})`,
    vpc: coreInfraStack.vpc
});
// Add dependencies
dataServicesStack.addDependency(coreInfraStack);
computeResourcesStack.addDependency(coreInfraStack);
jobManagementStack.addDependency(dataServicesStack);
jobManagementStack.addDependency(computeResourcesStack);
jobManagementStack.addDependency(authStack);
visualizationStack.addDependency(dataServicesStack);
costTrackingStack.addDependency(dataServicesStack);
webAppStack.addDependency(coreInfraStack);
webAppStack.addDependency(jobManagementStack);
webAppStack.addDependency(visualizationStack);
webAppStack.addDependency(authStack);
webAppStack.addDependency(costTrackingStack);
// Add tags to all resources - default tags
cdk.Tags.of(app).add('Project', 'GEOS-Chem-Cloud-Runner');
cdk.Tags.of(app).add('Environment', environment);
// Add custom tags if available
if (customTags && typeof customTags === 'object') {
    Object.entries(customTags).forEach(([key, value]) => {
        if (typeof value === 'string') {
            cdk.Tags.of(app).add(key, value);
        }
    });
}

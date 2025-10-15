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
exports.WebApplicationStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const cloudfront = __importStar(require("aws-cdk-lib/aws-cloudfront"));
const origins = __importStar(require("aws-cdk-lib/aws-cloudfront-origins"));
const cognito = __importStar(require("aws-cdk-lib/aws-cognito"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const s3deploy = __importStar(require("aws-cdk-lib/aws-s3-deployment"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class WebApplicationStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // Create an S3 bucket for web application static assets
        this.webBucket = new s3.Bucket(this, 'WebsiteBucket', {
            websiteIndexDocument: 'index.html',
            websiteErrorDocument: 'index.html', // SPA routing
            publicReadAccess: false,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: cdk.RemovalPolicy.DESTROY, // Changed to DESTROY for easier testing
            autoDeleteObjects: true, // Changed to true for easier testing
            versioned: true,
            encryption: s3.BucketEncryption.S3_MANAGED,
            cors: [
                {
                    allowedHeaders: ['*'],
                    allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
                    allowedOrigins: ['*'],
                    maxAge: 3000
                }
            ]
        });
        // Create a CloudFront origin access identity
        const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OAI');
        // Grant read access to CloudFront
        this.webBucket.addToResourcePolicy(new iam.PolicyStatement({
            actions: ['s3:GetObject'],
            resources: [this.webBucket.arnForObjects('*')],
            principals: [
                new iam.CanonicalUserPrincipal(originAccessIdentity.cloudFrontOriginAccessIdentityS3CanonicalUserId)
            ]
        }));
        // Create a CloudFront distribution for the S3 website
        this.distribution = new cloudfront.Distribution(this, 'WebDistribution', {
            defaultBehavior: {
                origin: new origins.S3Origin(this.webBucket, {
                    originAccessIdentity
                }),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
                cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
                responseHeadersPolicy: new cloudfront.ResponseHeadersPolicy(this, 'SecurityHeadersPolicy', {
                    customHeadersBehavior: {
                        customHeaders: [
                            {
                                header: 'X-Content-Type-Options',
                                value: 'nosniff',
                                override: true
                            },
                            {
                                header: 'X-Frame-Options',
                                value: 'SAMEORIGIN',
                                override: true
                            },
                            {
                                header: 'X-XSS-Protection',
                                value: '1; mode=block',
                                override: true
                            }
                        ]
                    },
                    securityHeadersBehavior: {
                        contentSecurityPolicy: {
                            contentSecurityPolicy: "default-src 'self'; img-src 'self' data: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; connect-src 'self' https://*.amazonaws.com https://*.amazoncognito.com;",
                            override: true
                        },
                        strictTransportSecurity: {
                            accessControlMaxAge: cdk.Duration.seconds(31536000),
                            includeSubdomains: true,
                            override: true
                        }
                    }
                })
            },
            priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
            enableLogging: true,
            defaultRootObject: 'index.html',
            errorResponses: [
                {
                    httpStatus: 404,
                    responseHttpStatus: 200,
                    responsePagePath: '/index.html' // For SPA routing
                }
            ],
            minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
            httpVersion: cloudfront.HttpVersion.HTTP2
        });
        // Create a Cognito User Pool for authentication
        this.userPool = new cognito.UserPool(this, 'UserPool', {
            selfSignUpEnabled: true,
            autoVerify: {
                email: true
            },
            standardAttributes: {
                email: {
                    required: true,
                    mutable: true
                },
                givenName: {
                    required: false,
                    mutable: true
                },
                familyName: {
                    required: false,
                    mutable: true
                },
                phoneNumber: {
                    required: false,
                    mutable: true
                }
            },
            passwordPolicy: {
                minLength: 8,
                requireLowercase: true,
                requireUppercase: true,
                requireDigits: true,
                requireSymbols: true
            },
            accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
            removalPolicy: cdk.RemovalPolicy.RETAIN
        });
        // Create User Pool Client
        const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
            userPool: this.userPool,
            authFlows: {
                userPassword: true,
                userSrp: true,
                custom: true
            },
            oAuth: {
                flows: {
                    implicitCodeGrant: true,
                    authorizationCodeGrant: true
                },
                scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
                callbackUrls: [
                    `https://${this.distribution.distributionDomainName}/callback`,
                    'http://localhost:3000/callback'
                ],
                logoutUrls: [
                    `https://${this.distribution.distributionDomainName}`,
                    'http://localhost:3000'
                ]
            },
            supportedIdentityProviders: [
                cognito.UserPoolClientIdentityProvider.COGNITO
            ]
        });
        // Create Cognito Identity Pool
        this.identityPool = new cognito.CfnIdentityPool(this, 'IdentityPool', {
            allowUnauthenticatedIdentities: false,
            cognitoIdentityProviders: [
                {
                    clientId: userPoolClient.userPoolClientId,
                    providerName: this.userPool.userPoolProviderName
                }
            ]
        });
        // Create roles for authenticated users
        const authenticatedRole = new iam.Role(this, 'CognitoDefaultAuthenticatedRole', {
            assumedBy: new iam.FederatedPrincipal('cognito-identity.amazonaws.com', {
                StringEquals: {
                    'cognito-identity.amazonaws.com:aud': this.identityPool.ref
                },
                'ForAnyValue:StringLike': {
                    'cognito-identity.amazonaws.com:amr': 'authenticated'
                }
            }, 'sts:AssumeRoleWithWebIdentity')
        });
        // Grant authenticated users access to API Gateway and their own S3 objects
        authenticatedRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'execute-api:Invoke'
            ],
            resources: [
                `arn:aws:execute-api:${this.region}:${this.account}:*/*`
            ]
        }));
        authenticatedRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                's3:GetObject',
                's3:PutObject',
                's3:DeleteObject'
            ],
            resources: [
                this.webBucket.arnForObjects('users/${cognito-identity.amazonaws.com:sub}/*')
            ]
        }));
        // Attach roles to identity pool
        new cognito.CfnIdentityPoolRoleAttachment(this, 'IdentityPoolRoleAttachment', {
            identityPoolId: this.identityPool.ref,
            roles: {
                authenticated: authenticatedRole.roleArn
            }
        });
        // Create API Gateway
        this.api = new apigateway.RestApi(this, 'GeosChemApi', {
            description: 'API for GEOS-Chem AWS Cloud Runner',
            deployOptions: {
                stageName: 'v1',
                loggingLevel: apigateway.MethodLoggingLevel.INFO,
                dataTraceEnabled: true
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
                ]
            }
        });
        // Create an authorizer for the API using Cognito User Pool
        const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'ApiAuthorizer', {
            cognitoUserPools: [this.userPool]
        });
        // Create a simple Lambda function for API health check
        const healthCheckLambda = new lambda.Function(this, 'HealthCheckFunction', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'index.handler',
            code: lambda.Code.fromInline(`
        exports.handler = async function(event, context) {
          return {
            statusCode: 200,
            body: JSON.stringify({
              status: 'healthy',
              timestamp: new Date().toISOString(),
              version: '1.0.0',
              environment: process.env.ENV || 'development'
            })
          };
        };
      `)
        });
        // Add API endpoint for health check (public)
        const healthResource = this.api.root.addResource('health');
        healthResource.addMethod('GET', new apigateway.LambdaIntegration(healthCheckLambda));
        // Add protected API resource structure
        const apiResource = this.api.root.addResource('api');
        const simulationsResource = apiResource.addResource('simulations');
        // Placeholder for actual Lambda functions
        // These would be replaced with actual implementations
        const listSimulationsLambda = new lambda.Function(this, 'ListSimulationsFunction', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'index.handler',
            code: lambda.Code.fromInline(`
        exports.handler = async function(event, context) {
          return {
            statusCode: 200,
            body: JSON.stringify({
              message: 'Simulations list placeholder',
              simulations: [
                {
                  simulationId: 'sim-1',
                  name: 'Test Simulation 1',
                  status: 'COMPLETED',
                  createdAt: '2023-09-15T12:34:56Z'
                },
                {
                  simulationId: 'sim-2',
                  name: 'Test Simulation 2',
                  status: 'RUNNING',
                  createdAt: '2023-09-16T10:22:33Z'
                }
              ]
            })
          };
        };
      `)
        });
        // Add method with Cognito authorization
        simulationsResource.addMethod('GET', new apigateway.LambdaIntegration(listSimulationsLambda), {
            authorizer: authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO
        });
        // Create AWS exports configuration file (for Amplify)
        const awsExportsContent = `// This file is auto-generated during CDK deployment
// Do not modify directly

const awsExports = {
  // Amazon Cognito configuration
  Auth: {
    region: '${this.region}',
    userPoolId: '${this.userPool.userPoolId}',
    userPoolWebClientId: '${userPoolClient.userPoolClientId}',
    identityPoolId: '${this.identityPool.ref}',
    mandatorySignIn: true,
    authenticationFlowType: 'USER_SRP_AUTH'
  },
  // API Gateway configuration
  API: {
    endpoints: [
      {
        name: 'GeosChemAPI',
        endpoint: '${this.api.url}',
        region: '${this.region}'
      }
    ]
  },
  // S3 configuration for result storage
  Storage: {
    AWSS3: {
      bucket: '${this.webBucket.bucketName}',
      region: '${this.region}'
    }
  }
};

export default awsExports;`;
        // Write AWS exports file to a temporary directory
        const tempDir = path.join('/tmp', 'geos-chem-web-interface');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        const awsExportsPath = path.join(tempDir, 'aws-exports.js');
        fs.writeFileSync(awsExportsPath, awsExportsContent);
        // Create script to build and deploy the web application
        const webInterfacePath = path.join(__dirname, '../../web-interface');
        const buildScriptContent = `#!/bin/bash
set -e

# Check if web interface directory exists
if [ ! -d "${webInterfacePath}" ]; then
  echo "Web interface directory not found at ${webInterfacePath}"
  exit 1
fi

# Copy AWS exports to the web interface src directory
mkdir -p "${webInterfacePath}/src"
cp "${awsExportsPath}" "${webInterfacePath}/src/aws-exports.js"

# Navigate to web interface directory
cd "${webInterfacePath}"

# Install dependencies
echo "Installing dependencies..."
npm install

# Build the application
echo "Building web interface..."
npm run build

# Return to original directory
cd -

echo "Web interface build complete!"
`;
        const buildScriptPath = path.join(tempDir, 'build-web-interface.sh');
        fs.writeFileSync(buildScriptPath, buildScriptContent);
        fs.chmodSync(buildScriptPath, '755');
        // Deploy the S3 bucket with the web application contents
        // Note: In a real pipeline, you would build the web app as part of the CI/CD process
        // For simplicity, we're just creating a placeholder deployment
        new s3deploy.BucketDeployment(this, 'DeployWebApp', {
            sources: [s3deploy.Source.asset(path.join(tempDir))],
            destinationBucket: this.webBucket,
            destinationKeyPrefix: 'config'
        });
        // Outputs
        new cdk.CfnOutput(this, 'WebsiteURL', {
            value: `https://${this.distribution.distributionDomainName}`,
            description: 'URL for GEOS-Chem web interface'
        });
        new cdk.CfnOutput(this, 'UserPoolId', {
            value: this.userPool.userPoolId,
            description: 'Cognito User Pool ID'
        });
        new cdk.CfnOutput(this, 'UserPoolClientId', {
            value: userPoolClient.userPoolClientId,
            description: 'Cognito User Pool Client ID'
        });
        new cdk.CfnOutput(this, 'IdentityPoolId', {
            value: this.identityPool.ref,
            description: 'Cognito Identity Pool ID'
        });
        new cdk.CfnOutput(this, 'ApiEndpoint', {
            value: this.api.url,
            description: 'API Gateway endpoint URL'
        });
        new cdk.CfnOutput(this, 'WebBucketName', {
            value: this.webBucket.bucketName,
            description: 'S3 bucket for web application'
        });
        new cdk.CfnOutput(this, 'AwsExportsPath', {
            value: awsExportsPath,
            description: 'Path to the AWS exports configuration file'
        });
        new cdk.CfnOutput(this, 'BuildScriptPath', {
            value: buildScriptPath,
            description: 'Path to the web interface build script'
        });
    }
}
exports.WebApplicationStack = WebApplicationStack;

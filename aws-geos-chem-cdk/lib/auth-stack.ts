import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as path from 'path';

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly identityPool: cognito.CfnIdentityPool;
  public readonly authenticatedRole: iam.Role;
  public readonly unauthenticatedRole: iam.Role;
  public readonly authApi: apigateway.RestApi;
  
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create Cognito User Pool
    this.userPool = new cognito.UserPool(this, 'GeosChemUserPool', {
      userPoolName: 'geos-chem-users',
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
        username: true
      },
      autoVerify: {
        email: true
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true
        },
        givenName: {
          required: true,
          mutable: true
        },
        familyName: {
          required: true,
          mutable: true
        }
      },
      customAttributes: {
        'institution': new cognito.StringAttribute({ mutable: true }),
        'organization': new cognito.StringAttribute({ mutable: true }),
        'researchArea': new cognito.StringAttribute({ mutable: true }),
        'country': new cognito.StringAttribute({ mutable: true })
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

    // Create app client
    this.userPoolClient = this.userPool.addClient('GeosChemWebApp', {
      userPoolClientName: 'geos-chem-web-app',
      generateSecret: false,
      authFlows: {
        userPassword: true,
        userSrp: true,
        adminUserPassword: true
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: true
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
          cognito.OAuthScope.COGNITO_ADMIN
        ],
        callbackUrls: [
          'http://localhost:3000/callback',
          'https://geos-chem-cloud-runner.s3-website-us-east-1.amazonaws.com/callback'
        ],
        logoutUrls: [
          'http://localhost:3000/',
          'https://geos-chem-cloud-runner.s3-website-us-east-1.amazonaws.com/'
        ]
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO
      ]
    });

    // Create Identity Pool
    this.identityPool = new cognito.CfnIdentityPool(this, 'GeosChemIdentityPool', {
      identityPoolName: 'geos_chem_identity_pool',
      allowUnauthenticatedIdentities: false,
      cognitoIdentityProviders: [
        {
          clientId: this.userPoolClient.userPoolClientId,
          providerName: this.userPool.userPoolProviderName
        }
      ]
    });

    // Create IAM roles for authenticated and unauthenticated users
    this.authenticatedRole = new iam.Role(this, 'AuthenticatedRole', {
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': this.identityPool.ref
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'authenticated'
          }
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
      description: 'Role for authenticated GEOS-Chem users',
    });

    this.unauthenticatedRole = new iam.Role(this, 'UnauthenticatedRole', {
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': this.identityPool.ref
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'unauthenticated'
          }
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
      description: 'Role for unauthenticated GEOS-Chem users',
    });

    // Attach minimal privileges to unauthenticated role
    this.unauthenticatedRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'cognito-sync:*'
        ],
        resources: ['*']
      })
    );

    // Attach policies to authenticated role
    this.authenticatedRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'cognito-sync:*',
          'cognito-identity:*'
        ],
        resources: ['*']
      })
    );

    // Set role mappings on the Identity Pool
    new cognito.CfnIdentityPoolRoleAttachment(this, 'IdentityPoolRoleAttachment', {
      identityPoolId: this.identityPool.ref,
      roles: {
        authenticated: this.authenticatedRole.roleArn,
        unauthenticated: this.unauthenticatedRole.roleArn
      }
    });

    // Create Lambda function for custom Cognito triggers
    const authTriggerLambda = new lambda.Function(this, 'AuthTriggerFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'auth-triggers.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda', 'auth')),
      environment: {
        USER_POOL_ID: this.userPool.userPoolId,
        CLIENT_ID: this.userPoolClient.userPoolClientId
      }
    });

    // Add Lambda trigger for post confirmation
    this.userPool.addTrigger(
      cognito.UserPoolOperation.POST_CONFIRMATION,
      authTriggerLambda
    );

    // Create API Gateway for auth operations
    this.authApi = new apigateway.RestApi(this, 'AuthApi', {
      restApiName: 'GEOS-Chem Auth API',
      description: 'API for GEOS-Chem authentication operations',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS
      }
    });

    // Create Lambda function for custom authentication operations
    const authOperationsLambda = new lambda.Function(this, 'AuthOperationsFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'auth-operations.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda', 'auth')),
      environment: {
        USER_POOL_ID: this.userPool.userPoolId,
        CLIENT_ID: this.userPoolClient.userPoolClientId
      }
    });

    // Grant Cognito permissions to the Lambda
    authOperationsLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'cognito-idp:AdminCreateUser',
          'cognito-idp:AdminGetUser',
          'cognito-idp:AdminUpdateUserAttributes',
          'cognito-idp:AdminDeleteUser',
          'cognito-idp:ListUsers'
        ],
        resources: [this.userPool.userPoolArn]
      })
    );

    // Create API resources and methods
    const usersResource = this.authApi.root.addResource('users');
    usersResource.addMethod('POST', new apigateway.LambdaIntegration(authOperationsLambda));
    usersResource.addMethod('GET', new apigateway.LambdaIntegration(authOperationsLambda));
    
    const userResource = usersResource.addResource('{userId}');
    userResource.addMethod('GET', new apigateway.LambdaIntegration(authOperationsLambda));
    userResource.addMethod('PUT', new apigateway.LambdaIntegration(authOperationsLambda));
    userResource.addMethod('DELETE', new apigateway.LambdaIntegration(authOperationsLambda));

    // Output the resources
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'The ID of the Cognito User Pool'
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'The ID of the Cognito User Pool Client'
    });

    new cdk.CfnOutput(this, 'IdentityPoolId', {
      value: this.identityPool.ref,
      description: 'The ID of the Cognito Identity Pool'
    });

    new cdk.CfnOutput(this, 'AuthApiUrl', {
      value: this.authApi.url,
      description: 'The URL of the Auth API'
    });
  }
}
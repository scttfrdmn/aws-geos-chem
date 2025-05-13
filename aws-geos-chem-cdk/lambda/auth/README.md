# GEOS-Chem AWS Cloud Runner Authentication Service

This directory contains Lambda functions for handling user authentication and management for the GEOS-Chem AWS Cloud Runner platform.

## Overview

The authentication service provides:

1. **User Registration and Authentication**: Using Amazon Cognito for secure user management
2. **Custom Authentication Triggers**: Lambda functions to extend Cognito functionality
3. **User Management API**: API Gateway endpoints for administration

## Components

### Cognito User Pool

The Cognito User Pool handles:

- User registration and sign-in
- Multi-factor authentication
- Password policies and account recovery
- Email verification

### Lambda Triggers

#### auth-triggers.js

This Lambda function handles Cognito User Pool triggers:

- **PostConfirmation_ConfirmSignUp**: Triggered after a user confirms their account
  - Creates a user record in DynamoDB with default quotas
  - Sets up initial user attributes
  
- **PreSignUp_SignUp**: Triggered before a user signs up
  - Can be used for additional validation or auto-confirmation

- **CustomMessage_SignUp**: Triggered when sending confirmation emails
  - Customizes the email templates with GEOS-Chem branding

#### auth-operations.js

This Lambda function provides custom user management operations via API Gateway:

- **POST /users**: Create a new user
- **GET /users**: List all users (with optional filtering)
- **GET /users/{userId}**: Get details of a specific user
- **PUT /users/{userId}**: Update a user's attributes
- **DELETE /users/{userId}**: Delete a user

## User Attributes

The authentication service captures the following user attributes:

- **Standard Attributes**:
  - Email
  - Given Name
  - Family Name

- **Custom Attributes**:
  - Institution
  - Research Area
  - Country

## Security Considerations

The authentication service implements the following security measures:

- Strong password policies
- Email verification
- Fine-grained IAM permissions
- JWT token-based authentication
- HTTPS for all API calls
- User isolation with separate IAM roles

## API Usage Examples

### Create a new user

```json
POST /users
{
  "email": "researcher@university.edu",
  "password": "TemporaryPassword123!",
  "givenName": "Jane",
  "familyName": "Researcher",
  "institution": "University Research Center",
  "researchArea": "Atmospheric Chemistry",
  "country": "United States"
}
```

### List users

```
GET /users
```

Optional query parameters:
- `filter`: Filter string (e.g., "email^=researcher")
- `paginationToken`: Token for pagination

### Get a specific user

```
GET /users/user123
```

### Update a user

```json
PUT /users/user123
{
  "givenName": "Jane",
  "familyName": "Scientist",
  "institution": "New Research Center"
}
```

### Delete a user

```
DELETE /users/user123
```

## Integration with Web Application

The web application will use the Cognito User Pool for authentication:

1. Users register through the web interface
2. Email verification is required
3. After login, the application requests temporary AWS credentials
4. These credentials grant limited access to resources based on the user's role

## Integration with Job Management

The job management service will:

1. Validate the user's identity using Cognito tokens
2. Check the user's quota before submitting jobs
3. Track resource usage per user
4. Enforce resource limits based on user roles
# GEOS-Chem AWS Cloud Runner - Web Interface Implementation

This document describes the implementation of the Web Interface for the GEOS-Chem AWS Cloud Runner system. The web interface provides a user-friendly way for researchers to configure, submit, monitor, and analyze GEOS-Chem simulations running on AWS.

## Architecture Overview

The web interface is built as a single-page application (SPA) with the following key technologies:

- **Frontend**: React + TypeScript with Material-UI
- **State Management**: Redux with Redux Toolkit
- **Authentication**: Amazon Cognito
- **API Communication**: AWS Amplify
- **Deployment**: S3 + CloudFront

## Implementation Details

The web interface follows modern React best practices and is organized into the following key components:

### 1. Application Structure

```
web-interface/
├── public/              # Static files
├── src/
│   ├── assets/          # Images, fonts, etc.
│   ├── components/      # Reusable React components
│   │   ├── common/      # Shared components
│   │   ├── forms/       # Form components
│   │   ├── layout/      # Layout components
│   │   └── viz/         # Visualization components
│   ├── context/         # React context providers
│   ├── hooks/           # Custom React hooks
│   ├── pages/           # Top-level page components
│   ├── services/        # API and other services
│   ├── store/           # Redux store configuration
│   │   └── slices/      # Redux toolkit slices
│   ├── styles/          # Global styles and theme
│   ├── utils/           # Utility functions
│   ├── App.tsx          # Main app component
│   ├── aws-exports.ts   # AWS configuration
│   └── index.tsx        # Entry point
├── package.json         # Dependencies and scripts
└── tsconfig.json        # TypeScript configuration
```

### 2. Authentication

Authentication is handled using Amazon Cognito, which provides a secure way to manage user identities. The implementation includes:

- **User Registration**: Users can sign up with email and password
- **Email Verification**: Confirmation codes sent via email
- **Password Recovery**: Secure password reset flow
- **Session Management**: Automatic token refresh
- **Profile Management**: Edit user information

Key components:
- `AuthContext.tsx`: Context provider for authentication state
- `authSlice.ts`: Redux slice for auth state management
- `authService.ts`: Service for interacting with Cognito
- `useAuth.ts`: Custom hook for authentication functions
- `ProtectedRoute.tsx`: Higher-order component for route protection

### 3. User Interface

The UI is built with Material-UI, providing a modern and responsive interface. Key UI components include:

- **Layouts**:
  - `MainLayout.tsx`: Layout for authenticated users
  - `AuthLayout.tsx`: Layout for authentication pages

- **Common Components**:
  - `AlertNotification.tsx`: Toast notifications
  - `StatusChip.tsx`: Display simulation status

- **Pages**:
  - `Dashboard.tsx`: Overview of simulations and costs
  - `Login.tsx`: Authentication pages
  - `Account.tsx`: User profile management

### 4. State Management

Redux is used for state management, with Redux Toolkit for simplified setup:

- **Auth State**: User authentication status and profile
- **Simulations State**: Simulation configurations and status
- **Results State**: Result files and visualizations
- **Cost State**: Cost tracking and budgeting
- **UI State**: Theme preferences, alerts, loading states

### 5. API Communication

API communication is handled through AWS Amplify, which provides a convenient way to interact with AWS services:

- `apiService.ts`: Service for making API requests
- Redux thunks for asynchronous API calls

### 6. Infrastructure Deployment

The web interface is deployed using the AWS CDK, which creates the following resources:

- **S3 Bucket**: For hosting the static assets
- **CloudFront Distribution**: For content delivery
- **Cognito User Pool**: For authentication
- **Cognito Identity Pool**: For AWS permissions
- **API Gateway**: For backend API access

The `WebApplicationStack` in the CDK code handles the creation and configuration of these resources.

## Current State and Future Work

### Completed

1. ✅ Initial React application structure
2. ✅ Authentication module with Cognito
3. ✅ User profile management
4. ✅ Dashboard page (skeleton)
5. ✅ CDK infrastructure for web application

### Next Steps

1. ⏳ Simulation configuration wizard
2. ⏳ Job monitoring component
3. ⏳ Results visualization
4. ⏳ Cost tracking UI
5. ⏳ API integration
6. ⏳ Automated testing

## Usage

To work with the web interface:

1. **Local Development**:
   ```bash
   cd web-interface
   npm install
   npm start
   ```

2. **Build for Production**:
   ```bash
   cd web-interface
   npm install
   npm run build
   ```

3. **Deploy to AWS** (via CDK):
   ```bash
   cd aws-geos-chem-cdk
   npm run deploy:dev
   ```

After deployment, the CDK will output the CloudFront URL where the application is accessible.

## Technical Decisions

1. **React + TypeScript**: Provides strong typing and better development experience
2. **Redux Toolkit**: Simplifies Redux store configuration and state management
3. **Material-UI**: Comprehensive UI framework with responsive design
4. **AWS Amplify**: Simplifies integration with AWS services
5. **CloudFront**: Provides global content delivery and HTTPS support

## Conclusion

The web interface implementation provides a solid foundation for the GEOS-Chem AWS Cloud Runner system. It follows modern best practices and is built with scalability and maintainability in mind.

The authentication module and infrastructure deployment are complete, with the next steps focusing on the simulation configuration wizard, job monitoring, and results visualization components.
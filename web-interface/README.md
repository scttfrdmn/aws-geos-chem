# GEOS-Chem Cloud Runner Web Interface

This directory contains the web interface for the GEOS-Chem AWS Cloud Runner, built with React, TypeScript, and Material-UI.

## Architecture

The web interface is a single-page application that communicates with the GEOS-Chem Cloud Runner backend APIs. It provides a user-friendly way to configure, submit, monitor, and analyze GEOS-Chem simulations running on AWS.

Key technologies:
- **React**: Frontend library for building user interfaces
- **TypeScript**: Type-safe JavaScript
- **Redux**: State management
- **Material-UI**: Component library
- **AWS Amplify**: Authentication and API communication
- **D3.js & Plotly**: Data visualization

## Project Structure

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

## Available Scripts

In the project directory, you can run:

- `npm start`: Runs the app in development mode
- `npm build`: Builds the app for production
- `npm test`: Runs tests
- `npm lint`: Lints the code
- `npm lint:fix`: Lints and fixes code issues

## Deployment

The web interface is deployed using AWS S3 and CloudFront through the AWS CDK Infrastructure. The build artifacts are uploaded to an S3 bucket configured for website hosting, and CloudFront provides the CDN distribution.

## Authentication

The web interface uses Amazon Cognito for authentication. Users can:
- Sign up for a new account
- Sign in with username and password
- Reset forgotten passwords
- Update their profile information

## Core Features

1. **Dashboard**: Overview of simulations and system status
2. **Simulation Configuration**: Multi-step wizard for setting up new simulations
3. **Simulation Monitoring**: Real-time status of running simulations
4. **Results Visualization**: Tools for viewing and analyzing simulation outputs
5. **Cost Tracking**: Monitor and optimize AWS resource usage
6. **Account Management**: User profile and settings

## Development Guidelines

- Follow the TypeScript typing system
- Use functional components with hooks
- Leverage Material-UI components for consistent UI
- Implement responsive design for all screen sizes
- Keep accessibility in mind (WCAG guidelines)
- Use lazy loading for code splitting
- Write reusable components and hooks

## Integration with Backend

The web interface communicates with the backend through AWS API Gateway. The endpoints are configured in the `aws-exports.ts` file, which is populated during deployment by the CDK infrastructure.

## State Management

Redux is used for state management with Redux Toolkit for simplified store configuration. Each major feature has its own slice for managing relevant state.

## Visualization

The web interface includes advanced visualization capabilities for GEOS-Chem outputs:
- Time series plots
- Spatial maps
- Vertical profiles
- Data summaries

These are implemented using D3.js and Plotly.js libraries.
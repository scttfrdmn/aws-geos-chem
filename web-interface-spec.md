# Web Interface Technical Specification

## Overview

The GEOS-Chem AWS Cloud Runner Web Interface provides researchers with a user-friendly method to configure, submit, monitor, and retrieve results from GEOS-Chem simulations running on AWS. This technical specification outlines the design, functionality, and implementation details.

## User Interface Flow

1. **Authentication**: Users log in using their credentials
2. **Dashboard**: Overview of current/past simulations and system status
3. **New Simulation**: Multi-step configuration wizard
4. **Monitoring**: Real-time status of running simulations
5. **Results**: Access and visualization of completed simulations
6. **Administration**: Account management and preferences

## Detailed Component Specifications

### Authentication Module

- **Technology**: Amazon Cognito
- **Features**:
  - Username/password authentication
  - Institutional federation options (OAuth)
  - MFA support
  - Role-based access control

### Dashboard Component

- **Display Elements**:
  - Active simulations with status indicators
  - Recent completed simulations
  - System notices and updates
  - Quick-start templates for common configurations
  - Resource usage and cost summaries

### Simulation Configuration Wizard

The configuration wizard will guide users through a logical sequence of steps:

#### Step 1: Simulation Type
- Selection between:
  - GEOS-Chem Classic (OpenMP, single-node)
  - GEOS-Chem High Performance (MPI, multi-node)
- Brief explanation of differences and use cases

#### Step 2: Scientific Configuration
- **Chemistry Options**:
  - Full chemistry
  - Aerosol-only
  - CH4 simulation
  - CO2 simulation
  - Transport tracers
  - Custom (advanced)
- **Emissions Options**:
  - Standard emissions
  - Custom emissions scenarios
  - HEMCO configuration options

#### Step 3: Domain and Resolution
- **For GC Classic**:
  - Global at 4°×5°, 2°×2.5°
  - Nested domains (Asia, North America, Europe)
  - Custom nested domain (advanced)
- **For GCHP**:
  - Cubed-sphere resolution selection (C24, C48, C90, C180, C360)
  - Stretched-grid options (advanced)

#### Step 4: Time Configuration
- Simulation start/end dates
- Output frequency
- Restart file options
- Spinup options

#### Step 5: Computing Resources
- **For GC Classic**:
  - Processor selection (Graviton3, Graviton4, Intel, AMD)
  - Instance size recommendation based on workload
  - Memory configuration
- **For GCHP**:
  - Processor selection (Graviton3E, Intel)
  - Number of nodes
  - Instance type selection
  - EFA networking options

#### Step 6: Cost and Performance Estimation
- Estimated runtime based on benchmarks
- Estimated cost (On-Demand vs. Spot)
- Performance metrics from similar configurations
- Cost-saving recommendations

#### Step 7: Additional Options
- Output diagnostics selection
- Post-processing options
- Notification preferences
- Advanced YAML configuration editor (for experts)

#### Step 8: Review and Submit
- Summary of all selected options
- Final cost and runtime estimates
- Option to save configuration as template
- Submit button

### Job Monitoring Component

- **Real-time Status Updates**:
  - Current stage of simulation
  - Resource utilization metrics
  - Estimated time remaining
  - Log streaming from compute nodes
- **Control Options**:
  - Pause/resume simulation
  - Cancel simulation
  - Modify resource allocation (if supported)
- **Notifications**:
  - Email/SMS alerts for completion or errors
  - Status change notifications

### Results Component

- **Results Browser**:
  - File browser for output directories
  - Metadata display
  - Quick statistics on outputs
- **Visualization Tools**:
  - Time series plotting
  - Spatial map visualization
  - Vertical profile display
  - Built-in NetCDF viewer
- **Data Management**:
  - Download options (individual files or complete archives)
  - Sharing capabilities
  - Long-term storage options
  - Cleanup tools

### Administration Component

- **User Settings**:
  - Profile management
  - API access keys
  - Notification preferences
- **Team Management** (for group accounts):
  - User roles and permissions
  - Resource allocation and quotas
- **Billing and Usage**:
  - Cost tracking
  - Usage statistics
  - Budget controls and alerts

## Technical Implementation

### Frontend Architecture

- **Framework**: React.js for dynamic UI
- **State Management**: Redux for application state
- **UI Components**: Material-UI for consistent design
- **Visualization**: D3.js and React-Plotly for data visualization
- **API Communication**: Axios for API requests

### Backend Integration

- **API Gateway**: RESTful API for all operations
- **Authentication**: JWT token-based auth with Cognito
- **Real-time Updates**: WebSockets for live monitoring
- **File Operations**: Pre-signed URLs for S3 access

### Deployment Architecture

- **Hosting**: S3 for static assets
- **CDN**: CloudFront for global distribution
- **CI/CD**: GitHub Actions or AWS CodePipeline
- **Infrastructure**: Defined in AWS CDK or Terraform

## User Experience Considerations

### Responsive Design
- Fully responsive for desktop, tablet, and mobile
- Core functionality accessible on all devices
- Advanced features optimized for desktop

### Accessibility
- WCAG 2.1 AA compliance
- Keyboard navigation support
- Screen reader compatibility
- High contrast mode

### Performance
- Lazy loading of components
- Optimized bundle size
- Caching strategies for API responses
- Compression of assets

## Development Phases

### Phase 1: MVP
- Basic authentication
- Simple configuration form for GC Classic
- Job submission and monitoring
- Basic results retrieval

### Phase 2: Enhanced Features
- Advanced configuration options
- GCHP support
- Performance and cost estimation
- Basic visualization tools

### Phase 3: Full Platform
- Complete visualization suite
- Advanced monitoring
- Template library
- Community features

## Testing Strategy

- **Unit Testing**: Jest for component testing
- **Integration Testing**: Cypress for UI workflows
- **Performance Testing**: Lighthouse for web performance
- **User Testing**: Structured feedback sessions with researchers

## Documentation

- **User Guide**: Step-by-step instructions
- **API Documentation**: For programmatic access
- **Video Tutorials**: For common workflows
- **Contextual Help**: Inline guidance in the interface

## Localization

- Initial implementation in English
- Framework for supporting additional languages
- Date/time formatting for different regions

## Security Considerations

- **Data Protection**:
  - All data encrypted at rest and in transit
  - Access controls on all resources
  - Validation of all user inputs
- **Compliance**:
  - GDPR considerations
  - Research data protection
  - Audit logging of key actions

## Mock-up Screens

(Include wireframes or mockups of key screens here)

## API Endpoints

### Simulation Management
- `POST /api/simulations`: Create new simulation
- `GET /api/simulations`: List simulations
- `GET /api/simulations/{id}`: Get simulation details
- `PUT /api/simulations/{id}/status`: Update simulation status
- `DELETE /api/simulations/{id}`: Cancel/delete simulation

### Configuration
- `GET /api/configurations/templates`: Get configuration templates
- `POST /api/configurations/validate`: Validate configuration
- `GET /api/configurations/cost-estimate`: Get cost estimate

### Results
- `GET /api/results/{simulationId}/files`: List result files
- `GET /api/results/{simulationId}/files/{path}`: Get file details
- `POST /api/results/{simulationId}/visualize`: Generate visualization

### System
- `GET /api/system/status`: Get system status
- `GET /api/system/instances`: Get available instance types
- `GET /api/system/benchmarks`: Get benchmark data

## Future Considerations

- Integration with data analysis platforms
- Support for ensemble simulations
- Machine learning for optimal configuration recommendations
- Integration with scientific workflow systems

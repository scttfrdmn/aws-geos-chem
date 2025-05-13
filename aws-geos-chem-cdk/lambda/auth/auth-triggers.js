/**
 * auth-triggers.js
 * Lambda function for handling Cognito User Pool triggers
 */

const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient();

/**
 * Main handler for Cognito User Pool triggers
 */
exports.handler = async (event, context) => {
  console.log('Auth Trigger Event:', JSON.stringify(event, null, 2));
  
  try {
    // Handle different triggers
    switch (event.triggerSource) {
      case 'PostConfirmation_ConfirmSignUp':
        return await handlePostConfirmation(event);
      case 'PreSignUp_SignUp':
        return await handlePreSignUp(event);
      case 'CustomMessage_SignUp':
        return await handleCustomMessage(event);
      default:
        // For any other triggers, just return the event
        return event;
    }
  } catch (error) {
    console.error('Error in auth trigger:', error);
    throw error;
  }
};

/**
 * Handle post confirmation trigger
 * This is triggered after a user confirms their account
 */
async function handlePostConfirmation(event) {
  const { userPoolId, userName, request } = event;
  const { userAttributes } = request;
  
  console.log(`User ${userName} confirmed registration`);
  
  try {
    // Create user record in DynamoDB with default quota
    const timestamp = new Date().toISOString();
    const userId = userName;
    
    // If the users table name is provided as an environment variable
    const usersTableName = process.env.USERS_TABLE;
    if (usersTableName) {
      await dynamoDB.put({
        TableName: usersTableName,
        Item: {
          userId: userId,
          email: userAttributes.email,
          givenName: userAttributes.given_name || '',
          familyName: userAttributes.family_name || '',
          institution: userAttributes.custom:institution || '',
          researchArea: userAttributes.custom:researchArea || '',
          country: userAttributes.custom:country || '',
          createdAt: timestamp,
          lastLogin: timestamp,
          quotaLimit: 100, // Default quota of 100 simulation hours
          quotaUsed: 0,
          status: 'ACTIVE'
        }
      }).promise();
      
      console.log(`User data created in DynamoDB for user ${userId}`);
    }
    
    // Return the event to Cognito
    return event;
  } catch (error) {
    console.error('Error creating user record:', error);
    // Return the event anyway to allow the user to be created
    return event;
  }
}

/**
 * Handle pre sign-up trigger
 * This is triggered before a user signs up
 */
async function handlePreSignUp(event) {
  // Auto-confirm users if needed
  // event.response.autoConfirmUser = true;
  
  // You can add validation logic here
  
  return event;
}

/**
 * Handle custom message trigger
 * This is triggered when a custom message needs to be sent
 */
async function handleCustomMessage(event) {
  if (event.triggerSource === 'CustomMessage_SignUp') {
    const { codeParameter } = event.request;
    const { userName, userAttributes } = event;
    
    // Customize the message
    event.response.emailSubject = 'Welcome to GEOS-Chem AWS Cloud Runner';
    event.response.emailMessage = `
      <html>
        <body>
          <h1>Welcome to GEOS-Chem AWS Cloud Runner</h1>
          <p>Hello ${userAttributes.given_name || 'Researcher'},</p>
          <p>Thank you for registering for the GEOS-Chem AWS Cloud Runner. Your account has been created and you're almost ready to start running atmospheric chemistry simulations in the cloud.</p>
          <p>Please confirm your account by entering the following code:</p>
          <h2>${codeParameter}</h2>
          <p>If you have any questions or need assistance, please contact our support team.</p>
          <p>Best regards,<br/>The GEOS-Chem Cloud Team</p>
        </body>
      </html>
    `;
  }
  
  return event;
}
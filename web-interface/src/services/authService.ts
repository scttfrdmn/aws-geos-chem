import { Auth } from 'aws-amplify';

/**
 * AuthService provides methods to interact with the AWS Cognito authentication service.
 */
class AuthService {
  /**
   * Sign in a user with username and password
   * @param username - The username of the user
   * @param password - The password of the user
   * @returns The authenticated user
   */
  async signIn(username: string, password: string): Promise<any> {
    try {
      const user = await Auth.signIn(username, password);
      return user;
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  }

  /**
   * Sign up a new user
   * @param username - The username of the user
   * @param password - The password of the user
   * @param email - The email of the user
   * @returns The result of the sign up operation
   */
  async signUp(username: string, password: string, email: string): Promise<any> {
    try {
      const result = await Auth.signUp({
        username,
        password,
        attributes: {
          email
        }
      });
      return result;
    } catch (error) {
      console.error('Error signing up:', error);
      throw error;
    }
  }

  /**
   * Confirm sign up with verification code
   * @param username - The username of the user
   * @param code - The verification code sent to the user's email
   * @returns The result of the confirm sign up operation
   */
  async confirmSignUp(username: string, code: string): Promise<any> {
    try {
      return await Auth.confirmSignUp(username, code);
    } catch (error) {
      console.error('Error confirming sign up:', error);
      throw error;
    }
  }

  /**
   * Resend confirmation code
   * @param username - The username of the user
   * @returns The result of the resend confirmation code operation
   */
  async resendConfirmationCode(username: string): Promise<any> {
    try {
      return await Auth.resendSignUp(username);
    } catch (error) {
      console.error('Error resending confirmation code:', error);
      throw error;
    }
  }

  /**
   * Sign out the current user
   */
  async signOut(): Promise<void> {
    try {
      await Auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  }

  /**
   * Get the current authenticated user
   * @returns The current authenticated user
   */
  async getCurrentUser(): Promise<any> {
    try {
      return await Auth.currentAuthenticatedUser();
    } catch (error) {
      console.error('Error getting current user:', error);
      throw error;
    }
  }

  /**
   * Get the current session
   * @returns The current session
   */
  async getCurrentSession(): Promise<any> {
    try {
      return await Auth.currentSession();
    } catch (error) {
      console.error('Error getting current session:', error);
      throw error;
    }
  }

  /**
   * Initiate forgot password flow
   * @param username - The username of the user
   * @returns The result of the forgot password operation
   */
  async forgotPassword(username: string): Promise<any> {
    try {
      return await Auth.forgotPassword(username);
    } catch (error) {
      console.error('Error initiating forgot password:', error);
      throw error;
    }
  }

  /**
   * Complete forgot password flow
   * @param username - The username of the user
   * @param code - The verification code sent to the user's email
   * @param newPassword - The new password
   * @returns The result of the forgot password submit operation
   */
  async forgotPasswordSubmit(username: string, code: string, newPassword: string): Promise<any> {
    try {
      return await Auth.forgotPasswordSubmit(username, code, newPassword);
    } catch (error) {
      console.error('Error submitting new password:', error);
      throw error;
    }
  }

  /**
   * Change password for authenticated user
   * @param user - The current user
   * @param oldPassword - The old password
   * @param newPassword - The new password
   * @returns The result of the change password operation
   */
  async changePassword(user: any, oldPassword: string, newPassword: string): Promise<any> {
    try {
      return await Auth.changePassword(user, oldPassword, newPassword);
    } catch (error) {
      console.error('Error changing password:', error);
      throw error;
    }
  }

  /**
   * Update user attributes
   * @param attributes - The attributes to update
   * @returns The result of the update user attributes operation
   */
  async updateUserAttributes(attributes: Record<string, string>): Promise<any> {
    try {
      const user = await Auth.currentAuthenticatedUser();
      return await Auth.updateUserAttributes(user, attributes);
    } catch (error) {
      console.error('Error updating user attributes:', error);
      throw error;
    }
  }

  /**
   * Verify user attribute (e.g. email)
   * @param attribute - The attribute to verify
   * @param code - The verification code
   * @returns The result of the verify attribute operation
   */
  async verifyUserAttribute(attribute: string, code: string): Promise<any> {
    try {
      return await Auth.verifyCurrentUserAttributeSubmit(attribute, code);
    } catch (error) {
      console.error(`Error verifying ${attribute}:`, error);
      throw error;
    }
  }

  /**
   * Check if the user is authenticated
   * @returns True if the user is authenticated, false otherwise
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      await Auth.currentAuthenticatedUser();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get authentication token
   * @returns The JWT token
   */
  async getToken(): Promise<string | null> {
    try {
      const session = await Auth.currentSession();
      return session.getIdToken().getJwtToken();
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  }
}

export default new AuthService();
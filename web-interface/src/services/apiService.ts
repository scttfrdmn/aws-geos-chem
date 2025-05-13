import { API } from 'aws-amplify';
import authService from './authService';

/**
 * Base API service for making requests to the backend
 */
class ApiService {
  /**
   * Make a GET request to the API
   * @param path - The API path
   * @param queryParams - Optional query parameters
   * @returns The response data
   */
  async get<T>(path: string, queryParams?: Record<string, any>): Promise<T> {
    try {
      const response = await API.get('GeosChemAPI', path, {
        queryStringParameters: queryParams
      });
      return response as T;
    } catch (error) {
      console.error(`Error making GET request to ${path}:`, error);
      throw this.handleApiError(error);
    }
  }

  /**
   * Make a POST request to the API
   * @param path - The API path
   * @param body - The request body
   * @param queryParams - Optional query parameters
   * @returns The response data
   */
  async post<T>(path: string, body: any, queryParams?: Record<string, any>): Promise<T> {
    try {
      const response = await API.post('GeosChemAPI', path, {
        body,
        queryStringParameters: queryParams
      });
      return response as T;
    } catch (error) {
      console.error(`Error making POST request to ${path}:`, error);
      throw this.handleApiError(error);
    }
  }

  /**
   * Make a PUT request to the API
   * @param path - The API path
   * @param body - The request body
   * @param queryParams - Optional query parameters
   * @returns The response data
   */
  async put<T>(path: string, body: any, queryParams?: Record<string, any>): Promise<T> {
    try {
      const response = await API.put('GeosChemAPI', path, {
        body,
        queryStringParameters: queryParams
      });
      return response as T;
    } catch (error) {
      console.error(`Error making PUT request to ${path}:`, error);
      throw this.handleApiError(error);
    }
  }

  /**
   * Make a DELETE request to the API
   * @param path - The API path
   * @param queryParams - Optional query parameters
   * @returns The response data
   */
  async delete<T>(path: string, queryParams?: Record<string, any>): Promise<T> {
    try {
      const response = await API.del('GeosChemAPI', path, {
        queryStringParameters: queryParams
      });
      return response as T;
    } catch (error) {
      console.error(`Error making DELETE request to ${path}:`, error);
      throw this.handleApiError(error);
    }
  }

  /**
   * Handle API errors
   * @param error - The error from the API
   * @returns A formatted error
   */
  private handleApiError(error: any): Error {
    // Check if it's an unauthorized error
    if (error.response && error.response.status === 401) {
      // Force sign out on unauthorized
      authService.signOut().catch((err) => {
        console.error('Error signing out after 401:', err);
      });
      return new Error('Your session has expired. Please sign in again.');
    }

    // Handle other error responses
    if (error.response && error.response.data) {
      if (error.response.data.message) {
        return new Error(error.response.data.message);
      }
      return new Error(JSON.stringify(error.response.data));
    }

    // Handle network errors
    if (error.message) {
      return new Error(error.message);
    }

    // Fallback error
    return new Error('An unexpected error occurred');
  }
}

export default new ApiService();
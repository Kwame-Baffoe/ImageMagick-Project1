// src/utils/errorHandlers.ts
export class ProcessingError extends Error {
    constructor(
      message: string,
      public code: string,
      public statusCode: number = 500,
      public details?: string
    ) {
      super(message);
      this.name = 'ProcessingError';
    }
  }
  
  export const errorHandler = (error: unknown) => {
    if (error instanceof ProcessingError) {
      return {
        success: false,
        error: error.message,
        code: error.code,
        details: error.details
      };
    }
  
    if (error instanceof Error) {
      return {
        success: false,
        error: error.message,
        code: 'UNKNOWN_ERROR'
      };
    }
  
    return {
      success: false,
      error: 'An unknown error occurred',
      code: 'UNKNOWN_ERROR'
    };
  };
  
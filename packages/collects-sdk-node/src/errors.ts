export class CollectsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CollectsError';
  }
}

export class CollectsAuthenticationError extends CollectsError {
  constructor(message: string = 'Invalid or expired NeuraVolt API key') {
    super(message);
    this.name = 'CollectsAuthenticationError';
  }
}

export class CollectsValidationError extends CollectsError {
  constructor(message: string) {
    super(message);
    this.name = 'CollectsValidationError';
  }
}

export class CollectsConflictError extends CollectsError {
  constructor(message: string) {
    super(message);
    this.name = 'CollectsConflictError';
  }
}

export class CollectsApiError extends CollectsError {
  public statusCode: number;
  public details?: any;

  constructor(message: string, statusCode: number, details?: any) {
    super(message);
    this.name = 'CollectsApiError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

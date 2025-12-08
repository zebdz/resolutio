export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string, identifier: string) {
    super(`${entity} with identifier ${identifier} not found`);
    this.name = 'NotFoundError';
  }
}

export class DuplicateError extends DomainError {
  constructor(entity: string, field: string) {
    super(`${entity} with this ${field} already exists`);
    this.name = 'DuplicateError';
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message: string = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

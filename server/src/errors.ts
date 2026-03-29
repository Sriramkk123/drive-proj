export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
    public readonly details: unknown[] = [],
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export class InvalidLinkError extends DomainError {
  constructor(message = "The provided URL is not a valid Google Drive or Photos link.") {
    super("invalid_link", message, 400);
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string) {
    super("not_found", `${resource} not found.`, 404);
  }
}

export class CollectionNotReadyError extends DomainError {
  constructor() {
    super("collection_not_ready", "Collection is still being fetched.", 409);
  }
}

export class UnauthenticatedError extends DomainError {
  constructor() {
    super("unauthenticated", "Not authenticated. Redirect to /v1/auth/google.", 401);
  }
}

export class ExportFailedError extends DomainError {
  constructor(message = "Failed to create album in Google.") {
    super("export_failed", message, 500);
  }
}

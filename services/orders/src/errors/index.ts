export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ValidationError extends AppError {
  constructor(message = "Payload invalido.", details?: unknown) {
    super(400, "VALIDATION_ERROR", message, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Acesso negado.") {
    super(403, "FORBIDDEN", message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Recurso nao encontrado.") {
    super(404, "NOT_FOUND", message);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflito de estado.") {
    super(409, "CONFLICT", message);
  }
}

export class PaymentGatewayError extends AppError {
  constructor(message = "Erro no gateway de pagamento.") {
    super(502, "PAYMENT_GATEWAY_ERROR", message);
  }
}

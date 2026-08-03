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

// Payments so lanca ValidationError/PaymentGatewayError - NotFoundError/
// ForbiddenError/ConflictError (usadas em Orders) nao se aplicam aqui,
// entao nao sao duplicadas (evita codigo morto/nao coberto por teste).

export class PaymentGatewayError extends AppError {
  constructor(message = "Erro no gateway de pagamento.") {
    super(502, "PAYMENT_GATEWAY_ERROR", message);
  }
}

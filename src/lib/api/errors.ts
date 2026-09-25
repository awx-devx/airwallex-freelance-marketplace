export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors?: Record<string, string[]>;
  readonly airwallex?: { code?: string; traceId?: string };

  constructor(init: {
    status: number;
    code: string;
    message: string;
    fieldErrors?: Record<string, string[]>;
    airwallex?: { code?: string; traceId?: string };
  }) {
    super(init.message);
    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code;
    this.fieldErrors = init.fieldErrors;
    this.airwallex = init.airwallex;
  }
}

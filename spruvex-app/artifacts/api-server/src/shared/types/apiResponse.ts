import type { PaginationMeta } from "./pagination";

export interface ApiSuccessResponse<T> {
  data: T;
}

export interface ApiPaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

import type { ApiPaginatedResponse, ApiSuccessResponse } from "../types/apiResponse";
import type { PaginationMeta } from "../types/pagination";

export function buildSuccess<T>(data: T): ApiSuccessResponse<T> {
  return { data };
}

export function buildPaginated<T>(data: T[], meta: PaginationMeta): ApiPaginatedResponse<T> {
  return { data, meta };
}

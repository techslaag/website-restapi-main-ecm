export interface IPaginateResponseMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default interface IPaginateResponse<T> extends IPaginateResponseMeta {
  items: T[];
}

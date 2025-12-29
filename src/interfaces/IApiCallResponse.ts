export default interface IApiCallResponse<T> {
  status?: 200 | 401 | 403 | 500 | 400;
  success: boolean;
  data: T;
  error?: any;
}

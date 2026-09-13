import axios from 'axios'

import { toast } from '../helper/toast'
import getEnvName from '../helper/getEnvName'

interface APIResponse<DataType> {
  message: string
  success: boolean
  data?: DataType
}

// Let per-request flags travel on the axios config so the global error
// interceptor can read them for that specific request.
declare module 'axios' {
  export interface AxiosRequestConfig {
    /** When true, the global response interceptor stays silent if this request fails. */
    skipErrorToast?: boolean
  }
}

export interface RequestOptions {
  /** Show a success toast with the response message. POST defaults to true, GET defaults to false. */
  toast?: boolean
  /** Skip the global error toast for this request. Use for expected failures (e.g. session checks). */
  skipErrorToast?: boolean
}

const apiUse = getEnvName('VITE_SYSTEM_STATUS') === 'production' ? 
  getEnvName('VITE_DEPLOY_SERVER') : getEnvName('VITE_LOCAL_SERVER')

export const API = axios.create({
  baseURL: apiUse,  
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Every failed request surfaces as an error toast — unless the request opted
// out via `skipErrorToast` (expected failures like the /users/verify probe).
API.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const skipToast = axios.isAxiosError(error) && error.config?.skipErrorToast === true
    if (!skipToast) {
      toast.error(getErrorMessage(error))
    }
    return Promise.reject(error)
  },
)

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message
    return typeof message === 'string' && message ? message : error.message
  }
  return error instanceof Error ? error.message : 'Something went wrong'
}

export const postAPICall = async <DataSendType, ResponseDataType>(url: string, data: DataSendType, options?: RequestOptions) => {
  const response = await API.post(url, data, { skipErrorToast: options?.skipErrorToast })
  const body = response.data as APIResponse<ResponseDataType>

  if (options?.toast ?? true) {
    toast.success(body.message || 'Request completed')
  }

  return body
}

export const patchAPICall = async <DataSendType, ResponseDataType>(url: string, data: DataSendType, options?: RequestOptions) => {
  const response = await API.patch(url, data, { skipErrorToast: options?.skipErrorToast })
  const body = response.data as APIResponse<ResponseDataType>
  
  if (options?.toast ?? true) {
    toast.success(body.message || 'Request completed')
  }
  return body
}

export const putAPICall = async <DataSendType, ResponseDataType>(url: string, data: DataSendType, options?: RequestOptions) => {
  const response = await API.put(url, data, { skipErrorToast: options?.skipErrorToast })
  const body = response.data as APIResponse<ResponseDataType>
  
  if (options?.toast ?? true) {
    toast.success(body.message || 'Request completed')
  }
  return body
}

export const deleteAPICall = async <DataSendType, ResponseDataType>(url: string, data?: DataSendType, options?: RequestOptions) => {
  const response = await API.delete(url, { data, skipErrorToast: options?.skipErrorToast })
  const body = response.data as APIResponse<ResponseDataType>
  if (options?.toast ?? true) {
    toast.success(body.message || 'Request completed')
  }
  return body
}


export interface UploadResultData {
  url: string;
  filename: string;
  size: number;
  format: string;
}

// Multipart upload (POST /uploads). The FormData overrides the instance's
// JSON content-type; axios appends the multipart boundary automatically.
export const uploadFile = async <ResponseDataType = UploadResultData>(url: string, file: File, options?: RequestOptions) => {
  const formData = new FormData();
  formData.append("image", file);
  const response = await API.post(url, formData, {
    skipErrorToast: options?.skipErrorToast,
    headers: { "Content-Type": "multipart/form-data" },
  })
  const body = response.data as APIResponse<ResponseDataType>

  if (options?.toast ?? true) {
    toast.success(body.message || "Upload completed")
  }

  return body
}

export const getAPICall = async <ResponseDataType>(url: string, options?: RequestOptions) => {
  const response = await API.get(url, { skipErrorToast: options?.skipErrorToast })
  const body = response.data as APIResponse<ResponseDataType>

  if (options?.toast === true) {
    toast.success(body.message || 'Request completed')
  }

  return body
}

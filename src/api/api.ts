import axios from 'axios'

import { toast } from '../helper/toast'

interface APIResponse<DataType> {
  message: string
  success: boolean
  data?: DataType
}

export interface RequestOptions {
  /** Show a success toast with the response message. POST defaults to true, GET defaults to false. */
  toast?: boolean
}

export const API = axios.create({
  baseURL: import.meta.env.VITE_DEPLOY_SERVER,  
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Every failed request surfaces as an error toast.
API.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    toast.error(getErrorMessage(error))
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
  const response = await API.post(url, data)
  const body = response.data as APIResponse<ResponseDataType>

  if (options?.toast ?? true) {
    toast.success(body.message || 'Request completed')
  }

  return body
}

export const patchAPICall = async <DataSendType, ResponseDataType>(url: string, data: DataSendType, options?: RequestOptions) => {
  const response = await API.patch(url, data)
  const body = response.data as APIResponse<ResponseDataType>
  
  if (options?.toast ?? true) {
    toast.success(body.message || 'Request completed')
  }
  return body
}

export const putAPICall = async <DataSendType, ResponseDataType>(url: string, data: DataSendType, options?: RequestOptions) => {
  const response = await API.put(url, data)
  const body = response.data as APIResponse<ResponseDataType>
  
  if (options?.toast ?? true) {
    toast.success(body.message || 'Request completed')
  }
  return body
}

export const deleteAPICall = async <DataSendType, ResponseDataType>(url: string, data?: DataSendType, options?: RequestOptions) => {
  const response = await API.delete(url, { data })
  const body = response.data as APIResponse<ResponseDataType>
  if (options?.toast ?? true) {
    toast.success(body.message || 'Request completed')
  }
  return body
}


export const getAPICall = async <ResponseDataType>(url: string, options?: RequestOptions) => {
  const response = await API.get(url)
  const body = response.data as APIResponse<ResponseDataType>

  if (options?.toast === true) {
    toast.success(body.message || 'Request completed')
  }

  return body
}

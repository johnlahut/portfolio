import axios from 'axios';

const STORAGE_KEY = 'chirp-jwt';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(STORAGE_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const setToken = (token: string) =>
  localStorage.setItem(STORAGE_KEY, token);

export const clearToken = () => localStorage.removeItem(STORAGE_KEY);

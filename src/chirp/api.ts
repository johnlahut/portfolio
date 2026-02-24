import { api, setToken } from '@/lib/api';

import type {
  CreatePersonResponse,
  GetImagesResponse,
  GetPeopleResponse,
  GetScrapeJobsResponse,
  ImageRecord,
  ProcessImageRequest,
  ProcessImageResponse,
  ScrapeJob,
  ScrapeJobDetail,
  ScrapeResponse,
  UpdateFacePersonResponse,
} from './types';

export const getImages = (params?: {
  limit?: number;
  cursor?: string;
  sort_person_id?: string;
  search?: string;
}) => api.get<GetImagesResponse>('/images', { params }).then((res) => res.data);

export const scrapeImages = (url: string) =>
  api.post<ScrapeResponse>('/scrape', { url }).then((res) => res.data);

export const processImage = (data: ProcessImageRequest) =>
  api
    .post<ProcessImageResponse>('/process-image', data)
    .then((res) => res.data);

export const getPeople = () =>
  api.get<GetPeopleResponse>('/people').then((res) => res.data);

export const createPerson = (name: string) =>
  api.post<CreatePersonResponse>('/people', { name }).then((res) => res.data);

export const getImage = (imageId: string) =>
  api.get<ImageRecord>(`/images/${imageId}`).then((res) => res.data);

export const deleteImage = (imageId: string) =>
  api.delete(`/images/${imageId}`).then((res) => res.data);

export const tagFaceToPerson = (data: {
  faceId: string;
  personId: string | null;
}) =>
  api
    .patch<UpdateFacePersonResponse>(`/faces/${data.faceId}/person`, {
      person_id: data.personId,
    })
    .then((res) => res.data);

export const deletePerson = (personId: string) =>
  api.delete(`/people/${personId}`).then((res) => res.data);

export const verifyPassword = (password: string) =>
  api.post<{ token: string }>('/auth/verify', { password }).then((res) => {
    setToken(res.data.token);
    return res.data;
  });

export const checkAuth = () =>
  api
    .get<{ authenticated: boolean }>('/auth/check')
    .then((res) => res.data.authenticated)
    .catch(() => false);

export const createScrapeJob = (url: string) =>
  api.post<ScrapeJob>('/scrape-jobs', { url }).then((res) => res.data);

export const getScrapeJobs = () =>
  api.get<GetScrapeJobsResponse>('/scrape-jobs').then((res) => res.data);

export const getScrapeJob = (jobId: string) =>
  api.get<ScrapeJobDetail>(`/scrape-jobs/${jobId}`).then((res) => res.data);

export const retryScrapeJob = (jobId: string) =>
  api.post<ScrapeJob>(`/scrape-jobs/${jobId}/retry`).then((res) => res.data);

export const deleteScrapeJob = (jobId: string) =>
  api.delete(`/scrape-jobs/${jobId}`).then((res) => res.data);

import { api, setToken } from '@/lib/api';

import type {
  CreatePersonResponse,
  GetImagesResponse,
  GetPeopleResponse,
  ImageRecord,
  ProcessImageRequest,
  ProcessImageResponse,
  ScrapeResponse,
  UpdateFacePersonResponse,
} from './types';

export const getImages = () =>
  api.get<GetImagesResponse>('/images').then((res) => res.data);

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

import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { Duration } from 'luxon';

import {
  checkAuth,
  createPerson,
  deleteImage,
  deletePerson,
  getImage,
  getImages,
  getPeople,
  processImage,
  scrapeImages,
  tagFaceToPerson,
  verifyPassword,
} from './api';
import type { ProcessImageRequest } from './types';

export const useImages = () => {
  const hook = useQuery({
    queryKey: ['images'],
    queryFn: getImages,
    staleTime: Infinity,
  });

  return {
    images: hook.data,
    imagesError: hook.error,
    imagesLoading: hook.isFetching,
  };
};

export const useScrape = (url: string) => {
  const hook = useQuery({
    queryKey: ['scrape', url],
    queryFn: () => scrapeImages(url),
    enabled: url.length > 0,
    staleTime: Infinity,
  });

  return {
    scrapedImages: hook.data,
    scrapedImagesLoading: hook.isFetching,
    scrapedImagesError: hook.error,
  };
};

export const useProcessImages = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (requests: ProcessImageRequest[]) => {
      const results = await Promise.all(requests.map(processImage));
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['images'] });
    },
  });
};

export const usePeople = () => {
  const hook = useQuery({
    queryKey: ['people'],
    queryFn: getPeople,
    staleTime: Infinity,
  });

  return {
    people: hook.data,
    peopleLoading: hook.isFetching,
    peopleError: hook.error,
  };
};

export const useCreatePerson = () => {
  const queryClient = useQueryClient();

  const hook = useMutation({
    mutationFn: createPerson,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
    },
  });

  return {
    createPerson: hook.mutate,
    createPersonLoading: hook.isPending,
  };
};

export const useDeletePerson = () => {
  const queryClient = useQueryClient();

  const hook = useMutation({
    mutationFn: deletePerson,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      queryClient.invalidateQueries({ queryKey: ['images'] });
    },
  });

  return {
    deletePerson: hook.mutate,
    deletePersonLoading: hook.isPending,
  };
};

export const useImage = (imageId: string) => {
  const hook = useQuery({
    queryKey: ['images', imageId],
    queryFn: () => getImage(imageId),
    enabled: imageId.length > 0,
  });

  return {
    image: hook.data,
    imageLoading: hook.isFetching,
    imageError: hook.error,
  };
};

export const useDeleteImage = () => {
  const queryClient = useQueryClient();

  const hook = useMutation({
    mutationFn: deleteImage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['images'] });
    },
  });

  return {
    deleteImage: hook.mutate,
    deleteImageLoading: hook.isPending,
  };
};

export const useTagFaceToPerson = () => {
  const queryClient = useQueryClient();

  const hook = useMutation({
    mutationFn: tagFaceToPerson,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['images'] });
    },
  });

  return {
    tagFaceToPerson: hook.mutate,
    tagFaceToPersonLoading: hook.isPending,
  };
};

export const checkAuthOptions = queryOptions({
  queryKey: ['auth'],
  queryFn: checkAuth,
  staleTime: Duration.fromObject({ minutes: 5 }).toMillis(),
  retry: false,
});
export const useCheckAuth = () => {
  const hook = useQuery(checkAuthOptions);

  return {
    authenticated: hook.data,
    authLoading: hook.isFetching,
    authError: hook.error,
  };
};

export const useVerifyPassword = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: verifyPassword,
    onSuccess: () => {
      queryClient.setQueryData(['auth'], true);
    },
  });
};

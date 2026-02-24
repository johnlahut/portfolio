import {
  queryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { Duration } from 'luxon';
import { useEffect } from 'react';

import {
  checkAuth,
  createPerson,
  createScrapeJob,
  deleteImage,
  deletePerson,
  deleteScrapeJob,
  getImage,
  getImages,
  getPeople,
  getScrapeJob,
  getScrapeJobs,
  processImage,
  retryScrapeJob,
  scrapeImages,
  tagFaceToPerson,
  verifyPassword,
} from './api';
import type { ProcessImageRequest } from './types';

export const useImages = ({
  sortPersonId,
  search,
}: {
  sortPersonId?: string;
  search?: string;
} = {}) => {
  const hook = useInfiniteQuery({
    queryKey: ['images', { sortPersonId, search }],
    queryFn: ({ pageParam }) =>
      getImages({
        cursor: pageParam ?? undefined,
        sort_person_id: sortPersonId,
        search,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? null,
    staleTime: Infinity,
  });

  const images = hook.data?.pages.flatMap((page) => page.images) ?? [];

  return {
    images,
    imagesError: hook.error,
    imagesLoading: hook.isFetching && !hook.isFetchingNextPage,
    isFetchingNextPage: hook.isFetchingNextPage,
    hasNextPage: hook.hasNextPage,
    fetchNextPage: hook.fetchNextPage,
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

export const useScrapeJobs = () => {
  const hook = useQuery({
    queryKey: ['scrape-jobs'],
    queryFn: getScrapeJobs,
    staleTime: Infinity,
  });

  return {
    scrapeJobs: hook.data?.jobs,
    scrapeJobsLoading: hook.isFetching,
    scrapeJobsError: hook.error,
  };
};

export const useScrapeJob = (jobId: string) => {
  const queryClient = useQueryClient();

  const hook = useQuery({
    queryKey: ['scrape-job', jobId],
    queryFn: () => getScrapeJob(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'completed' || status === 'failed') return false;
      if (status === 'processing') return 3000;
      return 2000;
    },
  });

  useEffect(() => {
    if (hook.data?.status === 'completed') {
      queryClient.invalidateQueries({ queryKey: ['images'] });
      queryClient.invalidateQueries({ queryKey: ['scrape-jobs'] });
    }
  }, [hook.data?.status, queryClient]);

  return {
    scrapeJob: hook.data,
    scrapeJobLoading: hook.isFetching,
    scrapeJobError: hook.error,
  };
};

export const useCreateScrapeJob = () => {
  const queryClient = useQueryClient();

  const hook = useMutation({
    mutationFn: createScrapeJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scrape-jobs'] });
    },
  });

  return {
    createScrapeJob: hook.mutate,
    createScrapeJobPending: hook.isPending,
    createScrapeJobError: hook.error,
  };
};

export const useRetryScrapeJob = () => {
  const queryClient = useQueryClient();

  const hook = useMutation({
    mutationFn: retryScrapeJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scrape-jobs'] });
    },
  });

  return {
    retryScrapeJob: hook.mutate,
    retryScrapeJobPending: hook.isPending,
  };
};

export const useDeleteScrapeJob = () => {
  const queryClient = useQueryClient();

  const hook = useMutation({
    mutationFn: deleteScrapeJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scrape-jobs'] });
    },
  });

  return {
    deleteScrapeJob: hook.mutate,
    deleteScrapeJobPending: hook.isPending,
  };
};

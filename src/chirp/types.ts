export type PersonMatch = {
  person_id: string;
  person_name: string;
  distance: number;
};

export type DetectedFace = {
  id: string;
  encoding: number[];
  location_top: number;
  location_right: number;
  location_bottom: number;
  location_left: number;
  matched_persons: PersonMatch[];
  person_id: string | null;
};

export type ImageRecord = {
  id: string;
  filename: string;
  source_url: string | null;
  width: number | null;
  height: number | null;
  detected_faces: DetectedFace[];
};

export type GetImagesResponse = {
  images: ImageRecord[];
  next_cursor: string | null;
};

export type ScrapedImage = {
  src: string;
  alt: string | null;
};

export type ScrapeResponse = {
  url: string;
  images: ScrapedImage[];
  count: number;
};

export type ProcessImageRequest = {
  filename: string;
  source_url: string;
};

export type ProcessImageResponse = {
  image_id: string;
  filename: string;
  face_count: number;
};

export type EnrichedScrapedImage = ScrapedImage & {
  existingRecord?: ImageRecord;
};

export type Person = {
  id: string;
  name: string;
};

export type GetPeopleResponse = {
  people: Person[];
  count: number;
};

export type CreatePersonResponse = {
  person: Person;
};

export type UpdateFacePersonResponse = {
  face_id: string;
  person_id: string | null;
};

export type ImageDimensions = {
  naturalWidth: number;
  naturalHeight: number;
  displayedWidth: number;
  displayedHeight: number;
  isLoaded: boolean;
};

export type ScrapeJobStatus =
  | 'pending'
  | 'retry_pending'
  | 'scraping'
  | 'processing'
  | 'completed'
  | 'failed';

export type ScrapeJobItemStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'skipped'
  | 'failed';

export type ScrapeJob = {
  id: string;
  url: string;
  status: ScrapeJobStatus;
  total_images: number | null;
  processed_count: number;
  skipped_count: number;
  failed_count: number;
  total_faces: number;
  preview_url: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

export type ScrapeJobItem = {
  id: string;
  job_id: string;
  source_url: string;
  status: ScrapeJobItemStatus;
  image_id: string | null;
  error: string | null;
};

export type ScrapeJobDetail = ScrapeJob & {
  items: ScrapeJobItem[];
};

export type GetScrapeJobsResponse = {
  jobs: ScrapeJob[];
};

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
  count: number;
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

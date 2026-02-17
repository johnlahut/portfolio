"""Pydantic models shared across modules."""

import json
from typing import Annotated, Any

from pydantic import AliasChoices, BaseModel, BeforeValidator, Field, HttpUrl


def _parse_vector(v: Any) -> list[float]:
    if isinstance(v, str):
        return json.loads(v)
    return v


Vector = Annotated[list[float], BeforeValidator(_parse_vector)]


class FaceLocation(BaseModel):
    location_top: int
    location_right: int
    location_bottom: int
    location_left: int


class ProcessedFace(BaseModel):
    embedding: Vector
    location: FaceLocation


class CoreImage(BaseModel):
    filename: str
    source_url: str | None = None
    width: int | None = None
    height: int | None = None


class DetectedFaceRow(FaceLocation):
    """portfolio.detected_face"""

    id: str
    image_id: str
    encoding: Vector
    person_id: str | None = None


class DetectedFaceInsert(ProcessedFace):
    image_id: str


class DetectedFaceUpdate(BaseModel):
    face_id: str
    person_id: str | None = None  # None to unassign


class ImageRow(CoreImage):
    """portfolio.image"""

    id: str


class ImageInsert(BaseModel):
    filename: str
    source_url: HttpUrl | None = None
    width: int | None = None
    height: int | None = None


class PersonInsert(BaseModel):
    name: str


class PersonDelete(BaseModel):
    person_id: str


class PersonRow(BaseModel):
    """portfolio.person"""

    id: str
    name: str


class ImageWithPersonMatchRow(CoreImage):
    """
    portfolio.get_all_images_with_person_matches
    portfolio.get_image_with_person_matches
    """

    image_id: str
    face_id: str | None = None
    face_encoding: Vector | None = None
    location_top: int | None = None
    location_right: int | None = None
    location_bottom: int | None = None
    location_left: int | None = None
    assigned_person_id: str | None = None
    matched_person_id: str | None = None
    matched_person_name: str | None = None
    match_distance: float | None = None


class PersonMatch(BaseModel):
    person_id: str = Field(validation_alias="matched_person_id")
    person_name: str = Field(validation_alias="matched_person_name")
    distance: float = Field(validation_alias="match_distance")


class DetectedFace(FaceLocation):
    id: str
    matched_persons: list[PersonMatch] = []
    person_id: str | None = None


class DetectedFaceInfo(FaceLocation):
    id: str


class ImageWithFaces(CoreImage):
    id: str = Field(validation_alias=AliasChoices("id", "image_id"))
    detected_faces: list[DetectedFace] = []


class ProcessImageRequest(BaseModel):
    filename: str
    source_url: HttpUrl | None = None


class ProcessImageResponse(BaseModel):
    image_id: str
    filename: str
    faces: list[DetectedFaceInfo]
    face_count: int


class ScrapeRequest(BaseModel):
    url: HttpUrl


class ImageInfo(BaseModel):
    src: str
    alt: str | None = None


class ScrapeResponse(BaseModel):
    url: HttpUrl
    images: list[ImageInfo]
    count: int


class GetImagesResponse(BaseModel):
    images: list[ImageWithFaces]
    count: int


class CreatePersonResponse(BaseModel):
    person: PersonRow


class GetPeopleResponse(BaseModel):
    people: list[PersonRow]
    count: int


class UpdateDetectedFaceRequest(BaseModel):
    person_id: str | None = None  # None to unassign

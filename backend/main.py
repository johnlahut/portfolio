"""FastAPI routes - thin HTTP layer."""

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

import services
from exceptions import AuthError, ImageExistsError, SSRFError
from models import (
    CreatePersonResponse,
    DetectedFaceUpdate,
    GetImagesResponse,
    GetPeopleResponse,
    ImageWithFaces,
    PersonInsert,
    ProcessImageRequest,
    ProcessImageResponse,
    ScrapeRequest,
    ScrapeResponse,
    UpdateDetectedFaceRequest,
)

limiter = Limiter(key_func=get_remote_address)

app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore[arg-type]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://johnlahut.com",
        "https://www.johnlahut.com",
    ],
    allow_origin_regex=r"https://.*\.portfolio-2ed\.pages\.dev",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


def require_auth(request: Request) -> None:
    """FastAPI dependency that validates the JWT on every protected route."""
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing auth token")
    token = auth_header.removeprefix("Bearer ")
    if not services.check_auth(token):
        raise HTTPException(status_code=401, detail="Invalid or expired token")


class VerifyPasswordRequest(BaseModel):
    password: str


@app.post("/auth/verify")
@limiter.limit("5/minute")
def verify_password(request: Request, req: VerifyPasswordRequest):
    try:
        token = services.verify_password(req.password)
    except AuthError as e:
        raise HTTPException(status_code=401, detail=str(e))
    return {"token": token}


@app.get("/auth/check")
def check_auth(request: Request):
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        return {"authenticated": False}
    token = auth_header.removeprefix("Bearer ")
    return {"authenticated": services.check_auth(token)}


@app.post(
    "/scrape", response_model=ScrapeResponse, dependencies=[Depends(require_auth)]
)
def scrape_images(req: ScrapeRequest):
    try:
        images = services.scrape_images(req.url)
    except SSRFError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return ScrapeResponse(url=req.url, images=images, count=len(images))


@app.post(
    "/process-image",
    response_model=ProcessImageResponse,
    dependencies=[Depends(require_auth)],
)
def process_image(req: ProcessImageRequest):
    try:
        return services.detect_and_save_face(req)
    except ImageExistsError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except SSRFError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get(
    "/images", response_model=GetImagesResponse, dependencies=[Depends(require_auth)]
)
def get_images():
    images = services.get_images()
    return GetImagesResponse(images=images, count=len(images))


@app.get(
    "/images/{image_id}",
    response_model=ImageWithFaces,
    dependencies=[Depends(require_auth)],
)
def get_image(image_id: str):
    image = services.get_image(image_id)
    if not image:
        raise HTTPException(status_code=404, detail=f"Image not found: {image_id}")
    return image


@app.delete("/images/{image_id}", dependencies=[Depends(require_auth)])
def delete_image(image_id: str):
    if not services.delete_image(image_id):
        raise HTTPException(status_code=404, detail=f"Image not found: {image_id}")
    return {"deleted": True}


@app.get(
    "/people", response_model=GetPeopleResponse, dependencies=[Depends(require_auth)]
)
def get_people():
    people = services.get_people()
    return GetPeopleResponse(people=people, count=len(people))


@app.post(
    "/people", response_model=CreatePersonResponse, dependencies=[Depends(require_auth)]
)
def create_person(req: PersonInsert):
    return services.create_person(req.name)


@app.delete("/people/{person_id}", dependencies=[Depends(require_auth)])
def delete_person(person_id: str):
    if not services.delete_person(person_id):
        raise HTTPException(status_code=404, detail=f"Person not found: {person_id}")
    return {"deleted": True}


@app.patch(
    "/faces/{face_id}/person",
    response_model=DetectedFaceUpdate,
    dependencies=[Depends(require_auth)],
)
def update_face_person(face_id: str, req: UpdateDetectedFaceRequest):
    result = services.update_face_person(face_id, req.person_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"Face not found: {face_id}")
    return result

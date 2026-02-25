"""FastAPI routes - thin HTTP layer."""

import threading
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

import database
import jobs
import services
from exceptions import AuthError, ImageExistsError, SSRFError
from models import (
    CreatePersonResponse,
    CreateScrapeJobRequest,
    DetectedFaceUpdate,
    GetImagesResponse,
    GetPeopleResponse,
    GetScrapeJobsResponse,
    ImageWithFaces,
    PersonInsert,
    ProcessImageRequest,
    ProcessImageResponse,
    ScrapeJobDetail,
    ScrapeJobRow,
    ScrapeRequest,
    ScrapeResponse,
    UpdateDetectedFaceRequest,
)

limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    database.cleanup_stale_jobs()
    database.cleanup_old_jobs()
    yield


app = FastAPI(lifespan=lifespan)
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
def get_images(
    limit: int = 40,
    cursor: str | None = None,
    sort_person_id: str | None = None,
    search: str | None = None,
):
    try:
        return services.get_images(
            limit=limit,
            cursor=cursor,
            sort_person_id=sort_person_id,
            search=search,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


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


@app.post(
    "/scrape-jobs",
    response_model=ScrapeJobRow,
    status_code=202,
    dependencies=[Depends(require_auth)],
)
def create_scrape_job(req: CreateScrapeJobRequest):
    try:
        job = services.create_scrape_job(str(req.url))
    except SSRFError as e:
        raise HTTPException(status_code=400, detail=str(e))
    threading.Thread(
        target=jobs.run_scrape_job, args=(job.id, False), daemon=True
    ).start()
    return job


@app.get(
    "/scrape-jobs",
    response_model=GetScrapeJobsResponse,
    dependencies=[Depends(require_auth)],
)
def get_scrape_jobs():
    return services.get_scrape_jobs()


@app.get(
    "/scrape-jobs/{job_id}",
    response_model=ScrapeJobDetail,
    dependencies=[Depends(require_auth)],
)
def get_scrape_job(job_id: str):
    job = services.get_scrape_job_detail(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job not found: {job_id}")
    return job


@app.post(
    "/scrape-jobs/{job_id}/retry",
    response_model=ScrapeJobRow,
    dependencies=[Depends(require_auth)],
)
def retry_scrape_job(job_id: str):
    job = services.retry_scrape_job(job_id)
    if not job:
        raise HTTPException(
            status_code=409, detail="Job not found or has no failed items to retry"
        )
    threading.Thread(
        target=jobs.run_scrape_job, args=(job.id, True), daemon=True
    ).start()
    return job


@app.delete("/scrape-jobs/{job_id}", dependencies=[Depends(require_auth)])
def delete_scrape_job(job_id: str):
    if not services.delete_scrape_job(job_id):
        raise HTTPException(status_code=404, detail=f"Job not found: {job_id}")
    return {"deleted": True}

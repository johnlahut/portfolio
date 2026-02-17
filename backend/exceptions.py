class ImageExistsError(Exception):
    """Raised when an image already exists in the database."""

    pass


class AuthError(Exception):
    """Raised when authentication fails."""

    pass


class SSRFError(Exception):
    """Raised when a URL targets a blocked address (private, loopback, metadata)."""

    pass

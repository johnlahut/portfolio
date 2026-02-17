"""Update the chirp password hash in Supabase."""

import getpass
import os
import sys

import bcrypt
from dotenv import load_dotenv
from supabase import Client, ClientOptions, create_client

load_dotenv()


def get_client() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in .env")
    return create_client(url, key, options=ClientOptions(schema="portfolio"))


def update_password() -> None:
    password = getpass.getpass("New password: ")
    confirm = getpass.getpass("Confirm password: ")

    if password != confirm:
        print("Passwords do not match.")
        sys.exit(1)

    if len(password) < 8:
        print("Password must be at least 8 characters.")
        sys.exit(1)

    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    client = get_client()

    # Update the hash
    client.table("app_config").upsert(
        {"key": "chirp_password_hash", "value": hashed}
    ).execute()

    # Bump the version to invalidate existing JWTs
    result = (
        client.table("app_config")
        .select("value")
        .eq("key", "chirp_password_version")
        .single()
        .execute()
    )
    data = result.data
    current_version = int(str(data["value"])) if isinstance(data, dict) else 0
    client.table("app_config").upsert(
        {"key": "chirp_password_version", "value": str(current_version + 1)}
    ).execute()

    print(
        f"Password updated (version {current_version + 1}). All existing sessions invalidated."
    )


if __name__ == "__main__":
    update_password()

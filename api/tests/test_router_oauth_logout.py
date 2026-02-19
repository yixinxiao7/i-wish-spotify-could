import json


LOGOUT_URL = "/api/oauth/logout"
MANAGED_FILES = ("token.json", "user_id.json", "all_uncategorized_songs.json")


# ── helpers ──────────────────────────────────────────────────────────────────

def create_file(tmp_path, name, content="{}"):
    p = tmp_path / name
    p.write_text(content)
    return p


# ── happy-path ────────────────────────────────────────────────────────────────

def test_logout_deletes_all_files_when_all_exist(client, tmp_path):
    for name in MANAGED_FILES:
        create_file(tmp_path, name)

    response = client.delete(LOGOUT_URL)

    assert response.status_code == 200
    for name in MANAGED_FILES:
        assert not (tmp_path / name).exists(), f"{name} should have been deleted"


def test_logout_returns_success_message(client, tmp_path):
    response = client.delete(LOGOUT_URL)

    assert response.json() == {"message": "logged out successfully"}


# ── idempotency ───────────────────────────────────────────────────────────────

def test_logout_succeeds_when_no_files_exist(client):
    """Calling logout on a clean state should not raise or return an error."""
    response = client.delete(LOGOUT_URL)

    assert response.status_code == 200


def test_logout_is_idempotent_on_repeated_calls(client):
    """A second logout call after the first should still succeed."""
    first = client.delete(LOGOUT_URL)
    second = client.delete(LOGOUT_URL)

    assert first.status_code == 200
    assert second.status_code == 200


# ── partial state ─────────────────────────────────────────────────────────────

def test_logout_deletes_only_token_when_others_absent(client, tmp_path):
    create_file(tmp_path, "token.json", json.dumps({"access_token": "abc"}))

    response = client.delete(LOGOUT_URL)

    assert response.status_code == 200
    assert not (tmp_path / "token.json").exists()


def test_logout_deletes_whatever_files_are_present(client, tmp_path):
    """Only token.json and all_uncategorized_songs.json exist — user_id.json is absent."""
    create_file(tmp_path, "token.json")
    create_file(tmp_path, "all_uncategorized_songs.json", json.dumps([{"id": "x"}]))

    response = client.delete(LOGOUT_URL)

    assert response.status_code == 200
    assert not (tmp_path / "token.json").exists()
    assert not (tmp_path / "all_uncategorized_songs.json").exists()
    assert not (tmp_path / "user_id.json").exists()  # was already absent, still absent


# ── file-content edge cases ───────────────────────────────────────────────────

def test_logout_deletes_empty_files(client, tmp_path):
    """Empty/corrupt files should still be deleted without error."""
    for name in MANAGED_FILES:
        create_file(tmp_path, name, content="")

    response = client.delete(LOGOUT_URL)

    assert response.status_code == 200
    for name in MANAGED_FILES:
        assert not (tmp_path / name).exists()


def test_logout_does_not_delete_unrelated_files(client, tmp_path):
    """logout must only touch the three managed files, not anything else in cwd."""
    create_file(tmp_path, "token.json")
    unrelated = create_file(tmp_path, "important_data.json", json.dumps({"keep": True}))

    client.delete(LOGOUT_URL)

    assert unrelated.exists(), "unrelated files must not be removed"

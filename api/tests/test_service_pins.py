from app.services import pins_service


# ── read_pins ─────────────────────────────────────────────────────────────

def test_read_pins_missing_file_returns_empty_set():
    assert pins_service.read_pins() == set()


def test_read_pins_empty_file_returns_empty_set(tmp_path):
    (tmp_path / "pinned_playlists.json").write_text("")
    assert pins_service.read_pins() == set()


def test_read_pins_malformed_file_returns_empty_set(tmp_path):
    (tmp_path / "pinned_playlists.json").write_text("not json")
    assert pins_service.read_pins() == set()


def test_read_pins_valid_file_returns_ids(tmp_path):
    (tmp_path / "pinned_playlists.json").write_text('["p1", "p2"]')
    assert pins_service.read_pins() == {"p1", "p2"}


# ── write_pins ────────────────────────────────────────────────────────────

def test_write_pins_round_trip():
    pins_service.write_pins({"p1", "p2"})
    assert pins_service.read_pins() == {"p1", "p2"}


def test_write_pins_empty_set():
    pins_service.write_pins({"p1"})
    pins_service.write_pins(set())
    assert pins_service.read_pins() == set()


# ── set_pin ───────────────────────────────────────────────────────────────

def test_set_pin_adds_playlist():
    result = pins_service.set_pin("p1", True)
    assert result == {"p1"}
    assert pins_service.read_pins() == {"p1"}


def test_set_pin_is_idempotent_when_pinning_twice():
    pins_service.set_pin("p1", True)
    result = pins_service.set_pin("p1", True)
    assert result == {"p1"}


def test_set_pin_removes_playlist():
    pins_service.set_pin("p1", True)
    result = pins_service.set_pin("p1", False)
    assert result == set()
    assert pins_service.read_pins() == set()


def test_set_pin_unpin_when_not_pinned_is_idempotent():
    result = pins_service.set_pin("p1", False)
    assert result == set()


def test_set_pin_leaves_other_pins_untouched():
    pins_service.set_pin("p1", True)
    pins_service.set_pin("p2", True)
    result = pins_service.set_pin("p1", False)
    assert result == {"p2"}


# ── apply_pins ────────────────────────────────────────────────────────────

def _playlists(*ids):
    return [{"id": i, "name": i} for i in ids]


def test_apply_pins_moves_pinned_playlist_to_top():
    playlists = _playlists("A", "B", "C", "D")
    result = pins_service.apply_pins(playlists, {"C"})
    assert [p["id"] for p in result] == ["C", "A", "B", "D"]


def test_apply_pins_preserves_relative_order_within_groups():
    playlists = _playlists("A", "B", "C", "D")
    result = pins_service.apply_pins(playlists, {"D", "B"})
    assert [p["id"] for p in result] == ["B", "D", "A", "C"]


def test_apply_pins_no_pins_preserves_original_order():
    playlists = _playlists("A", "B", "C", "D")
    result = pins_service.apply_pins(playlists, set())
    assert [p["id"] for p in result] == ["A", "B", "C", "D"]


def test_apply_pins_all_pinned_preserves_original_order():
    playlists = _playlists("A", "B", "C", "D")
    result = pins_service.apply_pins(playlists, {"A", "B", "C", "D"})
    assert [p["id"] for p in result] == ["A", "B", "C", "D"]


def test_apply_pins_annotates_pinned_field():
    playlists = _playlists("A", "B")
    result = pins_service.apply_pins(playlists, {"A"})
    by_id = {p["id"]: p["pinned"] for p in result}
    assert by_id == {"A": True, "B": False}


def test_apply_pins_ignores_stale_pinned_id():
    playlists = _playlists("A", "B")
    result = pins_service.apply_pins(playlists, {"A", "does-not-exist"})
    assert [p["id"] for p in result] == ["A", "B"]
    assert len(result) == 2

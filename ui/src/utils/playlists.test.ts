import { sortPinnedFirst } from './playlists';
import { Playlist } from '@/types/spotify';

const playlist = (id: string, pinned?: boolean): Playlist => ({
  id,
  name: id,
  owner_id: "owner",
  pinned,
});

describe("sortPinnedFirst", () => {
  it("moves a pinned playlist to the top", () => {
    const result = sortPinnedFirst([
      playlist("A"),
      playlist("B"),
      playlist("C", true),
      playlist("D"),
    ]);
    expect(result.map((p) => p.id)).toEqual(["C", "A", "B", "D"]);
  });

  it("preserves relative order within each group", () => {
    const result = sortPinnedFirst([
      playlist("A"),
      playlist("B", true),
      playlist("C"),
      playlist("D", true),
    ]);
    expect(result.map((p) => p.id)).toEqual(["B", "D", "A", "C"]);
  });

  it("returns original order when nothing is pinned", () => {
    const result = sortPinnedFirst([playlist("A"), playlist("B"), playlist("C"), playlist("D")]);
    expect(result.map((p) => p.id)).toEqual(["A", "B", "C", "D"]);
  });

  it("returns original order when everything is pinned", () => {
    const result = sortPinnedFirst([
      playlist("A", true),
      playlist("B", true),
      playlist("C", true),
      playlist("D", true),
    ]);
    expect(result.map((p) => p.id)).toEqual(["A", "B", "C", "D"]);
  });
});

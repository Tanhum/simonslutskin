export interface Artwork {
  id: string;
  title: string;
  description: string;
  size: string;
  style: string;
  artist: string;
  imageUrl: string;
  createdAt: string;
}

export interface ArtworkDetails {
  title: string;
  description: string;
  size: string;
  style: string;
  artist: string;
}

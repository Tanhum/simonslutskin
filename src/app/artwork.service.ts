import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Artwork, ArtworkDetails } from './artwork';

interface AuthResponse {
  authenticated: boolean;
}

@Injectable({ providedIn: 'root' })
export class ArtworkService {
  private readonly http = inject(HttpClient);
  private readonly options = { withCredentials: true };

  getArtworks(): Observable<Artwork[]> {
    return this.http.get<Artwork[]>('/api/artworks');
  }

  checkAuthentication(): Observable<boolean> {
    return this.http
      .get<AuthResponse>('/api/auth', this.options)
      .pipe(map((response) => response.authenticated));
  }

  signIn(password: string): Observable<void> {
    return this.http.post<void>('/api/login', { password }, this.options);
  }

  signOut(): Observable<void> {
    return this.http.post<void>('/api/logout', {}, this.options);
  }

  addArtwork(details: ArtworkDetails, image: File): Observable<Artwork> {
    const body = new FormData();
    body.append('title', details.title);
    body.append('description', details.description);
    body.append('size', details.size);
    body.append('style', details.style);
    body.append('artist', details.artist);
    body.append('image', image);
    return this.http.post<Artwork>('/api/artworks', body, this.options);
  }
}

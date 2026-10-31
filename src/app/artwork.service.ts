import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, switchMap } from 'rxjs';
import { Artwork, ArtworkDetails } from './artwork';

interface AuthResponse {
  authenticated: boolean;
}

interface SignedUploadResponse {
  uploadUrl: string;
  publicKey: string;
  imagePath: string;
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

  signIn(username: string, password: string): Observable<void> {
    return this.http.post<void>('/api/login', { username, password }, this.options);
  }

  signOut(): Observable<void> {
    return this.http.post<void>('/api/logout', {}, this.options);
  }

  addArtwork(details: ArtworkDetails, image: File): Observable<Artwork> {
    return this.http
      .post<SignedUploadResponse>(
        '/api/upload-url',
        { contentType: image.type, fileName: image.name },
        this.options,
      )
      .pipe(
        switchMap(({ uploadUrl, publicKey, imagePath }) =>
          this.http.put(uploadUrl, image, {
            headers: {
              apikey: publicKey,
              'Content-Type': image.type,
              'x-upsert': 'false',
            },
            responseType: 'text',
          }).pipe(map(() => imagePath)),
        ),
        switchMap((imagePath) =>
          this.http.post<Artwork>('/api/artworks', { ...details, imagePath }, this.options),
        ),
      );
  }
}

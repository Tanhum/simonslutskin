import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, of, switchMap, tap } from 'rxjs';
import { Artwork, ArtworkDetails } from './artwork';
import { SUPABASE_FUNCTIONS_URL, SUPABASE_PUBLISHABLE_KEY } from './supabase.config';

interface AuthResponse {
  authenticated: boolean;
  token?: string;
}

interface SignedUploadResponse {
  uploadUrl: string;
  imagePath: string;
}

@Injectable({ providedIn: 'root' })
export class ArtworkService {
  private readonly http = inject(HttpClient);
  private readonly sessionKey = 'gallery_session';

  private get functionHeaders() {
    const token = sessionStorage.getItem(this.sessionKey);
    return {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  getArtworks(): Observable<Artwork[]> {
    return this.http.get<Artwork[]>(`${SUPABASE_FUNCTIONS_URL}/artworks`, {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
    });
  }

  checkAuthentication(): Observable<boolean> {
    if (!sessionStorage.getItem(this.sessionKey)) return of(false);
    return this.http
      .get<AuthResponse>(`${SUPABASE_FUNCTIONS_URL}/auth`, { headers: this.functionHeaders })
      .pipe(map((response) => response.authenticated));
  }

  signIn(username: string, password: string): Observable<void> {
    return this.http
      .post<AuthResponse>(
        `${SUPABASE_FUNCTIONS_URL}/auth?action=login`,
        { username, password },
        { headers: { apikey: SUPABASE_PUBLISHABLE_KEY } },
      )
      .pipe(
        tap((response) => {
          if (!response.token) throw new Error('The gallery sign-in did not return a session.');
          sessionStorage.setItem(this.sessionKey, response.token);
        }),
        map(() => undefined),
      );
  }

  signOut(): Observable<void> {
    return this.http
      .post<void>(
        `${SUPABASE_FUNCTIONS_URL}/auth?action=logout`,
        {},
        { headers: this.functionHeaders },
      )
      .pipe(tap(() => sessionStorage.removeItem(this.sessionKey)));
  }

  addArtwork(details: ArtworkDetails, image: File): Observable<Artwork> {
    return this.http
      .post<SignedUploadResponse>(
        `${SUPABASE_FUNCTIONS_URL}/upload-url`,
        { contentType: image.type, fileName: image.name },
        { headers: this.functionHeaders },
      )
      .pipe(
        switchMap(({ uploadUrl, imagePath }) =>
          this.http.put(uploadUrl, image, {
            headers: {
              apikey: SUPABASE_PUBLISHABLE_KEY,
              'Content-Type': image.type,
            },
            responseType: 'text',
          }).pipe(map(() => imagePath)),
        ),
        switchMap((imagePath) =>
          this.http.post<Artwork>(
            `${SUPABASE_FUNCTIONS_URL}/artworks`,
            { ...details, imagePath },
            { headers: this.functionHeaders },
          ),
        ),
      );
  }

  deleteArtwork(id: string): Observable<void> {
    return this.http
      .delete<void>(`${SUPABASE_FUNCTIONS_URL}/artworks?id=${encodeURIComponent(id)}`, {
        headers: this.functionHeaders,
      });
  }
}

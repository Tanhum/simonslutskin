import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Artwork } from './artwork';
import { ArtworkService } from './artwork.service';

@Component({
  selector: 'app-gallery',
  imports: [RouterLink],
  templateUrl: './gallery.component.html',
  styleUrl: './gallery.component.scss',
})
export class GalleryComponent implements OnInit {
  private readonly artworkService = inject(ArtworkService);

  readonly artworks = signal<Artwork[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  ngOnInit(): void {
    this.artworkService.getArtworks().subscribe({
      next: (artworks) => {
        this.artworks.set(artworks);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('The collection could not be loaded. Please try again in a moment.');
        this.loading.set(false);
      },
    });
  }
}

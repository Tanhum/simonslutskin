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

  formatWorkCount(count: number): string {
    const remainder100 = count % 100;
    const remainder10 = count % 10;
    const noun =
      remainder100 >= 11 && remainder100 <= 14
        ? 'работ'
        : remainder10 === 1
          ? 'работа'
          : remainder10 >= 2 && remainder10 <= 4
            ? 'работы'
            : 'работ';
    return `${count} ${noun}`;
  }

  ngOnInit(): void {
    this.artworkService.getArtworks().subscribe({
      next: (artworks) => {
        this.artworks.set(artworks);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Не удалось загрузить галерею. Попробуйте ещё раз чуть позже.');
        this.loading.set(false);
      },
    });
  }
}

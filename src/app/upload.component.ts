import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Artwork, ArtworkDetails } from './artwork';
import { ArtworkService } from './artwork.service';

@Component({
  selector: 'app-upload',
  imports: [FormsModule, RouterLink],
  templateUrl: './upload.component.html',
  styleUrl: './upload.component.scss',
})
export class UploadComponent implements OnInit, OnDestroy {
  private readonly artworkService = inject(ArtworkService);
  private previewUrl = '';
  private imageInput: HTMLInputElement | null = null;

  readonly checkingAccess = signal(true);
  readonly authenticated = signal(false);
  readonly signingIn = signal(false);
  readonly submitting = signal(false);
  readonly imageFile = signal<File | null>(null);
  readonly imagePreview = signal('');
  readonly loginError = signal('');
  readonly uploadError = signal('');
  readonly uploadSuccess = signal('');
  readonly existingArtworks = signal<Artwork[]>([]);
  readonly loadingArtworks = signal(false);
  readonly deletingArtworkId = signal('');
  readonly managementError = signal('');
  readonly managementMessage = signal('');

  username = '';
  password = '';
  details: ArtworkDetails = {
    title: '',
    description: '',
    size: '',
    style: '',
    artist: '',
  };

  ngOnInit(): void {
    this.artworkService.checkAuthentication().subscribe({
      next: (authenticated) => {
        this.authenticated.set(authenticated);
        this.checkingAccess.set(false);
        if (authenticated) this.loadExistingArtworks();
      },
      error: () => {
        this.loginError.set('Не удалось подключиться к галерее. Попробуйте ещё раз.');
        this.checkingAccess.set(false);
      },
    });
  }

  ngOnDestroy(): void {
    this.clearPreview();
  }

  signIn(): void {
    this.loginError.set('');
    this.signingIn.set(true);
    this.artworkService.signIn(this.username, this.password).subscribe({
      next: () => {
        this.username = '';
        this.password = '';
        this.authenticated.set(true);
        this.signingIn.set(false);
        this.loadExistingArtworks();
      },
      error: (error: { status?: number }) => {
        this.loginError.set(
          error.status === 401
            ? 'Неверное имя пользователя или пароль. Попробуйте ещё раз.'
            : 'Не удалось войти. Попробуйте ещё раз чуть позже.',
        );
        this.signingIn.set(false);
      },
    });
  }

  selectImage(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.imageInput = input;
    const file = input.files?.[0] ?? null;
    this.clearPreview();
    this.uploadError.set('');

    if (!file) {
      this.imageFile.set(null);
      this.imagePreview.set('');
      return;
    }

    const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!acceptedTypes.includes(file.type)) {
      this.imageFile.set(null);
      this.imagePreview.set('');
      this.uploadError.set('Выберите изображение в формате JPG, PNG или WebP.');
      input.value = '';
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      this.imageFile.set(null);
      this.imagePreview.set('');
      this.uploadError.set('Размер изображения не должен превышать 10 МБ.');
      input.value = '';
      return;
    }

    this.imageFile.set(file);
    this.previewUrl = URL.createObjectURL(file);
    this.imagePreview.set(this.previewUrl);
  }

  addArtwork(): void {
    const image = this.imageFile();
    if (!image) {
      this.uploadError.set('Сначала выберите изображение для загрузки.');
      return;
    }

    this.uploadError.set('');
    this.uploadSuccess.set('');
    this.submitting.set(true);
    this.artworkService.addArtwork(this.details, image).subscribe({
      next: () => {
        this.details = { title: '', description: '', size: '', style: '', artist: '' };
        this.imageFile.set(null);
        this.imagePreview.set('');
        if (this.imageInput) this.imageInput.value = '';
        this.clearPreview();
        this.submitting.set(false);
        this.uploadSuccess.set('Работа добавлена в галерею.');
        this.loadExistingArtworks();
      },
      error: (error: { error?: { error?: string } }) => {
        this.uploadError.set(
          error.error?.error ?? 'Не удалось добавить работу. Попробуйте ещё раз.',
        );
        this.submitting.set(false);
      },
    });
  }

  signOut(): void {
    this.artworkService.signOut().subscribe({
      next: () => {
        this.authenticated.set(false);
        this.uploadError.set('');
        this.uploadSuccess.set('');
        this.existingArtworks.set([]);
      },
      error: () => this.uploadError.set('Не удалось выйти. Попробуйте ещё раз.'),
    });
  }

  deleteArtwork(artwork: Artwork): void {
    const confirmed = window.confirm(
      `Удалить работу «${artwork.title}» из галереи? Это действие нельзя отменить.`,
    );
    if (!confirmed) return;

    this.deletingArtworkId.set(artwork.id);
    this.managementError.set('');
    this.managementMessage.set('');
    this.artworkService.deleteArtwork(artwork.id).subscribe({
      next: () => {
        this.existingArtworks.update((artworks) =>
          artworks.filter((item) => item.id !== artwork.id),
        );
        this.managementMessage.set(`Работа «${artwork.title}» удалена из галереи.`);
        this.deletingArtworkId.set('');
      },
      error: (error: { error?: { error?: string } }) => {
        this.managementError.set(
          error.error?.error ?? 'Не удалось удалить работу. Попробуйте ещё раз.',
        );
        this.deletingArtworkId.set('');
        this.loadExistingArtworks(false);
      },
    });
  }

  private loadExistingArtworks(clearError = true): void {
    this.loadingArtworks.set(true);
    if (clearError) this.managementError.set('');
    this.artworkService.getArtworks().subscribe({
      next: (artworks) => {
        this.existingArtworks.set(artworks);
        this.loadingArtworks.set(false);
      },
      error: () => {
        this.managementError.set('Не удалось загрузить список работ для управления.');
        this.loadingArtworks.set(false);
      },
    });
  }

  private clearPreview(): void {
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = '';
    }
  }
}

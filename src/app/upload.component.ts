import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ArtworkDetails } from './artwork';
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
      },
      error: () => {
        this.loginError.set('Could not connect to the gallery server. Please try again.');
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
      },
      error: (error: { status?: number }) => {
        this.loginError.set(
          error.status === 401
            ? 'That username or password did not match. Please try again.'
            : 'Could not sign in. Please try again in a moment.',
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
      this.uploadError.set('Choose a JPG, PNG, or WebP image.');
      input.value = '';
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      this.imageFile.set(null);
      this.imagePreview.set('');
      this.uploadError.set('The image must be smaller than 10 MB.');
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
      this.uploadError.set('Please choose an image to upload.');
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
        this.uploadSuccess.set('Your artwork has been added to the gallery.');
      },
      error: (error: { error?: { error?: string } }) => {
        this.uploadError.set(
          error.error?.error ?? 'The artwork could not be added. Please try again.',
        );
        this.submitting.set(false);
      },
    });
  }

  signOut(): void {
    this.artworkService.signOut().subscribe({
      next: () => this.authenticated.set(false),
      error: () => this.uploadError.set('Could not sign out. Please try again.'),
    });
  }

  private clearPreview(): void {
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = '';
    }
  }
}

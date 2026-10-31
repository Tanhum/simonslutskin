import { Routes } from '@angular/router';
import { GalleryComponent } from './gallery.component';
import { UploadComponent } from './upload.component';

export const routes: Routes = [
  { path: '', component: GalleryComponent, title: 'Gallery | Simon Slutskin' },
  { path: 'upload', component: UploadComponent, title: 'Artist access | Simon Slutskin' },
  { path: '**', redirectTo: '' },
];

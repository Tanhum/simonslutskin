import { Routes } from '@angular/router';
import { GalleryComponent } from './gallery.component';
import { UploadComponent } from './upload.component';

export const routes: Routes = [
  { path: '', component: GalleryComponent, title: 'Галерея | Симон Слутскин' },
  { path: 'upload', component: UploadComponent, title: 'Мастерская | Симон Слутскин' },
  { path: '**', redirectTo: '' },
];

import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should render the Russian artist wordmark and navigation', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.wordmark-name')?.textContent).toContain('Симон Слутскин');
    expect(compiled.querySelector('nav')?.textContent).toContain('Галерея');
    expect(compiled.querySelector('nav')?.textContent).toContain('Мастерская');
  });
});

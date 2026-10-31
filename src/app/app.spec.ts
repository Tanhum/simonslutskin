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

  it('should render the artist wordmark and navigation', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.wordmark-name')?.textContent).toContain('Simon Slutskin');
    expect(compiled.querySelector('nav')?.textContent).toContain('Gallery');
    expect(compiled.querySelector('nav')?.textContent).toContain('Artist access');
  });
});
